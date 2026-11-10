import * as THREE from 'three';
import {
  SLUWebShell, BrowserStorage, SettingsStore, SaveManager, BrowserPlatform, DOMGameUI, AudioMixer, AudioLifecycleCoordinator, CreditsRegistry, CheckpointManager, ResultsManager,
  defaultCoreSettings, tunables, type RendererAdapter, type UIScreenModel,
} from '@slu/web-shell';
import { PostStack, createPalette } from '@slu/web-shell/look/three';
import { installHeightFog, nightEnvironment } from '../render/atmosphere';
import { FilmLayer } from '../render/film';
import { resolveTier, tierSettings, quality, gpuName, type QualityTier } from '../render/quality';
import { SubtitleView } from '@slu/narrative';
import { GameInput, ACTIONS } from './Input';
import { Session, type SavePayload } from './Session';
import { AudioEngine } from '../audio/Engine';
import { Hud } from '../ui/Hud';
import { DEFAULT_OPTIONS, type GameOptions } from '../../data/options';
import { CHAPTERS, chapterById, gradeChapter, betterGrade, type Grade, type ChapterStats } from '../../data/chapters';
import { DIFFICULTY, type DifficultyId } from '../../data/enemies';
import { SCRIPTS } from '../story';
import { CACHES } from '../../data/caches';
import { freshInventory } from './World';
import { optionChoices, stepOption, type AllSettings } from '../ui/Options';
import { TitleScene } from '../ui/TitleScene';
import { CreditsRoll, CREDITS } from '../ui/Credits';
import { PLAYER } from '../../data/player';
import { installDevHooks } from '../dev/Hooks';
import { DevPanel } from '../dev/DevPanel';
import { Overlay } from '../dev/Overlay';
import { loadModelOverrides } from '../world/ModelOverrides';

export interface SlotData { chapterId: string; payload: SavePayload; difficulty: DifficultyId; savedAt: string; playSeconds: number }
export interface Profile { unlocked: string[]; grades: Record<string, Grade>; endingSeen: boolean; lastSlot: number; componentsFound?: string[]; cachesFound?: string[] }
const SAVE_SCHEMA = 1;

type Mode = 'splash' | 'menu' | 'loading' | 'playing' | 'paused' | 'results' | 'credits' | 'ending';

/**
 * The game application: shell lifecycle + platform, saves (three slots + profile), settings,
 * menus (shell DOMGameUI), audio contracts, results and credits, and the fixed-step loop.
 */
export class App {
  readonly canvas: HTMLCanvasElement;
  readonly renderer: THREE.WebGLRenderer;
  post!: PostStack;
  film!: FilmLayer;
  readonly platform = new BrowserPlatform();
  readonly storage = new BrowserStorage('no-extraction');
  settings!: SettingsStore<AllSettings>;
  shell!: SLUWebShell<AllSettings>;
  input!: GameInput;
  audio = new AudioEngine();
  mixer!: AudioMixer;
  hud!: Hud;
  subs!: SubtitleView;
  session!: Session;
  ui!: DOMGameUI;
  title!: TitleScene;
  credits = new CreditsRegistry();
  checkpoints = new CheckpointManager<SavePayload>();
  results = new ResultsManager();
  slots: SaveManager<SlotData>[] = [];
  profileSave!: SaveManager<Profile>;
  profile: Profile = { unlocked: ['ch1'], grades: {}, endingSeen: false, lastSlot: 0 };
  mode: Mode = 'splash';
  slot = 0;
  difficulty: DifficultyId = 'normal';
  private acc = 0;
  private last = performance.now();
  private optionsPage: 'gameplay' | 'controls' | 'accessibility' | 'audio' | 'video' = 'gameplay';
  private optionsBack = 'title';
  private pendingNewSlot = 0;
  private lastStats: { stats: ChapterStats; chapterId: string } | null = null;
  private rollingCredits: CreditsRoll | null = null;
  private overlay!: Overlay;
  devPanel!: DevPanel;
  /** Headless bot: render every Nth frame, run sim faster. */
  readonly fast = new URLSearchParams(location.search).has('fast');
  readonly headless = new URLSearchParams(location.search).has('headless');
  frameCount = 0;
  private rebindTarget: string | null = null;
  bot: import('../dev/Bot').Bot | null = null;
  private ignoreBackUntil = 0;

  constructor(readonly root: HTMLElement) {
    // height fog replaces three's fog chunks: must happen before any material compiles
    installHeightFog(0, 0.05);
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'nx-canvas';
    root.appendChild(this.canvas);
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.3;
    this.renderer.info.autoReset = false;
  }

