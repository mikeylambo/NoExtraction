import * as THREE from 'three';
import { clipFor, clipLibrary, strideScale, type ClipMotion } from './Retarget';

/**
 * Mixamo clip animation for every humanoid. The game still owns position, facing and timing;
 * this only picks and blends clips. All actions are driven by hand (timeScale 0, time set each
 * frame) so locomotion stays phase-locked to ground speed and one-shots fit gameplay durations.
 *
 * Layers: locomotion (idle + 8-way walk/run/sprint/crouch, phase-synced) → upper-body overlay
 * (fire, reload, throw, hit) → full-body one-shot (slide, vault, mantle, takedown, stun, death).
 */

export type Weapon = 'rifle' | 'pistol';

/** What the game asks for, by game verb. Window = normalized [start, end] slice of the source clip. */
export interface ClipCue { clip: string; window?: [number, number]; layer?: 'full' | 'upper'; hold?: boolean; fadeIn?: number; fadeOut?: number }

/** Tuning table: the only place clip choice and slicing live. Durations come from gameplay. */
export const CUES: Record<string, ClipCue> = {
  slide: { clip: 'slide', window: [0.15, 0.55], fadeIn: 0.06 },
  vault: { clip: 'vault', window: [0.3, 0.62], fadeIn: 0.05, fadeOut: 0.12 },
  mantle: { clip: 'climb_up', window: [0.05, 0.95], fadeIn: 0.05, fadeOut: 0.12 },
  takedown: { clip: 'stab', window: [0.22, 0.62], fadeIn: 0.05 },
  takedownChain: { clip: 'rifle_punch', window: [0.18, 0.5], fadeIn: 0.04 },
  melee: { clip: 'rifle_punch', window: [0.18, 0.55] },
  meleePistol: { clip: 'pistol_whip', window: [0.2, 0.55] },
  fireRifle: { clip: 'rifle_fire', layer: 'upper', fadeIn: 0.03, fadeOut: 0.1 },
  firePistol: { clip: 'pistol_fire', layer: 'upper', window: [0.05, 0.4], fadeIn: 0.03, fadeOut: 0.1 },
  reloadRifle: { clip: 'rifle_reload', layer: 'upper', fadeIn: 0.1, fadeOut: 0.15 },
  /** No Mixamo pistol reload: the rifle reload's mag-swap section, upper body only. */
  reloadPistol: { clip: 'rifle_reload', layer: 'upper', window: [0.15, 0.75], fadeIn: 0.08, fadeOut: 0.12 },
  throw: { clip: 'throw', layer: 'upper', window: [0.35, 0.75], fadeIn: 0.06 },
  hit: { clip: 'hit', layer: 'upper', fadeIn: 0.03, fadeOut: 0.12 },
  interact: { clip: 'interact', window: [0.15, 0.6] },
  /** Mixamo's stun staggers, drops and recovers: stretched over a flash stun (~3 s), held until it ends. */
  stunned: { clip: 'stunned', hold: true, fadeIn: 0.1 },
  lookAround: { clip: 'look_around' },
};

const DIRS: [string, number][] = [['forward', 0], ['forward_left', 45], ['left', 90], ['backward_left', 135], ['backward', 180], ['backward_right', -135], ['right', -90], ['forward_right', -45]];
const PISTOL_DIRS: [string, number][] = [['', 0], ['strafe_left', 90], ['backward', 180], ['strafe_right', -90]];
const DEATHS = ['death_front', 'death_back', 'death_right', 'death_head_front', 'death_head_back'];
const UPPER_BONE = /spine|neck|head|shoulder|arm|hand/i;

/** Clips retargeted to one skeleton, plus the library's motion data. Shared by every instance of it. */
interface ClipSet { get(name: string): THREE.AnimationClip | null; upper(name: string): THREE.AnimationClip | null; motion: Record<string, ClipMotion> }
const sets = new WeakMap<THREE.Object3D, ClipSet>();
function clipSet(source: THREE.Object3D): ClipSet {
  let s = sets.get(source);
  if (!s) {
    const up = new Map<string, THREE.AnimationClip | null>();
    s = {
      motion: clipLibrary()?.motion ?? {},
      get: (n) => clipFor(source, n),
      upper: (n) => {
        if (!up.has(n)) { const c = clipFor(source, n); up.set(n, c && new THREE.AnimationClip(`${n}__upper`, c.duration, c.tracks.filter((t) => UPPER_BONE.test(t.name.split('.')[0]!) && !/hips/i.test(t.name)))); }
        return up.get(n)!;
      },
    };
    sets.set(source, s);
  }
  return s;
}

interface Shot { cue: ClipCue; action: THREE.AnimationAction; t0: number; t1: number; dur: number; elapsed: number; w: number; done: boolean }

export interface LocoInput {
  speed: number;
  /** Move direction in body space, radians: 0 forward, +π/2 left. */
  dir: number;
  crouch: number;
  aim: number;
  weapon: Weapon;
  dead: number;
  stun: number;
  /** Death clip override (e.g. 'death_back' for takedown victims). */
  deathHint?: string;
}

