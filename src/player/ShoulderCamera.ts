import * as THREE from 'three';
import { PLAYER } from '../../data/player';
import type { World } from '../game/World';

const C = PLAYER.camera;
const damp = (a: number, b: number, l: number, dt: number) => a + (b - a) * (1 - Math.exp(-l * dt));

/**
 * Third-person over-the-shoulder camera. Right shoulder default, swap on a button. FOV 70 on foot,
 * 80 sprinting, tighter when aiming. Spring-arm collision against the collision world.
 */
export class ShoulderCamera {
  yaw = 0;
  pitch = -0.12;
  side = 1;
  private sideT = 1;
  private dist: number = C.distance;
  private fov: number = C.fov;
  private pivot = new THREE.Vector3();
  private push = 0;
  readonly position = new THREE.Vector3();
  readonly target = new THREE.Vector3();
  baseFov: number = C.fov;
  /** Current horizontal forward (XZ) for movement. */
  forward(out = new THREE.Vector3()) { return out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); }
  right(out = new THREE.Vector3()) { return out.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw)); }
  /** Full look direction. */
  dir(out = new THREE.Vector3()) { return out.set(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch)); }

  look(dx: number, dy: number): void {
    this.yaw += dx;
    this.pitch = Math.max(C.pitchMin, Math.min(C.pitchMax, this.pitch + dy));
  }

  pushIn(amount: number): void { this.push = Math.max(this.push, amount); }
  swapShoulder(): void { this.side *= -1; }

  update(dt: number, w: World, feet: THREE.Vector3, o: { crouch: number; sprint: boolean; aim: boolean; slide: number }): void {
    this.sideT = damp(this.sideT, this.side, 10, dt);
    const h = C.height - o.crouch * 0.45 - o.slide * 0.6;
    const wantPivot = new THREE.Vector3(feet.x, feet.y + h, feet.z);
    if (this.pivot.lengthSq() === 0) this.pivot.copy(wantPivot);
    this.pivot.x = damp(this.pivot.x, wantPivot.x, C.lag * 1.6, dt);
    this.pivot.z = damp(this.pivot.z, wantPivot.z, C.lag * 1.6, dt);
    this.pivot.y = damp(this.pivot.y, wantPivot.y, C.lag, dt);
    const wantDist = (o.aim ? C.aimDistance : C.distance) * (1 - this.push);
    this.dist = damp(this.dist, wantDist, 12, dt);
    const wantFov = (o.aim ? C.fovAim : o.sprint ? this.baseFov + (C.fovSprint - C.fov) : this.baseFov) * (1 - this.push * 0.5);
    this.fov = damp(this.fov, wantFov, 9, dt);
    this.push = Math.max(0, this.push - dt * 0.35);

    const d = this.dir();
    const r = this.right();
    const shoulder = r.clone().multiplyScalar(C.shoulder * this.sideT * (o.aim ? 0.9 : 1));
    const anchor = this.pivot.clone().add(shoulder);
    const want = anchor.clone().addScaledVector(d, -this.dist);
    // spring arm: pull in on collision
    const hit = w.collision.ray(this.pivot, want, 'block');
    const hit2 = hit ? null : w.collision.ray(anchor, want, 'block');
    const h1 = hit ?? hit2;
    if (h1) want.lerpVectors(h1 === hit ? this.pivot : anchor, want, Math.max(0, h1.t - 0.12));
    this.position.copy(want);
    this.target.copy(anchor).addScaledVector(d, 10);
  }

  apply(cam: THREE.PerspectiveCamera, w: World): void {
    const s = w.shake.update(1 / 60);
    cam.position.copy(this.position).add(new THREE.Vector3(s.x * 0.5, s.y * 0.5, s.z * 0.5));
    cam.lookAt(this.target);
    cam.rotateZ(s.roll);
    cam.rotateX(s.pitch * 0.5);
    cam.fov = this.fov;
    cam.updateProjectionMatrix();
  }

  snapBehind(yaw: number): void { this.yaw = yaw; this.pitch = -0.12; this.pivot.set(0, 0, 0); }
}