  async boot(): Promise<void> {
    this.settings = new SettingsStore<AllSettings>(this.storage, 'settings', { ...defaultCoreSettings, ...DEFAULT_OPTIONS });
    await this.settings.load();
    const tier = resolveTier(this.settings.snapshot().graphics ?? 'auto', this.renderer);
    console.info(`render quality: ${tier} (gpu: ${gpuName()})`);
    const adapter: RendererAdapter = {
      id: 'three',
      resize: (w, h, dpr) => this.resize(w, h, dpr),
      suspend: () => this.audio.pauseAll(),
      resume: () => this.audio.resumeAll(),
      loadLevel: (id, payload) => this.startChapter(id, payload as { payload?: SavePayload; replay?: string } | undefined),
      unloadLevel: () => { this.session.w.sequences.stopAll(); },
    };
    this.shell = new SLUWebShell({ build: { gameId: 'no-extraction', gameName: 'NO EXTRACTION', version: '0.1.0' }, renderer: adapter, settings: this.settings });
    this.shell.difficulty.register(Object.values(DIFFICULTY).map((d) => ({ id: d.id, label: d.label, multipliers: { enemyDamage: d.enemyDamage, playerDamage: d.playerDamage } })));
    this.credits.set(CREDITS);
    for (let i = 0; i < 3; i++) this.slots.push(new SaveManager<SlotData>(this.storage, `slot${i + 1}`, SAVE_SCHEMA, {}));
    this.profileSave = new SaveManager<Profile>(this.storage, 'profile', SAVE_SCHEMA, {});
    const prof = await this.profileSave.loadWithRecovery();
    if (prof.data) this.profile = { ...this.profile, ...prof.data };

    const overrides = await loadModelOverrides();
    if (overrides.length) console.info('model overrides:', overrides.join(', '));
    const opts = this.settings.snapshot();
    this.input = new GameInput(this.canvas, opts);
    this.hud = new Hud(this.root);
    this.subs = new SubtitleView(this.root);
    this.mixer = new AudioMixer(this.audio);
    const life = new AudioLifecycleCoordinator(this.audio); life.installVisibility();
    this.shell.events.on('game:pause', () => life.setGamePaused(true));
    this.shell.events.on('game:resume', () => life.setGamePaused(false));
    this.session = new Session(this.audio, this.hud, this.subs, opts, {
      onCheckpoint: (p) => void this.persist(p),
      onChapterComplete: (stats, id) => this.chapterComplete(stats, id),
      onEnding: () => this.ending(),
    });
    this.post = new PostStack(this.renderer, this.session.w.scene, this.session.w.camera, tunables, createPalette({ void: '#0b1118', 'void.deep': '#04070a', highlight: '#f4f7ff' }));
    this.film = new FilmLayer(this.post, this.session.w.scene, this.session.w.camera);
    this.film.setTier(this.headless ? 'low' : tier);
    tunables.set('look.post', 'grainAmount', 0.02);
    tunables.set('look.post', 'bloomThreshold', 0.82);
    // image-based fill so metals read at night: the lookdev night dome with lamp and moon cards
    this.session.w.scene.environment = nightEnvironment(this.renderer);
    this.session.w.scene.environmentIntensity = 0.5;
    this.session.w.postFx = (kind, amount) => {
      if (kind === 'radialBlur') this.post.distort(0.5, 0.5, { strength: amount * 12, life: 0.35, speed: 1.6 });
      else if (kind === 'chromatic') this.post.pulse('chromatic.hit', amount);
      else this.post.pulse('flash', amount);
    };
    this.title = new TitleScene(this.profile.endingSeen);
    this.applySettings(opts);
    this.settings.events.on('changed', (s) => this.applySettings(s));
    this.ui = new DOMGameUI({ root: this.menuRoot(), input: this.input.manager, theme: { fontFamily: "'Barlow Condensed','Arial Narrow',system-ui,sans-serif", radius: 2, panelOpacity: 0.72, maxWidth: 720 }, onActivate: (s, c) => this.onMenu(s, c), onBack: (s) => this.onBack(s) });
    this.ui.register(this.screens());
    this.platform.onResize((w, h, dpr) => this.resize(w, h, dpr));
    this.platform.onVisibilityChange((hidden) => { if (hidden && this.mode === 'playing') this.pause(); });
    this.canvas.addEventListener('click', () => { if (this.mode === 'playing') void this.platform.requestPointerLock(this.canvas); });
    document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && this.mode === 'playing' && !this.input.scripted && !this.headless) this.pause(); });
    this.overlay = new Overlay(this);
    this.devPanel = new DevPanel(this);
    installDevHooks(this);
    await this.shell.boot();
    this.ui.startInputLoop();
    this.loop();
    this.splash();
  }

  private menuRoot(): HTMLElement {
    const m = document.createElement('div'); m.className = 'nx-menu'; this.root.appendChild(m);
    // the shell UI already activates on Enter/Space via the semantic input layer: suppress the
    // browser's native button click for those keys so a press activates exactly once
    m.addEventListener('keydown', (e) => { if (e.code === 'Enter' || e.code === 'Space') e.preventDefault(); }, true);
    return m;
  }

  applySettings(s: AllSettings): void {
    const w = this.session.w;
    w.options = s;
    this.input.sens = { mouse: PLAYER.camera.mouseSens * s.mouseSensitivity, pad: PLAYER.camera.padSens * s.padSensitivity, invertY: s.invertY };
    this.subs.apply({ enabled: s.subtitles, size: s.subtitleSize, background: s.subtitleBackground, speakerColors: s.speakerColors, captions: s.captions });
    this.hud.setColorblind(s.colorblind);
    w.shake.scale = s.reduceShake;
    this.post.accessibility = { flashes: s.reduceFlashes ? 0.3 : 1, reducedMotion: s.reducedMotion };
    tunables.set('look.post', 'distortion', !s.reduceBlur);
    this.audio.setBusVolume('master', s.masterVolume); this.audio.setBusVolume('music', s.musicVolume); this.audio.setBusVolume('sfx', s.sfxVolume); this.audio.setBusVolume('voice', s.voVolume); this.audio.setBusVolume('ambience', s.ambienceVolume);
    this.difficulty = s.difficulty; this.session.setDifficulty(s.difficulty);
    this.applyGraphics(s.graphics ?? 'auto');
    if (s.fullscreen && !document.fullscreenElement) void this.platform.requestFullscreen().catch(() => {});
    if (!s.fullscreen && document.fullscreenElement) void this.platform.exitFullscreen();
  }

  /** Live part of a quality change (post resolution, AO, pixel ratio). Texture and shadow sizes follow on the next load. */
  private applyGraphics(choice: 'auto' | 'low' | 'high'): void {
    const before: QualityTier = quality();
    const t = resolveTier(choice, this.renderer);
    this.film?.setTier(this.headless ? 'low' : t);
    if (t !== before) this.resize(innerWidth, innerHeight, devicePixelRatio);
  }

  resize(w: number, h: number, dpr: number): void {
    const ratio = Math.min(dpr, this.headless ? 1 : tierSettings().maxPixelRatio);
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(w, h, false);
    this.post?.resize(w, h, ratio);
    for (const cam of [this.session?.w.camera, this.title?.camera]) if (cam) { cam.aspect = w / h; cam.updateProjectionMatrix(); }
  }

  // ------------------------------------------------------------------ menus
  private screens(): UIScreenModel[] {
    return [
      { id: 'title', title: '', choices: [] },
      { id: 'slots', title: 'Save slot', choices: [], backTarget: 'title' },
      { id: 'difficulty-select', title: 'Difficulty', choices: Object.values(DIFFICULTY).map((d) => ({ id: d.id, label: d.label, description: d.id === 'story' ? 'For players who want the story. Gentle combat, wider timers.' : d.id === 'hard' ? 'Faster detection, shorter telegraphs.' : 'As designed.' })), backTarget: 'slots' },
      { id: 'chapter-select', title: 'Chapter Select', choices: [], backTarget: 'title' },
      { id: 'chapter', title: '', choices: [], backTarget: 'chapter-select' },
      { id: 'options', title: 'Options', choices: [], backTarget: 'title' },
      { id: 'options-page', title: '', choices: [], backTarget: 'options' },
      { id: 'controls', title: 'Controls', choices: [], backTarget: 'options' },
      { id: 'pause', title: 'Paused', choices: [{ id: 'resume', label: 'Resume' }, { id: 'restart', label: 'Restart from checkpoint' }, { id: 'options', label: 'Options' }, { id: 'quit', label: 'Quit to title' }] },
      { id: 'results', title: '', choices: [{ id: 'continue', label: 'Continue' }] },
      { id: 'confirm-overwrite', title: 'Overwrite this slot?', choices: [{ id: 'yes', label: 'Overwrite' }, { id: 'no', label: 'Cancel' }], backTarget: 'slots' },
    ];
  }

  private async slotInfo(): Promise<(SlotData | null)[]> { return Promise.all(this.slots.map(async (s) => (await s.loadWithRecovery()).data)); }

  async showTitle(): Promise<void> {
    this.mode = 'menu';
    this.shell.session.setPhase('menu');
    this.hud.setVisible(false);
    this.title.planetGone = this.profile.endingSeen;
    const has = (await this.slotInfo()).some(Boolean);
    this.ui.updateScreen('title', { title: 'NO EXTRACTION', subtitle: 'Four minutes late. Left on schedule.', choices: [
      { id: 'new', label: 'New Game' }, { id: 'continue', label: 'Continue', disabled: !has }, { id: 'chapters', label: 'Chapter Select' }, { id: 'options', label: 'Options' }, { id: 'credits', label: 'Credits' },
    ] });
    this.showMenu('title');
    this.audio.music('title');
  }

  showMenu(id: string): void { this.menuEl().style.display = 'block'; this.ui.show(id); this.input.flush(); this.audio.ui('ui.tick', 0.6); }
  hideMenu(): void { this.menuEl().style.display = 'none'; }
  private menuEl(): HTMLElement { return this.root.querySelector('.nx-menu') as HTMLElement; }

  private async onMenu(screen: string, choice: string): Promise<void> {
    if ((window as unknown as { __menuLog?: string[] }).__menuLog) (window as unknown as { __menuLog: string[] }).__menuLog.push(`${screen}:${choice}:${this.mode}`);
    void this.audio.unlock();
    this.audio.ui('ui.confirm', 0.7);
    if (screen === 'title') {
      if (choice === 'new') await this.showSlots();
      else if (choice === 'continue') await this.continueGame();
      else if (choice === 'chapters') this.showChapterSelect();
      else if (choice === 'options') { this.optionsBack = 'title'; this.showOptions(); }
      else if (choice === 'credits') this.rollCredits(false);
    } else if (screen === 'slots') {
      this.pendingNewSlot = Number(choice);
      const info = (await this.slotInfo())[this.pendingNewSlot];
      if (info) this.showMenu('confirm-overwrite'); else this.showMenu('difficulty-select');
    } else if (screen === 'confirm-overwrite') {
      if (choice === 'yes') this.showMenu('difficulty-select'); else await this.showSlots();
    } else if (screen === 'difficulty-select') {
      await this.settings.patch({ difficulty: choice as DifficultyId });
      this.slot = this.pendingNewSlot;
      this.profile.lastSlot = this.slot; void this.saveProfile();
      this.launch('ch1');
    } else if (screen === 'chapter-select') {
      this.showChapter(choice);
    } else if (screen === 'chapter') {
      const [kind, id] = choice.split(':');
      if (kind === 'play') this.launch(id!, { fromSelect: true });
      else if (kind === 'replay') this.launch(this.chapterForSequence(id!), { replay: id });
    } else if (screen === 'options') {
      if (choice === 'controls') this.showControls();
      else if (choice === 'reset') { await this.settings.reset({ ...defaultCoreSettings, ...DEFAULT_OPTIONS }); this.input.rebind(this.settings.snapshot()); this.showOptions(); }
      else { this.optionsPage = choice as typeof this.optionsPage; this.showOptionsPage(); }
    } else if (screen === 'options-page') {
      const patch = stepOption(choice, 1, this.settings.snapshot());
      if (patch) { await this.settings.patch(patch); this.showOptionsPage(true); }
    } else if (screen === 'controls') {
      if (choice === 'reset') { await this.settings.patch({ bindings: {} }); this.input.rebind(this.settings.snapshot()); this.showControls(); }
      else this.beginRebind(choice);
    } else if (screen === 'pause') {
      if (choice === 'resume') this.resume();
      else if (choice === 'restart') { this.resume(); this.session.load(this.session.w.chapterId, { payload: this.session.lastCheckpoint }); }
      else if (choice === 'options') { this.optionsBack = 'pause'; this.showOptions(); }
      else if (choice === 'quit') { this.shell.quit(); this.session.w.sequences.stopAll(); this.session.w.dialogue.stopAll(); this.subs.clear(); this.hud.fadeTo(0, 0); await this.showTitle(); }
    } else if (screen === 'results') {
      this.nextChapter();
    }
  }

  private onBack(screen: string): void {
    if (this.frameCount <= this.ignoreBackUntil) return; // the press that opened this menu is not also a 'back' (the shell UI tick reads input one frame later)
    this.audio.ui('ui.back', 0.6);
    if (this.rebindTarget) return;
    if (screen === 'pause') { this.resume(); return; }
    if (screen === 'options') { if (this.optionsBack === 'pause') this.showMenu('pause'); else void this.showTitle(); return; }
    if (screen === 'options-page' || screen === 'controls') { this.showOptions(); return; }
    if (screen === 'title' || screen === 'results') return;
    if (screen === 'slots' || screen === 'chapter-select') { void this.showTitle(); return; }
    if (screen === 'chapter') { this.showChapterSelect(); return; }
    if (screen === 'difficulty-select' || screen === 'confirm-overwrite') { void this.showSlots(); return; }
  }

  /** Left/right adjust the focused option (DOMGameUI handles up/down/accept/back). */
  private menuAdjust(dir: number): void {
    const f = this.menuEl().querySelector<HTMLButtonElement>('[data-focused="true"]');
    const id = f?.dataset.choiceId; if (!id || !id.startsWith('opt:')) return;
    const patch = stepOption(id, dir, this.settings.snapshot());
    if (patch) void this.settings.patch(patch).then(() => this.showOptionsPage(true));
    this.audio.ui('ui.tick', 0.6);
  }

  private async showSlots(): Promise<void> {
    const info = await this.slotInfo();
    this.ui.updateScreen('slots', { choices: info.map((d, i) => ({ id: String(i), label: `Slot ${i + 1}`, description: d ? `${chapterById(d.chapterId).number} · ${chapterById(d.chapterId).title} · ${DIFFICULTY[d.difficulty].label} · ${new Date(d.savedAt).toLocaleString()}` : 'Empty' })) });
    this.showMenu('slots');
  }

  private showChapterSelect(): void {
    this.ui.updateScreen('chapter-select', { choices: CHAPTERS.map((c) => ({ id: c.id, label: `${c.number}  ${c.title}`, description: this.profile.unlocked.includes(c.id) ? `Grade ${this.profile.grades[c.id] ?? '—'}` : 'Locked', disabled: !this.profile.unlocked.includes(c.id) })) });
    this.showMenu('chapter-select');
  }

  private showChapter(id: string): void {
    const c = chapterById(id);
    const seqs = SCRIPTS[id]!.sequences.filter((s) => s.replayable && this.profile.unlocked.includes(id));
    this.ui.updateScreen('chapter', { title: `${c.number}  ${c.title}`, subtitle: `Grade ${this.profile.grades[id] ?? '—'}`, choices: [{ id: `play:${id}`, label: 'Play chapter' }, ...seqs.map((s) => ({ id: `replay:${s.id}`, label: `Cinematic: ${s.title ?? s.id}` }))] });
    this.showMenu('chapter');
  }
  private chapterForSequence(seqId: string): string { for (const [ch, s] of Object.entries(SCRIPTS)) if (s.sequences.some((q) => q.id === seqId)) return ch; return 'ch1'; }

  private showOptions(): void {
    this.ui.updateScreen('options', { choices: [{ id: 'gameplay', label: 'Gameplay' }, { id: 'controls', label: 'Controls' }, { id: 'controlsSettings', label: 'Input' }, { id: 'accessibility', label: 'Accessibility' }, { id: 'audio', label: 'Audio' }, { id: 'video', label: 'Video' }, { id: 'reset', label: 'Reset to defaults' }].map((c) => c.id === 'controlsSettings' ? { ...c, id: 'controls_settings' } : c) });
    this.showMenu('options');
  }
  private showOptionsPage(keep = false): void {
    const page = this.optionsPage === ('controls_settings' as never) ? 'controls' : this.optionsPage;
    this.ui.updateScreen('options-page', { title: page[0]!.toUpperCase() + page.slice(1), choices: optionChoices(page, this.settings.snapshot()) });
    if (!keep) this.showMenu('options-page');
  }

  private showControls(): void {
    const s = this.settings.snapshot();
    const bound = (a: (typeof ACTIONS)[number]) => { const o = s.bindings[a.action]; const keys = o?.keys ?? a.keys; const mouse = o?.mouse ?? a.mouse ?? []; const pad = o?.pad ?? a.pad ?? []; return `${[...keys.map((k) => k.replace('Key', '').replace('Digit', '')), ...mouse.map((m) => ['LMB', 'MMB', 'RMB'][m])].join(' / ') || '—'}   ·   pad ${pad.join('/') || '—'}`; };
    this.ui.updateScreen('controls', { choices: [...ACTIONS.filter((a) => a.rebindable).map((a) => ({ id: a.action, label: `${a.context === 'mech' ? 'Mech: ' : ''}${a.label}`, description: this.rebindTarget === a.action ? 'Press a key, mouse button or pad button…' : bound(a) })), { id: 'reset', label: 'Reset controls' }] });
    this.showMenu('controls');
  }

  private beginRebind(action: string): void {
    this.rebindTarget = action;
    this.showControls();
    const finish = async (b: { keys?: string[]; mouse?: number[]; pad?: number[] }) => {
      removeEventListener('keydown', onKey, true); removeEventListener('mousedown', onMouse, true); clearInterval(padTimer);
      const s = this.settings.snapshot(); const def = ACTIONS.find((a) => a.action === action)!;
      const cur = s.bindings[action] ?? { keys: def.keys, mouse: def.mouse ?? [], pad: def.pad ?? [] };
      const next = { keys: b.keys ?? (b.mouse ? [] : cur.keys), mouse: b.mouse ?? (b.keys ? [] : cur.mouse), pad: b.pad ?? cur.pad };
      await this.settings.patch({ bindings: { ...s.bindings, [action]: next } });
      this.input.rebind(this.settings.snapshot());
      setTimeout(() => { this.rebindTarget = null; this.showControls(); this.input.flush(); }, 50);
    };
    const onKey = (e: KeyboardEvent) => { e.preventDefault(); e.stopPropagation(); if (e.code === 'Escape') { void finish({}); return; } void finish({ keys: [e.code] }); };
    const onMouse = (e: MouseEvent) => { e.preventDefault(); e.stopPropagation(); void finish({ mouse: [e.button] }); };
    let prev = this.input.manager.actions().length;
    const padTimer = setInterval(() => {
      // pad: use the shell input manager — first ui-agnostic pad button newly down
      for (const a of ACTIONS) if (a.pad && this.input.manager.wasPressed(a.action) && !['ui_accept'].includes(a.action)) { void finish({ pad: a.pad.slice(0, 1) }); return; }
      prev++;
    }, 16);
    setTimeout(() => { addEventListener('keydown', onKey, true); addEventListener('mousedown', onMouse, true); }, 150);
  }

  // ------------------------------------------------------------------ flow
  private splash(): void {
    const s = document.createElement('div'); s.className = 'nx-splash'; s.innerHTML = '<div><small>SOULFIRE LEGENDS UNIVERSE</small><h1>NO EXTRACTION</h1><p>Press any key</p></div>';
    this.root.appendChild(s);
    const go = () => { removeEventListener('keydown', go); removeEventListener('mousedown', go); clearInterval(t); void this.audio.unlock().then(() => this.audio.music('title')); s.classList.add('out'); setTimeout(() => s.remove(), 800); setTimeout(() => void this.showTitle(), 250); };
    const t = setInterval(() => { if (this.input.manager.wasPressed('ui_accept') || this.input.manager.wasPressed('pause')) go(); }, 30);
    addEventListener('keydown', go); addEventListener('mousedown', go);
    if (this.headless) go();
  }

  async continueGame(): Promise<void> {
    const info = await this.slotInfo();
    let best = -1, bt = 0;
    info.forEach((d, i) => { if (d && Date.parse(d.savedAt) > bt) { bt = Date.parse(d.savedAt); best = i; } });
    if (best < 0) return;
    const d = info[best]!;
    this.slot = best;
    await this.settings.patch({ difficulty: d.difficulty });
    this.launch(d.chapterId, { payload: d.payload });
  }

  launch(chapterId: string, o: { payload?: SavePayload; replay?: string; fromSelect?: boolean } = {}): void {
    void this.audio.unlock();
    this.hideMenu();
    this.mode = 'loading';
    void this.shell.loadLevel(chapterId, o);
  }

  private startChapter(id: string, o: { payload?: SavePayload; replay?: string; fromSelect?: boolean } = {}): void {
    this.hud.setVisible(true);
    this.hud.fadeTo(1, 0);
    // chapter select: the chapter's loadout, plus components/caches this profile has ever found before it
    const inv = o.payload ? undefined : o.fromSelect || o.replay ? this.selectLoadout(id) : undefined;
    this.session.load(id, { payload: o.payload ?? null, inventory: inv, replay: o.replay });
    this.checkpoints.clear();
    const c = chapterById(id);
    if (!o.payload && !o.replay) { this.hud.chapterCard(c.number, c.title); this.audio.ui('ui.title', 1); }
    this.hud.fadeTo(0, 1.2);
    this.mode = 'playing';
    this.shell.session.setPhase('playing');
    this.input.flush();
    if (!this.headless) void this.platform.requestPointerLock(this.canvas);
    if (o.replay) this.session.w.on('replay:end', () => { void this.showTitle(); this.showChapter(id); });
  }

  private selectLoadout(id: string): import('./World').Inventory {
    const n = chapterById(id).number;
    const inv = freshInventory();
    if (n >= 3) { inv.weapons.push('carbine'); inv.ammo.carbine = { mag: 30, reserve: 60 }; }
    if (n >= 4) { inv.weapons.push('shotgun'); inv.ammo.shotgun = { mag: 6, reserve: 12 }; }
    const compChapter: Record<string, number> = { missileRack: 2, flightGovernor: 3, arcBlade: 4 };
    inv.components = (this.profile.componentsFound ?? []).filter((c) => compChapter[c]! < n) as typeof inv.components;
    inv.caches = (this.profile.cachesFound ?? []).filter((c) => { const ch = CACHES.find((x) => x.id === c)?.chapter; return ch ? chapterById(ch).number < n : false; });
    if (n === 6) inv.aegisLost = ['leftArm', 'shoulderCannon'];
    return inv;
  }

  pause(): void {
    if (this.mode !== 'playing') return;
    this.mode = 'paused';
    this.shell.pause();
    this.session.w.sequences.pause(); this.session.w.dialogue.pause(); this.audio.stopVoice();
    this.platform.exitPointerLock();
    this.ignoreBackUntil = this.frameCount + 2;
    this.showMenu('pause');
  }
  resume(): void {
    if (this.mode !== 'paused') return;
    this.hideMenu();
    this.mode = 'playing';
    this.shell.resume();
    this.session.w.sequences.resume(); this.session.w.dialogue.resume();
    this.input.flush();
    if (!this.headless) void this.platform.requestPointerLock(this.canvas);
  }

  private async persist(p: SavePayload): Promise<void> {
    this.checkpoints.save(p.checkpointId, p);
    if (this.session.replayOnly) return;
    await this.slots[this.slot]!.save({ chapterId: p.extra.chapterId, payload: p, difficulty: this.difficulty, savedAt: new Date().toISOString(), playSeconds: Math.round(p.extra.chapterTime) });
  }
  private async saveProfile(): Promise<void> { await this.profileSave.save(this.profile); }

  private chapterComplete(stats: ChapterStats, id: string): void {
    if (this.session.replayOnly) return;
    const def = chapterById(id);
    const { grade, score } = gradeChapter(def, stats);
    const res = this.results.build({ ...stats }, { score, timeMs: stats.seconds * 1000, metadata: { grade, chapter: id } });
    this.profile.grades[id] = betterGrade(this.profile.grades[id], grade);
    const inv = this.session.w.inventory;
    this.profile.componentsFound = [...new Set([...(this.profile.componentsFound ?? []), ...inv.components])];
    this.profile.cachesFound = [...new Set([...(this.profile.cachesFound ?? []), ...inv.caches])];
    const next = SCRIPTS[id] ? CHAPTERS[def.number]?.id : undefined;
    if (next && !this.profile.unlocked.includes(next)) this.profile.unlocked.push(next);
    void this.saveProfile();
    this.lastStats = { stats, chapterId: id };
    this.mode = 'results';
    this.shell.session.setPhase('results');
    this.platform.exitPointerLock();
    const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    const lines = [`Time  ${fmt(stats.seconds)}`, `Lockdowns  ${stats.lockdowns}`, `Takedowns  ${stats.takedowns}`, `Caches  ${stats.cachesFound} / ${stats.cachesTotal}`, `Components  ${stats.componentsSecured} / ${stats.componentsAvailable}`];
    this.ui.updateScreen('results', { title: `${def.number}  ${def.title}`, subtitle: `Grade ${grade}`, choices: [...lines.map((l, i) => ({ id: `stat${i}`, label: l, disabled: true })), { id: 'continue', label: 'Continue' }] });
    this.showMenu('results');
    void res;
    // auto-save at the chapter break: next chapter start
    if (next) { const inv = this.session.w.inventory; void this.slots[this.slot]!.save({ chapterId: next, payload: this.session.w.checkpoint.capture('start', inv, { chapterId: next, spawn: { pos: [0, 0, 0], yaw: 0 }, killed: [], counters: { takedowns: 0, lockdowns: 0, deaths: 0, startedAt: 0, kills: 0, shotsFired: 0 }, chapterTime: 0, aegis: null, prompts: { ...this.hud.prompts } }) as SavePayload, difficulty: this.difficulty, savedAt: new Date().toISOString(), playSeconds: 0 }); }
  }

  private nextChapter(): void {
    const id = this.lastStats?.chapterId ?? this.session.w.chapterId;
    const next = CHAPTERS[chapterById(id).number]?.id;
    if (!next || !SCRIPTS[next]) { void this.showTitle(); return; }
    const inv = this.session.w.inventory;
    this.hideMenu();
    this.mode = 'loading';
    this.hud.setVisible(true);
    this.session.load(next, { inventory: inv });
    const c = chapterById(next);
    this.hud.chapterCard(c.number, c.title); this.audio.ui('ui.title', 1);
    this.hud.fadeTo(0, 1.2);
    this.mode = 'playing';
    this.input.flush();
    if (!this.headless) void this.platform.requestPointerLock(this.canvas);
  }

  private ending(): void {
    this.profile.endingSeen = true;
    if (!this.profile.unlocked.includes('ch6')) this.profile.unlocked.push('ch6');
    void this.saveProfile();
    this.mode = 'ending';
    this.platform.exitPointerLock();
    this.rollCredits(true);
  }

  rollCredits(fromEnding: boolean): void {
    this.hideMenu();
    this.mode = 'credits';
    this.hud.setVisible(fromEnding);
    if (fromEnding) this.hud.fadeTo(1, 0);
    this.audio.mix('normal');
    this.audio.music('credits');
    this.rollingCredits = new CreditsRoll(this.root, this.credits.snapshot(), () => { this.rollingCredits = null; this.title.planetGone = this.profile.endingSeen; this.hud.fadeTo(0, 0); void this.showTitle(); });
  }

  // ------------------------------------------------------------------ loop
  private loop = (): void => {
    requestAnimationFrame(this.loop);
    const now = performance.now();
    const real = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.frameCount++;
    this.renderer.info.reset();
    this.input.poll(real);
    if (this.mode === 'menu' || this.mode === 'results' || this.mode === 'paused') {
      if (this.input.manager.wasPressed('ui_left')) this.menuAdjust(-1);
      if (this.input.manager.wasPressed('ui_right')) this.menuAdjust(1);
      if (this.input.manager.wasPressed('ui_down') || this.input.manager.wasPressed('ui_up')) this.audio.ui('ui.tick', 0.4);
    }
    if (this.mode === 'credits') { this.rollingCredits?.update(real, this.input.manager.isDown('ui_accept') || this.input.manager.isDown('skip')); }
    const w = this.session.w;
    const inGame = this.mode === 'playing' || this.mode === 'loading' || this.mode === 'ending';
    if (this.mode === 'playing') {
      const f0 = this.input.manager;
      if (f0.wasPressed('pause') && !this.devPanel.open) { this.pause(); return; }
      if (f0.wasPressed('dev')) this.devPanel.toggle();
      const steps = this.fast ? 8 : 1;
      for (let k = 0; k < steps; k++) {
        const ts = w.time.step(real);
        this.acc += ts.simDt;
        let n = 0;
        while (this.acc >= w.step && n < 5) { if (this.bot?.status) this.bot.beforeStep(w.step); this.session.step(this.input.frame(w.step)); this.acc -= w.step; n++; }
        if (n === 5) this.acc = 0;
        if (k < steps - 1) this.session.render(ts.presentationDt);
      }
    }
    if (inGame && this.session.loaded) {
      const pd = Math.max(0.0001, real * w.time.currentScale());
      this.session.render(pd);
      const desat = this.hud.dead;
      this.canvas.style.filter = desat > 0 ? `saturate(${1 - desat * 0.85}) brightness(${1 - desat * 0.2})` : '';
      if (!this.headless || this.frameCount % 15 === 0) { this.post.setCamera(w.camera); this.film.update(now / 1000, w.camera, w.cineFocus); this.post.update(real, now / 1000); this.post.render(); }
    } else {
      this.title.update(real);
      this.renderer.render(this.title.scene, this.title.camera);
    }
    this.overlay.update(real);
  };
}