export class ClipAnimator {
  readonly mixer: THREE.AnimationMixer;
  private loco = new Map<string, THREE.AnimationAction>();
  private phase = 0;
  private idleT = 0;
  private full: Shot | null = null;
  private upper: Shot | null = null;
  private fading: Shot[] = [];
  private dying = false;
  private stunShot: Shot | null = null;
  private readonly a: ClipSet;
  /** Library speeds are X Bot metres; this character's legs differ (measured on first update). */
  private stride = 0;

  /** `model`: a skinned instance; `source`: the GLB scene it was cloned from (keys the retarget cache). */
  constructor(readonly model: THREE.Object3D, source: THREE.Object3D) {
    this.a = clipSet(source);
    this.mixer = new THREE.AnimationMixer(model);
    for (const [name, m] of Object.entries(this.a.motion)) {
      if (!m.loop) continue;
      const clip = this.a.get(name); if (!clip) continue;
      const act = this.mixer.clipAction(clip);
      act.play(); act.setEffectiveTimeScale(0); act.setEffectiveWeight(0);
      this.loco.set(name, act);
    }
  }

  /** Has `clip` (lets callers fall back gracefully if a clip is missing from the library). */
  has(clip: string): boolean { return !!this.a.get(clip); }

  /** Play a cue (key of CUES) or a raw clip name over `dur` gameplay seconds (default: clip length). */
  play(cueOrClip: string, dur?: number): void {
    const cue = CUES[cueOrClip] ?? { clip: cueOrClip };
    const src = this.a.get(cue.clip); if (!src) return;
    const clip = cue.layer === 'upper' ? this.a.upper(cue.clip)! : src;
    const [s, e] = cue.window ?? [0, 1];
    const t0 = s * src.duration, t1 = e * src.duration;
    const action = this.mixer.clipAction(clip);
    action.reset().play(); action.setEffectiveTimeScale(0); action.setEffectiveWeight(0);
    const shot: Shot = { cue, action, t0, t1, dur: Math.max(0.05, dur ?? t1 - t0), elapsed: 0, w: 0, done: false };
    const prev = cue.layer === 'upper' ? this.upper : this.full;
    if (prev && prev.action !== action) this.fading.push(prev);
    if (cue.layer === 'upper') this.upper = shot; else this.full = shot;
  }

  /**
   * How much the support hand is busy with something other than the gun (0..1): any full-body
   * one-shot, or an upper-body one that isn't firing. Drives the left-hand IK weight.
   */
  get handBusy(): number {
    const f = this.full?.w ?? 0;
    const u = this.upper && !/fire/.test(this.upper.cue.clip) ? this.upper.w : 0;
    return Math.max(f, u, this.dying ? 1 : 0);
  }

  /** End the current full-body one-shot early (e.g. slide cancelled). */
  stopFull(): void { if (this.full) { this.full.done = true; } }

