import * as THREE from 'three';
import { SkipGate, type Shot, type CamPose, type SubtitleView, type StoryCheckpointPayload } from '@slu/narrative';
import { World, freshInventory, type Inventory } from './World';
import { Ballast } from '../player/Ballast';
import { Aegis } from '../mech/Aegis';
import { AlertDirector } from '../ai/AlertDirector';
import { Interactables } from '../world/Interactables';
import { Gates } from '../world/Gates';
import { CollapseSystem } from '../world/Collapse';
import { Hazards } from '../world/Hazards';
import { TimedZones } from '../world/TimedZones';
import { LightPool } from '../world/LightPool';
import { LevelContext, type LevelDef, type SpawnPoint } from '../world/Level';
import { LEVELS } from '../world/levels';
import { SCRIPTS } from '../story';
import { ALL_LINES } from '../../data/story';
import { CHAPTER_CORE } from '../../data/core';
import { chapterById, type ChapterStats } from '../../data/chapters';
import { CACHES, PERSONAL_CACHE_IDS } from '../../data/caches';
import { COMPONENT_IDS, type ComponentId } from '../../data/components';
import { FEEL } from '../../data/feel';
import type { InputFrame } from './Input';
import type { StoryAction, ShotSpec } from '../story/Actions';
import type { ChapterScript, ScriptContext } from '../story/Script';
import type { AudioEngine } from '../audio/Engine';
import type { Hud } from '../ui/Hud';
import type { GameOptions } from '../../data/options';
import type { DifficultyId } from '../../data/enemies';

export interface CheckpointExtra {
  chapterId: string;
  spawn: SpawnPoint;
  killed: string[];
  counters: World['counters'];
  chapterTime: number;
  aegis: { armor: number; lost: string[] } | null;
  prompts: Record<string, number>;
}
export type SavePayload = StoryCheckpointPayload<Inventory, CheckpointExtra>;

export interface SessionHost {
  onCheckpoint(p: SavePayload): void;
  onChapterComplete(stats: ChapterStats, chapterId: string): void;
  onEnding(): void;
}

/**
 * Runs one chapter: loads the level + story script, owns the fixed-step update order, executes
 * story actions, and handles checkpoints, death and Timed Zone failure. One World is reused across
 * chapters and torn down between them.
 */
export class Session {
  readonly w = new World();
  level: LevelDef | null = null;
  script: ChapterScript | null = null;
  private persistent = new Set<THREE.Object3D>();
  private skip = new SkipGate(1);
  private lastPayload: SavePayload | null = null;
  private zonePayload: SavePayload | null = null;
  private restoring = false;
  chapterTime = 0;
  private tremorT = 20;
  private debrisT = 10;
  replayOnly = false;
  loaded = false;
  private ctx!: ScriptContext;
  private subHandles = new Map<number, string>();
  /** Pending cinematic shots resolution. */
  private padActive = false;

  constructor(readonly audio: AudioEngine, readonly hud: Hud, readonly subs: SubtitleView, options: GameOptions, readonly host: SessionHost) {
    const w = this.w;
    w.audio = audio; w.hud = hud; w.options = options;
    w.lights = new LightPool(w.scene, 6);
    w.alert = new AlertDirector(w);
    w.interact = new Interactables(w);
    w.gates = new Gates(w);
    w.collapse = new CollapseSystem(w);
    w.hazards = new Hazards(w);
    w.zones = new TimedZones(w);
    w.zones.onFail = () => this.failZone();
    w.voice.add(ALL_LINES);
    w.graph.register(Object.values(SCRIPTS).map((s) => s.chapter));
    for (const s of Object.values(SCRIPTS)) w.sequences.register(s.sequences);
    w.sequences.onAction((a, c) => this.run(a, c.skipping));
    w.sequences.events.on('end', (e) => { if (!w.sequences.cinematic) { w.cinematic.stop(0.6); } w.emit('sequence:end', e.id); if (this.replayOnly && e.replay) w.emit('replay:end', e.id); });
    this.wireDialogue();
    w.scene.children.forEach((c) => this.persistent.add(c));
    w.alert.listeners.push((e) => { if (e.type === 'lockdown') { w.emit('lockdown', e.area); hud.toast('Lockdown', 'red'); } });
  }

