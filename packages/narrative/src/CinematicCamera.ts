import type { Vec3 } from './Emitter';

export interface CamPose { position: Vec3; target: Vec3; fov: number; roll?: number }
export type Ease = 'linear' | 'in' | 'out' | 'inOut';

export interface Shot {
  id: string;
  /** Seconds the shot holds/moves. */
  duration: number;
  from: CamPose | (() => CamPose);
  /** Optional end pose (dolly). */
  to?: CamPose | (() => CamPose);
  ease?: Ease;
  /** Seconds to blend in from the previous pose (0 = hard cut). */
  blendIn?: number;
  /** Shake amplitude, metres. */
  shake?: number;
  /** Letterbox amount 0..1 while this shot is active. */
  letterbox?: number;
}

export interface PlayOptions {
  /** Seconds to blend from the last shot back to the gameplay camera. 0 = cut. */
  blendOut?: number;
  onHandoff?: () => void;
}

const easeFn: Record<Ease, (t: number) => number> = {
  linear: (t) => t,
  in: (t) => t * t,
  out: (t) => 1 - (1 - t) * (1 - t),
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lv = (a: Vec3, b: Vec3, t: number): Vec3 => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: lerp(a.z, b.z, t) });
const lp = (a: CamPose, b: CamPose, t: number): CamPose => ({ position: lv(a.position, b.position, t), target: lv(a.target, b.target, t), fov: lerp(a.fov, b.fov, t), roll: lerp(a.roll ?? 0, b.roll ?? 0, t) });
const resolve = (p: CamPose | (() => CamPose)) => (typeof p === 'function' ? p() : p);

/**
 * Authored shots, blends, tracking, shake and letterbox, with a seamless handoff back to gameplay:
 * the gameplay pose is fed in every frame, the last shot blends into it, and `controlLocked` drops
 * on the same update the blend completes (no fade, no extra frame).
 */
export class CinematicCamera {
  private shots: Shot[] = [];
  private index = -1;
  private t = 0;
  private blendOutT = 0;
  private opts: PlayOptions = {};
  private last: CamPose | null = null;
  private shotStart: CamPose | null = null;
  private phase: 'idle' | 'shots' | 'blendOut' = 'idle';
  letterbox = 0;
  private letterTarget = 0;
  private seed = 0;

  get active(): boolean { return this.phase !== 'idle'; }
  /** Gameplay input is blocked while true. */
  get controlLocked(): boolean { return this.phase !== 'idle'; }
  get currentShot(): string | null { return this.phase === 'shots' ? this.shots[this.index]?.id ?? null : null; }

  play(shots: readonly Shot[], opts: PlayOptions = {}): void {
    if (!shots.length) return;
    this.shots = [...shots];
    this.opts = opts;
    this.index = 0;
    this.t = 0;
    this.phase = 'shots';
    this.shotStart = this.last;
  }

  /** End immediately; blend out from wherever the camera is. */
  stop(blendOut = this.opts.blendOut ?? 0.4): void {
    if (this.phase === 'blendOut') { if (blendOut <= 0) this.handoff(); return; } // a hard cut overrides a blend in progress
    if (this.phase !== 'shots') return;
    this.opts = { ...this.opts, blendOut };
    this.beginBlendOut();
  }

  private beginBlendOut(): void {
    this.phase = 'blendOut';
    this.blendOutT = 0;
    this.letterTarget = 0;
    if ((this.opts.blendOut ?? 0) <= 0) this.handoff();
  }

  private handoff(): void {
    this.phase = 'idle';
    const cb = this.opts.onHandoff;
    this.opts = {};
    cb?.();
  }

  /**
   * Returns the pose to render this frame, or null when the gameplay camera should be used as-is.
   */
  update(dt: number, gameplay: CamPose): CamPose | null {
    this.seed += dt;
    this.letterbox += (this.letterTarget - this.letterbox) * Math.min(1, dt * 5);
    if (this.phase === 'idle') { this.last = gameplay; return null; }

    if (this.phase === 'shots') {
      let shot = this.shots[this.index]!;
      this.t += dt;
      while (this.t >= shot.duration) {
        this.t -= shot.duration;
        this.index++;
        this.shotStart = this.last;
        if (this.index >= this.shots.length) {
          const leftover = this.t;
          this.beginBlendOut();
          return (this.phase as string) === 'idle' ? null : this.blend(leftover, gameplay);
        }
        shot = this.shots[this.index]!;
      }
      this.letterTarget = shot.letterbox ?? 1;
      const from = resolve(shot.from);
      const to = shot.to ? resolve(shot.to) : from;
      const k = easeFn[shot.ease ?? 'inOut'](Math.min(1, this.t / Math.max(1e-3, shot.duration)));
      let pose = lp(from, to, k);
      const bi = shot.blendIn ?? 0;
      if (bi > 0 && this.t < bi && this.shotStart) pose = lp(this.shotStart, pose, easeFn.inOut(this.t / bi));
      if (shot.shake) {
        const s = shot.shake;
        pose = { ...pose, position: { x: pose.position.x + Math.sin(this.seed * 37.1) * s, y: pose.position.y + Math.sin(this.seed * 29.3 + 1) * s, z: pose.position.z + Math.sin(this.seed * 41.7 + 2) * s * 0.5 } };
      }
      this.last = pose;
      return pose;
    }
    return this.blend(dt, gameplay);
  }

  private blend(dt: number, gameplay: CamPose): CamPose | null {
    const dur = this.opts.blendOut ?? 0;
    this.blendOutT += dt;
    const k = Math.min(1, this.blendOutT / Math.max(1e-3, dur));
    const from = this.last ?? gameplay;
    const pose = lp(from, gameplay, easeFn.inOut(k));
    if (k >= 1) { this.last = gameplay; this.handoff(); return null; }
    return pose;
  }
}
