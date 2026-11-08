import * as THREE from 'three';
import { clamp, damp } from './math';
import type { MechTuning } from './tuning';
import type { Lockable } from './LockSystem';

export interface ChaseInput {
  pos: THREE.Vector3; yaw: number; pitch: number; assault: boolean; locked: Lockable | null; speed: number;
}

/**
 * AlphaMech `frame/CameraRig.ts`: third-person chase rig whose hard lock frames both fighters while
 * keeping the machine at constant apparent size. Settings that were globals are fields here.
 * Writes into a pose (position / target / fov) instead of owning the renderer's camera.
 */
export class ChaseCamera {
  readonly position = new THREE.Vector3(0, 40, 220);
  readonly target = new THREE.Vector3();
  fov: number;
  roll = 0;
  shake = 0;
  /** Accessibility multiplier on shake. */
  shakeScale = 1;
  /** Hard cap on shake intensity (game feel rules). */
  shakeCap = 1.4;
  /** Base FOV (player setting); AlphaMech's boost FOV delta is applied on top. */
  baseFov: number;
  /** Multiplier on camera distance (consumers framing a different body size). */
  distanceScale = 1;
  /** Shoulder offset, metres (positive = right). */
  shoulder = 0;
  private hardLockT = 0;
  private hardLockTarget: Lockable | null = null;
  private kick = 0;
  private seed = 0;

  constructor(private tune: MechTuning) { this.fov = tune.camFov; this.baseFov = tune.camFov; }

  hardLock(target: Lockable, dur: number) { this.hardLockTarget = target; this.hardLockT = dur; }
  punch(amount: number) { this.kick = Math.min(1.4, this.kick + amount); }
  addShake(amount: number) { this.shake = Math.min(this.shakeCap, this.shake + amount * this.shakeScale); }
  snap(p: ChaseInput) { this.update(10, p); }

  update(dt: number, p: ChaseInput) {
    const T = this.tune;
    this.seed += dt;
    this.hardLockT = Math.max(0, this.hardLockT - dt);
    const lock = this.hardLockT > 0 && this.hardLockTarget?.alive ? this.hardLockTarget : p.locked;
    const focusH = T.focusHeight;
    const focus = p.pos.clone().setY(p.pos.y + focusH);
    let yaw = p.yaw;
    let pitch = p.pitch;
    if (lock && lock.alive) {
      const d = lock.pos.clone().sub(p.pos);
      yaw = Math.atan2(-d.x, -d.z);
      pitch = clamp(p.pitch, -0.5, 0.5);
      focus.lerp(lock.pos.clone().setY(lock.pos.y + focusH), 0.22);
    }
    const focusShift = focus.distanceTo(p.pos.clone().setY(p.pos.y + focusH));
    const distScale = lock && lock.alive ? clamp(lock.pos.distanceTo(p.pos) / 260, 0, 0.7) : 0;
    const dist = (T.camDist * (1 + distScale) + focusShift + p.speed * 0.018) * this.distanceScale;
    const back = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch) + 0.34, Math.cos(yaw) * Math.cos(pitch)).normalize();
    const want = focus.clone().addScaledVector(back, dist);
    want.y = Math.max(focus.y - 6 * this.distanceScale, focus.y + (T.camHeight + pitch * 16) * this.distanceScale);
    if (this.shoulder) { const rx = Math.cos(yaw), rz = -Math.sin(yaw); want.x += rx * this.shoulder; want.z += rz * this.shoulder; focus.x += rx * this.shoulder * 0.6; focus.z += rz * this.shoulder * 0.6; }
    const lag = T.camLag;
    this.position.x = damp(this.position.x, want.x, lag, dt);
    this.position.y = damp(this.position.y, want.y, lag, dt);
    this.position.z = damp(this.position.z, want.z, lag, dt);
    this.shake = Math.max(0, this.shake - dt * 2.6);
    this.kick = Math.max(0, this.kick - dt * 4.2);
    this.target.copy(focus);
    if (this.shake > 0) {
      // deterministic noise in place of AlphaMech's Math.random jitter (same amplitudes)
      const s = this.shake * this.distanceScale;
      this.target.x += Math.sin(this.seed * 71.3) * s * 0.4;
      this.target.y += Math.sin(this.seed * 53.9 + 1.3) * s * 0.4;
    }
    this.roll = this.kick * 0.03;
    const wantFov = this.baseFov + (p.assault ? T.camFovBoost - T.camFov : 0) + this.kick * 5;
    this.fov = damp(this.fov, wantFov, 7, dt);
  }

  /** Writes the pose onto a Three.js camera (with shake on position). */
  apply(camera: THREE.PerspectiveCamera) {
    camera.position.copy(this.position);
    if (this.shake > 0) {
      const s = this.shake * this.distanceScale;
      camera.position.x += Math.sin(this.seed * 97.1) * s * 1.7;
      camera.position.y += Math.sin(this.seed * 83.3 + 2.1) * s * 1.7;
      camera.position.z += Math.sin(this.seed * 61.7 + 4.2) * s * 0.8;
    }
    camera.lookAt(this.target);
    if (this.roll) camera.rotateZ(this.roll);
    camera.fov = this.fov;
    camera.updateProjectionMatrix();
  }
}