  get options(): GameOptions { return this.w.options; }
  setDifficulty(d: DifficultyId): void { this.w.difficultyId = d; }

  // ------------------------------------------------------------------ dialogue → subtitles + audio
  private wireDialogue(): void {
    const w = this.w;
    w.dialogue.events.on('start', (pl) => {
      const sp = w.voice.speaker(pl.line.speaker);
      const id = `l${pl.handle}`;
      this.subHandles.set(pl.handle, id);
      this.subs.show({ id, speakerLabel: sp?.label, color: sp?.color, text: pl.line.text, dim: pl.channel === 'bark' && pl.ducked });
      if (pl.line.caption) this.subs.show({ id: `${id}c`, text: pl.line.caption, caption: true });
      const radio = sp?.channel === 'radio' || pl.channel === 'recording';
      void this.audio.voice(pl.line.take, radio, pl.channel === 'bark' && pl.ducked ? w.dialogue.barkDuckDb : 0).then((ms) => { if (ms) w.dialogue.setDuration(pl.handle, ms); });
      if (pl.channel !== 'bark') this.audio.voDuck(true);
      if (pl.channel === 'recording' && !w.inMech) { this.audio.music('wren'); this.audio.sfx('cache.hiss', null, 0.5); }
    });
    w.dialogue.events.on('stop', ({ line }) => {
      const id = this.subHandles.get(line.handle); if (id) { this.subs.hide(id); this.subs.hide(`${id}c`); }
      this.subHandles.delete(line.handle);
      if (line.channel !== 'bark' && !w.dialogue.primary) {
        this.audio.voDuck(false);
        if (line.channel === 'recording' && !w.dialogue.busy) this.ambientMusic();
      }
      if (line.channel !== 'bark' && line.elapsedMs >= line.durationMs - 1) w.state.set(`line.${line.line.id}`);
      w.emit('line:end', line.line.id);
    });
  }

  ambientMusic(): void {
    if (this.w.zones.active) { this.audio.music('timedZone'); return; }
    const cue = (this.w.state.get('music') as string | undefined) ?? this.level?.music ?? 'infiltration';
    this.audio.music(cue);
  }

  // ------------------------------------------------------------------ loading
  private teardown(): void {
    const w = this.w;
    w.sequences.stopAll(); w.dialogue.stopAll(); this.subs.clear();
    w.cinematic.stop(0);
    for (const e of w.enemies) e.dispose(); w.enemies = [];
    for (const m of w.mechHostiles) m.dispose(); w.mechHostiles = [];
    w.player?.dispose(); w.player = null;
    w.aegis?.dispose(); w.aegis = null;
    w.ascent?.dispose(); w.ascent = null; w.ascentView = 'climb'; w.camera.far = 6000; w.camera.updateProjectionMatrix();
    w.alert.clear(); w.gates.clear(); w.collapse.clear(); w.hazards.clear(); w.interact.clear(); w.lights.clear();
    w.zones.stop(); w.perception.clear(); w.perception.radioEnabled = true; w.triggers.clear();
    w.collision.clear(); w.fx.clear(); w.clearUpdaters(); w.clearListeners();
    for (const c of [...w.scene.children]) if (!this.persistent.has(c)) w.scene.remove(c);
    w.atmo.darkness = 0; w.atmo.snowScale = 1; w.atmo.breakAmount = 0;
    w.time.clear(); w.shake.trauma = 0;
    this.audio.mix('normal');
    this.hud.fadeTo(0, 0.5);
    this.loaded = false;
  }

