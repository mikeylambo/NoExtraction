import * as THREE from 'three';
import type { AudioSystem } from '@slu/web-shell';
import { SFX, MIX } from '../../data/audio';
import { RECIPES, type Recipe, type Layer } from './Recipes';
import { Score } from './Score';

type Bus = 'master' | 'music' | 'sfx' | 'ui' | 'voice' | 'ambience' | 'keep';
const dbToGain = (db: number) => Math.pow(10, db / 20);

/**
 * WebAudio engine implementing the shell's AudioSystem contract. Semantic SFX ids → file (if one
 * exists at the manifest path) or the synth recipe. Buses, ducking, positional panning, the
 * adaptive score, VO playback and the atmosphere-break silence.
 */
export class AudioEngine implements AudioSystem {
  ctx: AudioContext | null = null;
  private buses = new Map<Bus, GainNode>();
  private duckers = new Map<Bus, GainNode>();
  private buffers = new Map<string, AudioBuffer>();
  private fileBuffers = new Map<string, AudioBuffer | null>();
  private listener = new THREE.Vector3();
  private listenerYaw = 0;
  private volumes: Record<string, number> = { master: 1, music: 0.8, sfx: 0.9, ui: 0.9, voice: 1, ambience: 0.8 };
  private muted = false;
  score: Score | null = null;
  private rumbleNode: { src: AudioBufferSourceNode; g: GainNode } | null = null;
  private voiceSrc: AudioBufferSourceNode | null = null;
  private silence = false;
  ready = false;
  /** Count of SFX played (dev overlay). */
  played = 0;

  /** Must be called from a user gesture (browser autoplay rules). */
  async unlock(): Promise<void> {
    if (this.ctx) { if (this.ctx.state === 'suspended') await this.ctx.resume(); return; }
    const ctx = new AudioContext();
    this.ctx = ctx;
    const master = ctx.createGain(); master.connect(ctx.destination);
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -10; comp.ratio.value = 4; comp.connect(master);
    this.buses.set('master', master);
    for (const b of ['music', 'sfx', 'ui', 'voice', 'ambience', 'keep'] as Bus[]) {
      const g = ctx.createGain(); const d = ctx.createGain();
      g.connect(d); d.connect(b === 'keep' ? master : comp);
      this.buses.set(b, g); this.duckers.set(b, d);
    }
    this.applyVolumes();
    for (const s of SFX) {
      const r = RECIPES[s.id];
      if (r) this.buffers.set(s.id, await this.render(r));
    }
    for (const id of ['radio.click', 'voice.mumble']) this.buffers.set(id, await this.render(RECIPES[id]!));
    this.score = new Score(ctx, this.buses.get('music')!);
    this.ready = true;
    void this.probeFiles();
  }

  /** Real files at manifest paths override recipes (probe quietly; missing files are expected). */
  private async probeFiles(): Promise<void> {
    for (const s of SFX) {
      try {
        const r = await fetch(s.file, { method: 'HEAD' });
        if (r.ok && (r.headers.get('content-type') ?? '').startsWith('audio')) {
          const buf = await (await fetch(s.file)).arrayBuffer();
          this.buffers.set(s.id, await this.ctx!.decodeAudioData(buf));
        }
      } catch { /* synth fallback stays */ }
    }
  }

  private async render(r: Recipe): Promise<AudioBuffer> {
    const sr = 22050;
    const len = r.length ?? Math.max(...r.layers.map((l) => (l.delay ?? 0) + l.dur + (l.repeat ? l.repeat.every * (l.repeat.n - 1) : 0))) + 0.05;
    const oc = new OfflineAudioContext(1, Math.ceil(len * sr), sr);
    const noise = oc.createBuffer(1, sr * 2, sr);
    const nd = noise.getChannelData(0);
    let seed = 12345; for (let i = 0; i < nd.length; i++) { seed = (seed * 1103515245 + 12345) >>> 0; nd[i] = (seed / 4294967296) * 2 - 1; }
    for (const l of r.layers) {
      const reps = l.repeat?.n ?? 1;
      for (let k = 0; k < reps; k++) this.layer(oc, l, (l.delay ?? 0) + k * (l.repeat?.every ?? 0), noise);
    }
    return oc.startRendering();
  }

