import * as THREE from 'three';
import { clamp, damp } from './math';
import { cloneBaseline, type MechTuning } from './tuning';

/** Semantic movement intent for one simulation step. Device-agnostic. */
export interface MechInput {
  /** Strafe, -1..1 (right positive). */
  moveX: number;
  /** Forward, -1..1 (forward positive). */
  moveZ: number;
  rise: boolean;
  descend: boolean;
}

export interface MechEnvironment {
  /** Floor height under a world position. */
  groundAt(x: number, z: number): number;
  /** Push a position back inside the playable volume / out of solids. */
  confine(pos: THREE.Vector3, margin: number): boolean;
}

export interface MechCapabilities {
  /** Sustained flight (hover holds altitude). Without it the jets only hop. */
  sustainedFlight: boolean;
  /** Max hop height above take-off ground when sustained flight is unavailable. */
  hopHeight: number;
  /** Quick/assault boost while airborne. */
  airBoost: boolean;
}

export type MechState = 'STANDBY' | 'BOOST SKATE' | 'QUICK BOOST' | 'ASSAULT BOOST' | 'VERTICAL THRUST' | 'DESCENT' | 'AIRBORNE' | 'STAGGERED' | 'LOCKED';

export interface MechFrameEvents {
  onQuickBoost?(dir: THREE.Vector3): void;
  onAssault?(on: boolean): void;
  onLand?(impactSpeed: number): void;
  onEmpty?(): void;
}

/**
 * The movement core of the AlphaMech player frame (`frame/Player.ts`): boost skate, quick boost,
 * assault boost, vertical thrust, descent, the held-altitude ASHFALL profile and the energy
 * economy — with the run/upgrade/vanish layers removed so any game can drive it.
 * `update()` is a pure simulation step: no rendering, no input polling, no globals.
 */
export class MechFrame {
  readonly pos = new THREE.Vector3();
  readonly vel = new THREE.Vector3();
  yaw = Math.PI;
  pitch = -0.06;
  energy: number;
  grounded = true;
  state: MechState = 'STANDBY';
  assault = false;
  quickCD = 0;
  /** Disables all movement (cutscenes, grapples). */
  locked = false;
  /** Multiplier on horizontal control while staggered (AlphaMech: 0.15). */
  staggered = false;
  tune: MechTuning;
  caps: MechCapabilities = { sustainedFlight: true, hopHeight: 12, airBoost: true };

  private quickT = 0;
  private readonly dash = new THREE.Vector3();
  private regenT = 0;
  private hopBase = 0;
  private hopSpent = false;

  constructor(private readonly env: MechEnvironment, tune: MechTuning = cloneBaseline(), private readonly events: MechFrameEvents = {}) {
    this.tune = tune;
    this.energy = tune.energyMax;
  }