  /**
   * Load a chapter fresh (new game, chapter select) or from a checkpoint payload (continue, death).
   */
  load(chapterId: string, opts: { payload?: SavePayload | null; inventory?: Inventory; components?: ComponentId[]; replay?: string } = {}): void {
    const w = this.w;
    this.teardown();
    const level = LEVELS[chapterId]!, script = SCRIPTS[chapterId]!;
    this.level = level; this.script = script; w.chapterId = chapterId;
    const payload = opts.payload ?? null;
    this.restoring = !!payload;
    let spawn = level.spawn;
    let killed = new Set<string>();
    if (payload) {
      const r = w.checkpoint.restore(payload);
      w.inventory = structuredClone(r.inventory);
      spawn = r.extra.spawn; killed = new Set(r.extra.killed);
      w.counters = { ...r.extra.counters };
      this.chapterTime = r.extra.chapterTime;
      Object.assign(this.hud.prompts, r.extra.prompts);
      this.lastPayload = payload;
    } else {
      w.state.reset();
      w.graph.hydrate({ chapterId: null, beatId: null, completed: [] });
      w.inventory = opts.inventory ? structuredClone(opts.inventory) : freshInventory();
      if (opts.components) w.inventory.components = [...opts.components];
      w.counters = { takedowns: 0, lockdowns: 0, deaths: 0, startedAt: 0, kills: 0, shotsFired: 0 };
      this.chapterTime = 0;
      this.lastPayload = null;
      w.state.coreStability = CHAPTER_CORE[chapterId] ?? 72;
      // personal cache count carries across chapters for the final line's alternate take
      w.state.set('allPersonalCaches', PERSONAL_CACHE_IDS.every((id) => w.inventory.caches.includes(id)));
    }
    for (const id of w.inventory.caches) w.state.set(`cache.${id}`);
    for (const c of w.inventory.components) w.state.set(`component.${c}`);
    w.atmo.setCore(w.state.coreStability);
    w.atmo.setShadowSize(level.mech ? 220 : 60);
    w.shakeCap = level.mech ? FEEL.shakeCap.mech : FEEL.shakeCap.foot;
    w.shake.scale = w.options.reduceShake;

    // actors
    const ctx = new LevelContext(w, killed);
    level.build(ctx);
    ctx.finish();
    w.collapse.restore();
    w.gates.restore();
    if (spawn.mech || level.mech) {
      w.aegis = new Aegis(w);
      w.aegis.active = !!spawn.mech;
      // restore grace: never resume a checkpoint below half armor
      if (payload?.extra.aegis) { w.aegis.armor = Math.max(payload.extra.aegis.armor, w.aegis.armorMax * 0.5); for (const s of payload.extra.aegis.lost) w.aegis.lost.add(s as never); w.aegis.applyComponents(); }
      if (spawn.mech) w.aegis.spawn(new THREE.Vector3(...spawn.pos), spawn.yaw);
    }
    if (!spawn.mech) {
      w.player = new Ballast(w);
      w.player.spawn(new THREE.Vector3(...spawn.pos), spawn.yaw);
      w.player.health = Math.max(60, w.inventory.health);
    }
    this.ctx = this.scriptContext();
    w.graph.events.clear();
    if (!payload) w.graph.startChapter(chapterId);
    script.setup(this.ctx);
    this.loaded = true;
    // restoring into a Timed Zone restarts its clock from the zone checkpoint
    if (payload && payload.checkpointId.startsWith('zone:')) {
      const id = payload.checkpointId.slice(5);
      this.zonePayload = payload;
      w.zones.start(id, payload.checkpointId);
    }
    if (opts.replay) { this.replayOnly = true; w.sequences.play(opts.replay, { replay: true }); }
    else {
      this.replayOnly = false;
      if (!payload && script.intro) w.sequences.play(script.intro);
      if (!payload) this.saveCheckpoint('start');
    }
    this.ambientMusic();
    w.emit('loaded', chapterId);
  }

  private scriptContext(): ScriptContext {
    const w = this.w;
    return {
      w, session: this,
      play: (id) => w.sequences.play(id),
      beat: (id) => { w.graph.advance(id); },
      objective: (text, at) => this.setObjective(text, at),
      checkpoint: (id) => this.saveCheckpoint(id),
      say: (...ids) => w.dialogue.sayAll(ids),
      once: (flag) => { if (w.state.has(flag)) return false; w.state.set(flag); return true; },
      trigger: (id, min, max, fn, when) => w.triggers.add({ id, shape: { kind: 'box', min: { x: min[0], y: min[1], z: min[2] }, max: { x: max[0], y: max[1], z: max[2] } }, when, onEnter: fn }),
    };
  }

  setObjective(text: string, at?: [number, number, number]): void {
    this.w.objective = { text, pos: at ? new THREE.Vector3(...at) : null };
    this.w.state.set('objective', text);
    if (at) this.w.state.set('objectiveAt', at.join(','));
    this.hud.ping(text);
  }