  private layer(oc: OfflineAudioContext, l: Layer, t0: number, noise: AudioBuffer): void {
    let src: AudioScheduledSourceNode;
    if (l.wave === 'noise') { const s = oc.createBufferSource(); s.buffer = noise; s.loop = true; src = s; }
    else {
      const o = oc.createOscillator(); o.type = l.wave;
      o.frequency.setValueAtTime(l.f0 ?? 440, t0);
      o.frequency.exponentialRampToValueAtTime(Math.max(1, l.f1 ?? l.f0 ?? 440), t0 + l.dur);
      src = o;
    }
    const g = oc.createGain();
    const peak = l.gain ?? 0.5, att = l.attack ?? 0.005, curve = l.curve ?? 5;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + att);
    g.gain.setTargetAtTime(0.0001, t0 + att, l.dur / curve);
    g.gain.setValueAtTime(g.gain.value, t0 + l.dur);
    let node: AudioNode = src;
    if (l.filter) {
      const f = oc.createBiquadFilter(); f.type = l.filter.type; f.Q.value = l.filter.q ?? 0.7;
      f.frequency.setValueAtTime(l.filter.f0, t0);
      f.frequency.exponentialRampToValueAtTime(Math.max(20, l.filter.f1 ?? l.filter.f0), t0 + l.dur);
      node.connect(f); node = f;
    }
    if (l.trem) {
      const lfo = oc.createOscillator(); lfo.frequency.value = l.trem;
      const lg = oc.createGain(); lg.gain.value = 0.5; const tg = oc.createGain(); tg.gain.value = 0.5;
      lfo.connect(lg); lg.connect(tg.gain); node.connect(tg); node = tg; lfo.start(t0); lfo.stop(t0 + l.dur);
    }
    node.connect(g); g.connect(oc.destination);
    src.start(t0); src.stop(t0 + l.dur + 0.02);
  }

  // ------------------------------------------------------------------ AudioSystem contract
  setBusVolume(bus: string, value: number): void { this.volumes[bus] = value; this.applyVolumes(); }
  setMuted(muted: boolean): void { this.muted = muted; this.applyVolumes(); }
  pauseAll(): void { void this.ctx?.suspend(); }
  resumeAll(): void { void this.ctx?.resume(); }
  playMusic(id: string): void { this.music(id); }
  playSfx(id: string, options?: { volume?: number }): void { this.ui(id, options?.volume); }

  private applyVolumes(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.buses.get('master')!.gain.setTargetAtTime(this.muted ? 0 : this.volumes.master!, t, 0.05);
    for (const b of ['music', 'sfx', 'ui', 'voice', 'ambience'] as Bus[]) this.buses.get(b)!.gain.setTargetAtTime(this.volumes[b] ?? 1, t, 0.05);
    this.buses.get('keep')!.gain.setTargetAtTime(this.volumes.sfx ?? 1, t, 0.05);
  }

  setListener(pos: THREE.Vector3, yaw: number): void { this.listener.copy(pos); this.listenerYaw = yaw; }

  /** Positional SFX (or UI-ish when pos omitted). */
  sfx(id: string, pos?: THREE.Vector3 | null, volume = 1, rate = 1): void {
    const ctx = this.ctx; const buf = this.buffers.get(id);
    if (!ctx || !buf || !this.ready) return;
    const def = SFX.find((s) => s.id === id);
    const keep = MIX.silence.keep.includes(id);
    if (this.silence && !keep) return;
    let gain = volume; let pan = 0;
    if (pos && def?.spatial !== false) {
      const d = pos.distanceTo(this.listener);
      const ref = id.startsWith('mech.') || id.startsWith('debris') || id.includes('siren') ? 60 : 9;
      gain *= Math.min(1, ref / Math.max(ref, d)) ** 1.2;
      if (gain < 0.01) return;
      const dx = pos.x - this.listener.x, dz = pos.z - this.listener.z;
      const right = Math.cos(this.listenerYaw) * dx - Math.sin(this.listenerYaw) * dz;
      pan = Math.max(-1, Math.min(1, right / Math.max(1, Math.hypot(dx, dz)))) * 0.8;
    }
    const src = ctx.createBufferSource(); src.buffer = buf; src.playbackRate.value = rate * (0.96 + ((this.played * 0.37) % 0.08));
    const g = ctx.createGain(); g.gain.value = gain;
    const p = ctx.createStereoPanner(); p.pan.value = pan;
    src.connect(g); g.connect(p); p.connect(this.buses.get(keep ? 'keep' : (def?.bus ?? 'sfx'))!);
    src.start(); this.played++;
  }

  ui(id: string, volume = 1): void { this.sfx(id, null, volume); }

  music(cue: string | null): void { if (!this.silence) this.score?.play(cue); }
  setLayers(l: Partial<Record<'suspicion' | 'hunted' | 'lockdown', number>>): void { this.score?.setLayers(l); }
  tempo(mult: number): void { this.score?.setTempoMult(mult); }

  /** Collapse sting: one-shot that ducks the music bed (it sits above VO). */
  sting(kind: 'collapse'): void {
    if (!this.ctx || this.silence) return;
    this.duck('music', MIX.collapseDuckMusicDb, 2);
    this.score?.sting(kind);
  }

  duck(bus: Bus, db: number, seconds: number): void {
    const d = this.duckers.get(bus); if (!d || !this.ctx) return;
    const t = this.ctx.currentTime;
    d.gain.cancelScheduledValues(t);
    d.gain.setTargetAtTime(dbToGain(db), t, 0.05);
    d.gain.setTargetAtTime(1, t + seconds, 0.4);
  }

  /** While primary VO plays, everything else sits under it. */
  voDuck(on: boolean): void {
    if (!this.ctx || this.silence) return;
    const t = this.ctx.currentTime;
    for (const b of ['music', 'sfx', 'ambience'] as Bus[]) this.duckers.get(b)!.gain.setTargetAtTime(on ? dbToGain(MIX.voDuckOthersDb) : 1, t, 0.15);
  }

  rumble(amount: number, seconds: number): void {
    if (!this.ctx || this.silence) return;
    const buf = this.buffers.get('rumble.bed'); if (!buf) return;
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const g = this.ctx.createGain(); const t = this.ctx.currentTime;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(amount, t + 0.4); g.gain.setTargetAtTime(0, t + seconds, 0.6);
    src.connect(g); g.connect(this.buses.get('ambience')!); src.start(); src.stop(t + seconds + 3);
  }

  /** A Sable voice from a world position (subtitle carries the words until VO is recorded). */
  voiceAt(pos: THREE.Vector3): void { this.sfx('voice.mumble', pos, 0.6); }

  /** Play a VO line file if it exists; returns its duration (ms) or null for subtitle-only. */
  async voice(file: string, radio: boolean, barkDuckDb = 0): Promise<number | null> {
    const ctx = this.ctx; if (!ctx) return null;
    if (radio) this.ui('radio.click', 0.6);
    let buf = this.fileBuffers.get(file);
    if (buf === undefined) {
      buf = null;
      try {
        const r = await fetch(file);
        if (r.ok && (r.headers.get('content-type') ?? '').startsWith('audio')) buf = await ctx.decodeAudioData(await r.arrayBuffer());
      } catch { buf = null; }
      this.fileBuffers.set(file, buf);
    }
    if (!buf) return null;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const g = ctx.createGain(); g.gain.value = dbToGain(barkDuckDb);
    let node: AudioNode = src;
    if (radio) { const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1700; f.Q.value = 0.6; src.connect(f); node = f; }
    node.connect(g); g.connect(this.buses.get('voice')!);
    src.start(); this.voiceSrc = src;
    return buf.duration * 1000;
  }
  stopVoice(): void { try { this.voiceSrc?.stop(); } catch { /* already stopped */ } this.voiceSrc = null; }

  /** Mix presets. 'silence': everything to −60 dB over 0.4 s; breathing + reactor tick remain. */
  mix(preset: 'normal' | 'silence' | 'duckAll'): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.silence = preset === 'silence';
    const g = preset === 'silence' ? dbToGain(MIX.silence.db) : preset === 'duckAll' ? dbToGain(-14) : 1;
    for (const b of ['music', 'sfx', 'ui', 'ambience', 'voice'] as Bus[]) {
      const d = this.duckers.get(b)!.gain;
      d.cancelScheduledValues(t);
      if (preset === 'silence') { d.setValueAtTime(d.value, t); d.linearRampToValueAtTime(b === 'voice' ? 1 : g, t + MIX.silence.seconds); }
      else d.setTargetAtTime(g, t, 0.2);
    }
    if (preset === 'silence') this.score?.play(null, 0.4);
  }

  get silenced(): boolean { return this.silence; }
  update(dt: number): void { this.score?.update(dt); }
}