  update(dt: number, p: LocoInput): void {
    if (!this.stride) {
      let hips: THREE.Object3D | undefined;
      this.model.traverse((o) => { if (!hips && (o as THREE.Bone).isBone && /hips$/i.test(o.name)) hips = o; });
      this.model.updateWorldMatrix(true, true);
      const y0 = this.model.getWorldPosition(new THREE.Vector3()).y;
      this.stride = hips ? strideScale(hips.getWorldPosition(new THREE.Vector3()).y - y0) : 1;
      if (!(this.stride > 0.2 && this.stride < 5)) this.stride = 1;
    }
    // ---- deaths and stun are state, not events
    if (p.dead > 0.02 && !this.dying) {
      this.dying = true;
      const hint = p.deathHint && this.has(p.deathHint) ? p.deathHint : p.crouch > 0.5 ? 'death_crouch' : DEATHS[(Math.random() * DEATHS.length) | 0]!;
      this.play(hint); this.full!.cue = { clip: hint, hold: true, fadeIn: 0.08 };
      this.upper = null;
    } else if (p.dead <= 0.02 && this.dying) { this.dying = false; if (this.full) this.full.done = true; }
    if (!this.dying) {
      if (p.stun > 0.5 && !this.stunShot) { this.play('stunned', 3); this.stunShot = this.full; }
      else if (p.stun <= 0.5 && this.stunShot) { this.stunShot.done = true; this.stunShot = null; }
    }

    // ---- one-shots advance
    const fullW = this.stepShot(this.full, dt, 0);
    this.stepShot(this.upper, dt, fullW);
    if (this.full?.done && this.full.w <= 0) this.full = null;
    if (this.upper?.done && this.upper.w <= 0) this.upper = null;
    this.fading = this.fading.filter((s) => { s.done = true; this.stepShot(s, dt, fullW); return s.w > 0; });

    // ---- locomotion weights
    const w = new Map<string, number>();
    const add = (k: string, v: number) => { if (v > 1e-3) w.set(k, (w.get(k) ?? 0) + v); };
    const M = this.a.motion;
    const s = p.speed / this.stride; // in library metres
    const moving = THREE.MathUtils.smoothstep(s, 0.08, 0.7);
    const crouch = THREE.MathUtils.clamp(p.crouch, 0, 1);
    const pistol = p.weapon === 'pistol';
    // idle
    const idleW = 1 - moving;
    if (pistol) { add('pistol_idle', idleW * (1 - crouch)); add('pistol_kneel_idle', idleW * crouch); }
    else { add('idle', idleW * (1 - crouch) * (1 - p.aim)); add('idle_aim', idleW * (1 - crouch) * p.aim); add('crouch_idle', idleW * crouch * (1 - p.aim)); add('crouch_aim', idleW * crouch * p.aim); }
    // direction pair
    const deg = THREE.MathUtils.radToDeg(p.dir);
    const pair = (table: [string, number][]) => {
      const step = 360 / table.length;
      const a = ((deg % 360) + 360) % 360;
      const i = Math.floor(a / step), f = a / step - i;
      const at = (k: number) => table[((k % table.length) + table.length) % table.length]!;
      return [[at(i)[0], 1 - f], [at(i + 1)[0], f]] as [string, number][];
    };
    // 0°..360° anticlockwise order for the tables
    const ccw8 = [...DIRS].sort((x, y) => ((x[1] + 360) % 360) - ((y[1] + 360) % 360));
    const ccw4 = [...PISTOL_DIRS].sort((x, y) => ((x[1] + 360) % 360) - ((y[1] + 360) % 360));
    // gait tiers by speed → [tier, weight]
    const tiers = (list: [string, number][]): [string, number][] => {
      if (s <= list[0]![1]) return [[list[0]![0], 1]];
      for (let i = 0; i < list.length - 1; i++) {
        const [a, va] = list[i]!, [b, vb] = list[i + 1]!;
        if (s <= vb) { const f = (s - va) / (vb - va); return [[a, 1 - f], [b, f]]; }
      }
      return [[list[list.length - 1]![0], 1]];
    };
    let stride = 0, strideW = 0;
    const loco = (name: string, v: number) => { const m = M[name]; if (!m || v <= 1e-3) return; add(name, v); stride += m.speed * m.dur * v; strideW += v; };
    if (moving > 0) {
      const standW = moving * (1 - crouch), crouchW = moving * crouch;
      for (const [d, dw] of pair(ccw8)) loco(`crouch_${d}`, crouchW * dw);
      if (pistol) {
        for (const [tier, tw] of tiers([['walk', M.pistol_walk?.speed ?? 2.4], ['run', M.pistol_run?.speed ?? 5]])) {
          for (const [d, dw] of pair(ccw4)) {
            const name = d === '' ? `pistol_${tier}` : d === 'backward' ? `pistol_${tier}_backward` : `pistol_${d}`;
            loco(name, standW * tw * dw);
          }
        }
      } else {
        for (const [tier, tw] of tiers([['walk', M.walk_forward?.speed ?? 1.9], ['run', M.run_forward?.speed ?? 4.8], ['sprint', M.sprint_forward?.speed ?? 7.3]])) {
          for (const [d, dw] of pair(ccw8)) loco(`${tier}_${d}`, standW * tw * dw);
        }
      }
    }
    const strideLen = strideW > 0 ? stride / strideW : 1;
    this.phase = (this.phase + dt * s / Math.max(0.3, strideLen)) % 1;
    this.idleT += dt;

    // ---- apply: loco shares what one-shots leave; upper overlay uses the weighted-average trick
    const locoScale = 1 - fullW;
    for (const [name, act] of this.loco) {
      const v = (w.get(name) ?? 0) * locoScale;
      act.setEffectiveWeight(v);
      if (v > 0) { const d = act.getClip().duration; act.time = M[name]!.speed > 0.05 ? this.phase * d : this.idleT % d; }
    }
    this.mixer.update(0);
  }

  /** Advance a one-shot. Full-body: weight = w. Upper: loco has weight ~1 on those bones and three
   *  averages by weight, so fraction f needs weight f/(1−f); suppressed under a full-body shot. */
  private stepShot(s: Shot | null, dt: number, fullW: number): number {
    if (!s) return 0;
    s.elapsed += dt;
    const k = s.elapsed / s.dur;
    if (k >= 1 && !s.cue.hold) s.done = true;
    const fin = s.cue.fadeIn ?? 0.1, fout = s.cue.fadeOut ?? 0.15;
    if (s.done) s.w = Math.max(0, s.w - dt / fout);
    else s.w = Math.min(1, s.w + dt / Math.max(1e-3, fin));
    s.action.time = s.t0 + (s.t1 - s.t0) * Math.min(1, k);
    if (s.cue.layer === 'upper') { const f = Math.min(0.97, s.w * (1 - fullW)); s.action.setEffectiveWeight(f / (1 - f)); }
    else s.action.setEffectiveWeight(s.w);
    return s.w;
  }

}