  // ------------------------------------------------------------------ checkpoints
  saveCheckpoint(id: string, spawnOverride?: SpawnPoint): SavePayload {
    const w = this.w;
    let spawn: SpawnPoint = spawnOverride ?? this.level!.checkpoints[id] ?? (w.inMech ? { pos: w.aegis!.frame.pos.toArray() as [number, number, number], yaw: w.aegis!.frame.yaw, mech: true } : { pos: (w.player?.pos.toArray() ?? this.level!.spawn.pos) as [number, number, number], yaw: w.player?.cam.yaw ?? 0 });
    if (w.inMech) spawn = { ...spawn, mech: true };
    w.inventory.health = w.player?.health ?? w.inventory.health;
    const extra: CheckpointExtra = {
      chapterId: w.chapterId, spawn,
      killed: w.enemies.filter((e) => !e.alive).map((e) => e.key).concat(this.lastPayload?.extra.killed ?? []),
      counters: { ...w.counters }, chapterTime: this.chapterTime,
      aegis: w.aegis ? { armor: w.aegis.armor, lost: [...w.aegis.lost].filter((s) => s !== 'hardLock') } : null,
      prompts: { ...this.hud.prompts },
    };
    extra.killed = [...new Set(extra.killed)];
    const p = w.checkpoint.capture(id, w.inventory, extra);
    this.lastPayload = p;
    this.host.onCheckpoint(p);
    this.hud.checkpoint();
    this.audio.ui('ui.checkpoint', 0.5);
    return p;
  }

  private respawning = false;
  /** Death → fast, invisible: cut to the last checkpoint. */
  private respawn(payload: SavePayload | null): void {
    if (this.respawning) return;
    this.respawning = true;
    this.hud.fadeTo(1, 0.25);
    setTimeout(() => {
      const deaths = this.w.counters.deaths;
      const p = payload ?? this.lastPayload;
      if (p) { p.extra.counters.deaths = deaths; this.load(this.w.chapterId, { payload: p }); }
      else this.load(this.w.chapterId, { inventory: this.w.inventory });
      this.w.counters.deaths = deaths;
      this.hud.fadeTo(0, 0.35);
      this.respawning = false;
    }, 300);
  }

  private failZone(): void {
    const id = this.w.zones.active?.id;
    this.w.emit('zone:fail', id);
    this.respawn(this.zonePayload);
  }

  // ------------------------------------------------------------------ story actions
  run(a: StoryAction, skipping: boolean): void {
    const w = this.w;
    switch (a.kind) {
      case 'line': if (!skipping) w.dialogue.say(a.id, { channel: a.channel ?? 'story' }); break;
      case 'lines': if (!skipping) w.dialogue.sayAll(a.ids, { channel: a.channel ?? 'story' }); break;
      case 'shots': if (!skipping) this.playShots(a.shots, a.blendOut ?? 0.6); break;
      case 'flag': w.state.set(a.key, a.value ?? true); break;
      case 'core': w.state.coreStability = a.pct; w.atmo.setCore(a.pct); if (!skipping) this.hud.showCore(a.pct); break;
      case 'collapse': w.collapse.trigger(a.id); break;
      case 'objective': this.setObjective(a.text, a.at); break;
      case 'beat': w.graph.advance(a.id); break;
      case 'checkpoint': this.saveCheckpoint(a.id); break;
      case 'zone':
        if (a.op === 'start') { this.zonePayload = this.saveCheckpoint(`zone:${a.id}`); w.zones.start(a.id, `zone:${a.id}`); }
        else if (a.op === 'complete') w.zones.complete(a.id); else w.zones.stop();
        break;
      case 'music': w.state.set('music', a.cue ?? ''); if (a.cue) this.audio.music(a.cue); else this.audio.music(null); break;
      case 'sfx': this.audio.sfx(a.id, a.at ? new THREE.Vector3(...a.at) : null, 1); break;
      case 'call': this.script?.hooks?.[a.fn]?.(this.ctx, a.arg); break;
      case 'endChapter': this.completeChapter(); break;
      case 'control': if (w.player) w.player.setLocked(a.locked); if (w.aegis) w.aegis.scriptedLock = a.locked; break;
      case 'prompt': if (!skipping) this.hud.tutorialPrompt(`seq:${a.text}`, a.text, a.seconds ?? 5); break;
      case 'shake': if (!skipping) w.addShake(a.amount); break;
      case 'caption': if (!skipping) { const id = `cap${w.simTime}`; this.subs.show({ id, text: a.text, caption: true }); setTimeout(() => this.subs.hide(id), (a.seconds ?? 2.5) * 1000); } break;
      case 'fade': this.hud.fadeTo(a.to, skipping ? 0 : a.seconds); break;
      case 'mix': this.audio.mix(a.preset); break;
    }
  }