  forward(out = new THREE.Vector3()): THREE.Vector3 { return out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); }
  right(out = new THREE.Vector3()): THREE.Vector3 { return out.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw)); }
  get speed() { return Math.hypot(this.vel.x, this.vel.z); }
  get energy01() { return this.energy / this.tune.energyMax; }
  get altitude() { return this.pos.y - this.env.groundAt(this.pos.x, this.pos.z); }
  get quickBoosting() { return this.quickT > 0; }
  get canBoostNow() { return this.grounded || this.caps.airBoost; }

  /** Quick boost toward `dir` (world XZ). Returns false if on cooldown or out of energy. */
  quickBoost(dir: THREE.Vector3): boolean {
    if (this.locked || this.staggered || this.quickCD > 0 || !this.canBoostNow) return false;
    const cost = this.tune.quickCost;
    if (this.energy < cost) { this.events.onEmpty?.(); return false; }
    this.energy = clamp(this.energy - cost, 0, this.tune.energyMax);
    this.regenT = 0.6;
    this.quickCD = this.tune.quickCooldown;
    this.quickT = this.tune.quickDur;
    this.dash.copy(dir.lengthSq() > 0.01 ? dir : this.forward()).setY(0).normalize();
    this.assault = false;
    this.events.onQuickBoost?.(this.dash);
    return true;
  }

  setAssault(on: boolean): void {
    const next = on && !this.locked && !this.staggered && this.energy > 1 && this.canBoostNow;
    if (next !== this.assault) { this.assault = next; this.events.onAssault?.(next); }
  }

  /** Add to energy (pickups / scripted). */
  addEnergy(amount: number) { this.energy = clamp(this.energy + amount, 0, this.tune.energyMax); }

  update(dt: number, input: MechInput, infiniteEnergy = false): void {
    const T = this.tune;
    this.quickCD = Math.max(0, this.quickCD - dt);
    this.regenT = Math.max(0, this.regenT - dt);
    const canAct = !this.locked;
    const f = this.forward(), r = this.right();
    const ix = canAct ? input.moveX : 0;
    const iz = canAct ? input.moveZ : 0;
    const wish = f.clone().multiplyScalar(iz).addScaledVector(r, ix);
    if (wish.lengthSq() > 1) wish.normalize();
    if (this.energy < 1 || this.staggered || !canAct || !this.canBoostNow) this.setAssault(false);

    // ---- horizontal
    let consuming = false;
    if (this.quickT > 0) {
      this.quickT = Math.max(0, this.quickT - dt);
      this.vel.x = this.dash.x * T.quickSpeed;
      this.vel.z = this.dash.z * T.quickSpeed;
      this.state = 'QUICK BOOST';
    } else if (this.assault) {
      const d = f.clone().multiplyScalar(iz < 0 ? -1 : 1).addScaledVector(r, ix).normalize().multiplyScalar(T.assaultSpeed);
      this.vel.x = damp(this.vel.x, d.x, T.assaultAccel, dt);
      this.vel.z = damp(this.vel.z, d.z, T.assaultAccel, dt);
      this.energy -= dt * T.assaultDrain;
      consuming = true;
      this.state = 'ASSAULT BOOST';
    } else {
      const sc = this.staggered ? 0.15 : 1;
      this.vel.x = damp(this.vel.x, wish.x * T.speed * sc, T.accel, dt);
      this.vel.z = damp(this.vel.z, wish.z * T.speed * sc, T.accel, dt);
      this.state = !canAct ? 'LOCKED' : this.staggered ? 'STAGGERED' : this.grounded ? (wish.lengthSq() > 0.01 ? 'BOOST SKATE' : 'STANDBY') : 'AIRBORNE';
    }

    // ---- vertical
    const ground = this.env.groundAt(this.pos.x, this.pos.z);
    const rise = canAct && input.rise;
    const fall = canAct && input.descend;
    if (this.grounded) { this.hopBase = ground; this.hopSpent = false; }
    const hopCapped = !this.caps.sustainedFlight && (this.hopSpent || this.pos.y - this.hopBase >= this.caps.hopHeight);
    if (!this.caps.sustainedFlight && !this.grounded && !rise) this.hopSpent = true;
    if (this.staggered) {
      this.vel.y -= T.gravity * dt;
    } else if (rise && this.energy > 0 && !hopCapped) {
      this.vel.y = damp(this.vel.y, T.thrust, 6, dt);
      if (!this.assault) this.energy -= dt * T.hoverCost;
      consuming = true;
      this.grounded = false;
      this.state = 'VERTICAL THRUST';
    } else if (fall) {
      this.vel.y = damp(this.vel.y, -T.descentSpeed, 10, dt);
      this.state = 'DESCENT';
    } else if (!this.caps.sustainedFlight && this.pos.y > ground + 0.05) {
      // jump jets only: no held altitude, gravity takes over
      this.hopSpent = true;
      this.vel.y -= T.gravity * dt;
    } else {
      this.vel.y = 0; // ASHFALL profile: altitude is held until you spend or descend
    }

    // ---- energy
    if (consuming) this.regenT = T.regenDelay;
    if (!consuming && this.regenT <= 0) this.energy += dt * (this.grounded ? T.regenGround : T.regenAir);
    if (infiniteEnergy) this.energy = T.energyMax;
    this.energy = clamp(this.energy, 0, T.energyMax);

    // ---- integrate
    this.pos.addScaledVector(this.vel, dt);
    const wasAir = !this.grounded;
    this.grounded = false;
    const g = this.env.groundAt(this.pos.x, this.pos.z);
    if (this.pos.y <= g) {
      const impact = Math.abs(this.vel.y);
      this.pos.y = g;
      this.vel.y = 0;
      this.grounded = true;
      if (wasAir) this.events.onLand?.(impact);
    }
    if (this.pos.y > g + T.ceiling) { this.pos.y = g + T.ceiling; this.vel.y = Math.min(0, this.vel.y); }
    this.env.confine(this.pos, 0);
  }

  reset(pos: THREE.Vector3, yaw: number): void {
    this.pos.copy(pos); this.vel.set(0, 0, 0); this.yaw = yaw; this.pitch = -0.06;
    this.energy = this.tune.energyMax; this.assault = false; this.quickT = 0; this.quickCD = 0; this.regenT = 0;
    this.grounded = true; this.state = 'STANDBY'; this.locked = false; this.staggered = false;
  }

  snapshot() {
    return {
      pos: [+this.pos.x.toFixed(2), +this.pos.y.toFixed(2), +this.pos.z.toFixed(2)],
      vel: [+this.vel.x.toFixed(2), +this.vel.y.toFixed(2), +this.vel.z.toFixed(2)],
      energy: +this.energy.toFixed(1), state: this.state, assault: this.assault, grounded: this.grounded,
    };
  }
}