  private toPose(p: ShotSpec['from']): CamPose | (() => CamPose) {
    if (p === 'gameplay') return () => this.gameplayPose();
    if (typeof p === 'string') { const named = (this.script?.hooks?.[`pose:${p}`] as unknown as (() => CamPose) | undefined); return named ?? (() => this.gameplayPose()); }
    return { position: { x: p.p[0], y: p.p[1], z: p.p[2] }, target: { x: p.t[0], y: p.t[1], z: p.t[2] }, fov: p.fov ?? 50 };
  }

  playShots(shots: ShotSpec[], blendOut: number): void {
    const list: Shot[] = shots.map((s) => ({ id: s.id, duration: s.duration, from: this.toPose(s.from), to: s.to ? this.toPose(s.to) : undefined, ease: s.ease, blendIn: s.blendIn, shake: s.shake, letterbox: s.letterbox }));
    this.w.cinematic.play(list, { blendOut, onHandoff: () => this.w.emit('handoff') });
  }

  gameplayPose(): CamPose {
    const w = this.w;
    if (w.inMech) { const c = w.aegis!.cam; return { position: c.position.clone(), target: c.target.clone(), fov: c.fov }; }
    const c = w.player?.cam;
    if (!c) return { position: w.camera.position.clone(), target: w.camera.position.clone().add(new THREE.Vector3(0, 0, -1)), fov: w.camera.fov };
    return { position: c.position.clone(), target: c.target.clone(), fov: w.camera.fov };
  }

  completeChapter(): void {
    const w = this.w;
    const def = chapterById(w.chapterId);
    const caches = CACHES.filter((c) => c.chapter === w.chapterId);
    const comps = COMPONENT_IDS.filter((c) => ({ flightGovernor: 'ch3', missileRack: 'ch2', arcBlade: 'ch4' } as Record<string, string>)[c] === w.chapterId);
    const stats: ChapterStats = {
      seconds: Math.round(this.chapterTime), lockdowns: w.counters.lockdowns, takedowns: w.counters.takedowns,
      cachesFound: caches.filter((c) => w.inventory.caches.includes(c.id)).length, cachesTotal: caches.length,
      componentsSecured: comps.filter((c) => w.hasComponent(c)).length, componentsAvailable: comps.length, deaths: w.counters.deaths,
    };
    void def;
    w.state.set('allPersonalCaches', PERSONAL_CACHE_IDS.every((id) => w.inventory.caches.includes(id)));
    if (w.chapterId === 'ch6') this.host.onEnding();
    else this.host.onChapterComplete(stats, w.chapterId);
  }

  // ------------------------------------------------------------------ simulation step
  step(f: InputFrame): void {
    const w = this.w, dt = w.step;
    if (!this.loaded) return;
    w.simTime += dt;
    this.padActive = f.pad;
    (w as unknown as { padActive: boolean }).padActive = f.pad;
    this.chapterTime += dt;
    // hold-to-skip cinematics
    const cine = w.sequences.cinematic;
    if (cine && cine.def.skippable !== false && this.skip.update(f.down.has('skip') || f.down.has('ui_accept'), dt)) { w.sequences.skip(); w.dialogue.stopAll(); w.cinematic.stop(0); this.skip.reset(); }
    if (!cine) this.skip.reset();
    (w as unknown as { skipProgress: number }).skipProgress = this.skip.progress;
    w.sequences.update(dt);
    w.dialogue.tick(dt);

    if (w.ascent?.active) w.ascent.update(dt, f);
    else if (w.inMech) w.aegis!.update(dt, f);
    else if (w.player) {
      w.player.update(dt, f);
      w.interact.update(dt, f, !w.cinematic.controlLocked);
      if (f.pressed.has('ping')) this.hud.ping(w.objective.text || '');
      for (const ev of w.player.events) w.emit(`player:${ev}`);
    }
    if (f.pressed.has('ping') && w.inMech) this.hud.ping(w.objective.text || '');
    const focus = w.focusPos();
    const p = w.player;
    if (p && !w.inMech) w.perception.setTarget({ id: 'player', pos: p.pos, points: p.crouched || p.mode === 'slide' ? [1.0, 0.5] : [1.6, 1.0], visibility: p.visibility * w.hazards.flareBoost(p.pos) });
    else w.perception.setTarget({ id: 'player', pos: focus, points: [7], visibility: w.inMech ? 1 : 0 });
    w.perception.update(dt);
    for (const e of w.enemies) e.update(dt);
    for (const m of w.mechHostiles) m.update(dt);
    w.alert.update(dt);
    w.gates.update(dt);
    w.collapse.update(dt);
    w.hazards.update(dt);
    w.zones.update(dt);
    w.triggers.update({ x: focus.x, y: focus.y, z: focus.z });
    w.runUpdaters(dt);
    this.ambient(dt, focus);
    // death
    const dead = (p && p.mode === 'dead' && p.deadT > FEEL.death.slowmo) || (w.inMech && !w.aegis!.alive);
    if (dead) this.respawn(this.lastPayload);
    // adaptive music layers
    const lvl = w.alert.level();
    this.audio.setLayers({ suspicion: lvl >= 1 ? 1 : 0, hunted: lvl >= 2 ? 1 : 0, lockdown: lvl >= 3 ? 1 : 0 });
  }

  /** Ambient tremors and debris according to the world look (the planet is the clock). */
  private ambient(dt: number, focus: THREE.Vector3): void {
    const w = this.w, L = w.atmo.look;
    if (L.tremorEvery > 0 && L.tremorStrength > 0) {
      this.tremorT -= dt;
      if (this.tremorT <= 0) { this.tremorT = L.tremorEvery * (0.7 + w.rng.next() * 0.6); w.addShake(L.tremorStrength); this.audio.rumble(0.3 + L.tremorStrength * 2, 2.5); }
    }
    void focus; void this.debrisT;
  }

  // ------------------------------------------------------------------ presentation
  render(dt: number): void {
    const w = this.w;
    if (!this.loaded) return;
    if (w.player) { w.player.present(dt); w.player.updateCamera(dt); }
    if (w.aegis) { w.aegis.present(dt); if (w.inMech) w.aegis.updateCamera(dt); }
    for (const e of w.enemies) e.present(dt);
    for (const m of w.mechHostiles) m.present(dt);
    const gp = this.gameplayPose();
    const pose = w.cinematic.update(dt, gp);
    if (pose) {
      w.camera.position.set(pose.position.x, pose.position.y, pose.position.z);
      w.camera.lookAt(pose.target.x, pose.target.y, pose.target.z);
      if (pose.roll) w.camera.rotateZ(pose.roll);
      w.camera.fov = pose.fov; w.camera.updateProjectionMatrix();
    } else if (w.ascent?.active) w.ascent.camera(w.camera, dt, w.ascentView);
    else if (w.inMech) w.aegis!.cam.apply(w.camera);
    else if (w.player) w.player.cam.apply(w.camera, w);
    const focus = w.focusPos();
    w.atmo.update(dt, w.camera.position, focus);
    w.fx.flashScale = w.options.reduceFlashes ? 0.3 : 1;
    w.fx.update(dt);
    w.lights.update(w.camera.position);
    const yaw = w.inMech ? w.aegis!.frame.yaw : w.player?.cam.yaw ?? 0;
    this.audio.setListener(w.camera.position, yaw);
    this.audio.update(dt);
    this.hud.update(dt, w);
  }

  callHook(fn: string, arg?: unknown): void { this.script?.hooks?.[fn]?.(this.ctx, arg); }

  /** Dev/bot: jump to a beat by id (fires its sequence hook if the script names one). */
  devBeat(id: string): void { this.w.graph.goto(id, true); this.w.emit('dev:beat', id); }
  get lastCheckpoint(): SavePayload | null { return this.lastPayload; }
  get pad(): boolean { return this.padActive; }
}
