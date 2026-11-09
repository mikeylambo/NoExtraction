import * as THREE from 'three';
import { RigDriver, buildStandardMech, buildHeavyMech, type MechRig, type MechPalette, type Lockable } from '@slu/mech-frame';
import { ARCHETYPES, WARDEN_ROCKETS } from '../../data/enemies';
import { PALETTE } from '../../data/palette';
import { glowSprite } from '../world/Materials';
import type { World } from '../game/World';

export const SABLE_FRAME_PALETTE: MechPalette = { armor: 0x4a5058, armor2: 0x22262b, dark: 0x14171a, metal: 0x6c747c, joint: 0x23262a, accent: 0x8a0f18, glow: 0xff2a3a };
export const SOVEREIGN_PALETTE: MechPalette = { armor: 0x2e3238, armor2: 0x17191c, dark: 0x0c0d0f, metal: 0x5e656c, joint: 0x1c1e21, accent: 0xff2a3a, glow: 0xff2a3a };

export interface Projectile { p: THREE.Vector3; v: THREE.Vector3; life: number; dmg: number; homing: number; mesh: THREE.Object3D; radius: number }

/**
 * Mech-scale Sable hostile (Warden frame): orbits at range, boost-strafes, telegraphed rifle
 * bursts (red glint) and rocket pairs (lock tone). Sovereign/Marshal extends this.
 */
export class MechHostile implements Lockable {
  readonly pos = new THREE.Vector3();
  readonly vel = new THREE.Vector3();
  yaw = 0;
  hp: number;
  hpMax: number;
  alive = true;
  targetable = true;
  /** Inactive frames neither move nor shoot (scripted entrances). */
  active = true;
  readonly rig: MechRig;
  protected driver: RigDriver;
  protected glint: THREE.Sprite;
  protected projectiles: Projectile[] = [];
  protected burstLeft = 0; protected burstT = 0; protected gapT = 2; protected teleT = 0;
  protected rocketCD = 4; protected rocketTele = 0;
  protected dashT = 0; protected dashCD = 2; protected dashDir = new THREE.Vector3();
  protected orbitDir = 1;
  protected band: [number, number] = [110, 240];
  speed = ARCHETYPES.warden.walk * 1.4;
  impactStagger = 0;
  private impact = 0;
  name = 'Warden';
  onDeath: (() => void) | null = null;
  bounds: { center: THREE.Vector3; radius: number } | null = null;

  constructor(protected readonly w: World, at: THREE.Vector3, yaw = 0, hp: number = ARCHETYPES.warden.hp, heavy = false) {
    this.hp = this.hpMax = hp;
    this.pos.copy(at); this.yaw = yaw;
    this.rig = heavy ? buildHeavyMech(SOVEREIGN_PALETTE) : buildStandardMech(SABLE_FRAME_PALETTE, 'gun');
    this.rig.root.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true; });
    this.driver = new RigDriver(this.rig);
    this.glint = glowSprite(PALETTE.red, 6, 0);
    this.rig.root.add(this.glint);
    this.glint.position.set(0, 7, -3);
    w.scene.add(this.rig.root);
    this.orbitDir = w.rng.chance(0.5) ? 1 : -1;
    this.gapT = 1.5 + w.rng.next() * 2;
  }

  /** Boost-strafing: hard to hit. */
  get evading(): boolean { return this.dashT > 0; }
  /** Miss chance against this frame while it evades. */
  evasion = 0.4;

  aimPoint(): THREE.Vector3 { return this.pos.clone().setY(this.pos.y + 7); }

  rayHit(o: THREE.Vector3, d: THREE.Vector3, maxT: number): { t: number } | null {
    for (const h of [3, 7, 10]) {
      const c = this.pos.clone().setY(this.pos.y + h);
      const oc = o.clone().sub(c); const b = oc.dot(d); const cc = oc.dot(oc) - 16; const disc = b * b - cc;
      if (disc >= 0) { const t = -b - Math.sqrt(disc); if (t > 0 && t < maxT) return { t }; }
    }
    return null;
  }

  /** Returns true if this hit killed it. */
  damage(amount: number, from?: THREE.Vector3, impact = 0): boolean {
    if (!this.alive || !this.targetable) return false;
    this.hp -= amount;
    this.impact += impact;
    if (this.impact > 900) { this.impact = 0; this.impactStagger = 1.2; }
    if (this.hp <= 0) { this.die(); return true; }
    void from;
    return false;
  }

  protected die(): void {
    this.alive = false;
    this.w.fx.explosion(this.aimPoint(), 3.2, 0xffa050);
    this.w.audio?.sfx('mech.explosion', this.pos, 1);
    this.w.addShake(0.4);
    this.glint.visible = false;
    this.w.counters.kills++;
    this.onDeath?.();
  }

  protected target(): THREE.Vector3 { return this.w.focusPos(); }

  update(dt: number): void {
    this.updateProjectiles(dt);
    if (!this.alive) { this.rig.root.position.y -= dt * 2; this.rig.root.rotation.z = Math.min(0.6, this.rig.root.rotation.z + dt * 0.5); return; }
    if (!this.active) return;
    this.impactStagger = Math.max(0, this.impactStagger - dt);
    const tgt = this.target();
    const to = tgt.clone().sub(this.pos).setY(0);
    const dist = to.length(); to.divideScalar(Math.max(1e-3, dist));
    this.yaw = Math.atan2(-to.x, -to.z);
    if (this.impactStagger > 0) { this.vel.multiplyScalar(0.9); this.integrate(dt); return; }
    // boost-strafe
    this.dashCD -= dt;
    if (this.dashT > 0) { this.dashT -= dt; this.vel.copy(this.dashDir).multiplyScalar(170); }
    else {
      if (this.dashCD <= 0) { this.dashCD = 3 + this.w.rng.next() * 3; this.dashT = 0.25; this.dashDir.set(-to.z * this.orbitDir, 0, to.x * this.orbitDir); this.orbitDir *= this.w.rng.chance(0.4) ? -1 : 1; this.w.audio?.sfx('mech.boost', this.pos, 0.6); }
      const radial = dist > this.band[1] ? 1 : dist < this.band[0] ? -1 : 0;
      const want = new THREE.Vector3(-to.z * this.orbitDir, 0, to.x * this.orbitDir).multiplyScalar(0.8).addScaledVector(to, radial).normalize().multiplyScalar(this.speed);
      this.vel.lerp(want, Math.min(1, dt * 2));
    }
    this.integrate(dt);
    this.attack(dt, tgt, dist);
  }

  protected integrate(dt: number): void {
    this.pos.addScaledVector(this.vel, dt);
    this.w.collision.resolveCylinder(this.pos, 4.5, 10, 4, true);
    if (this.bounds) { const d = this.pos.clone().sub(this.bounds.center).setY(0); const l = d.length(); if (l > this.bounds.radius) { d.multiplyScalar(this.bounds.radius / l); this.pos.x = this.bounds.center.x + d.x; this.pos.z = this.bounds.center.z + d.z; } }
    const g = this.w.collision.mechGroundAt(this.pos.x, this.pos.z, this.pos.y + 6);
    this.pos.y += ((g === -Infinity ? this.pos.y : g) - this.pos.y) * Math.min(1, dt * 8);
  }

  protected attack(dt: number, tgt: THREE.Vector3, dist: number): void {
    const W = ARCHETYPES.warden.weapon, tel = this.w.difficulty.telegraph;
    if (dist > W.range) return;
    if (this.burstLeft > 0) {
      this.burstT -= dt;
      if (this.burstT <= 0) { this.burstT = W.interval; this.burstLeft--; this.shoot(tgt, W.damage, W.accuracy); if (this.burstLeft <= 0) this.gapT = W.burstGap + this.w.rng.next(); }
    } else if (this.teleT > 0) {
      this.teleT -= dt; this.glint.material.opacity = 0.95;
      if (this.teleT <= 0) { this.burstLeft = W.burst; this.glint.material.opacity = 0; }
    } else { this.gapT -= dt; if (this.gapT <= 0) { this.teleT = W.telegraph * tel; this.w.audio?.sfx('enemy.glint', this.pos, 1); } }
    // rockets: lock tone telegraph, then a pair
    this.rocketCD -= dt;
    if (this.rocketTele > 0) { this.rocketTele -= dt; if (this.rocketTele <= 0) for (let i = 0; i < WARDEN_ROCKETS.count; i++) this.fireRocket(tgt, i); }
    else if (this.rocketCD <= 0) { this.rocketCD = WARDEN_ROCKETS.cooldown + this.w.rng.next() * 3; this.rocketTele = WARDEN_ROCKETS.telegraph * tel; this.w.audio?.sfx('mech.lock', null, 0.7); this.w.hud?.lockWarning(this.rocketTele); }
  }

  protected shoot(tgt: THREE.Vector3, dmg: number, acc: number): void {
    const m = this.aimPoint().addScaledVector(new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)), 4);
    const aim = tgt.clone().setY(tgt.y + 7);
    const a = this.w.aegis;
    let chance = acc * this.w.difficulty.enemyAccuracy;
    if (a) chance *= a.frame.quickBoosting ? 0.1 : a.frame.assault ? 0.5 : Math.max(0.35, 1 - a.frame.speed / 140);
    const hit = this.w.rng.chance(chance) && !this.w.collision.blocked(m, aim, 'mech');
    const end = hit ? aim : aim.clone().add(new THREE.Vector3((this.w.rng.next() - 0.5) * 18, (this.w.rng.next() - 0.5) * 8, (this.w.rng.next() - 0.5) * 18));
    this.w.fx.tracer(m, end, PALETTE.red, 0.08);
    this.w.fx.flash(m, 0xffb080, 3, 0.05);
    this.w.audio?.sfx('enemy.shot', this.pos, 1);
    if (hit) a?.damage(dmg, this.pos);
    this.driver.fireRifle();
  }

  protected fireRocket(tgt: THREE.Vector3, i: number): void {
    const from = this.aimPoint().add(new THREE.Vector3(i ? 2 : -2, 3, 0));
    const v = tgt.clone().setY(tgt.y + 6).sub(from).normalize().add(new THREE.Vector3(0, 0.5, 0)).normalize().multiplyScalar(WARDEN_ROCKETS.speed);
    const mesh = glowSprite(PALETTE.red, 3, 1);
    mesh.position.copy(from); this.w.scene.add(mesh);
    this.projectiles.push({ p: from, v, life: 6, dmg: WARDEN_ROCKETS.damage, homing: 1.1, mesh, radius: 7 });
    this.w.audio?.sfx('enemy.rocket', this.pos, 1);
  }

  protected updateProjectiles(dt: number): void {
    const w = this.w;
    for (const pr of this.projectiles) {
      pr.life -= dt;
      const tgt = this.target().setY(this.target().y + 6);
      if (pr.homing > 0) pr.v.lerp(tgt.clone().sub(pr.p).normalize().multiplyScalar(pr.v.length()), Math.min(1, pr.homing * dt));
      pr.p.addScaledVector(pr.v, dt); pr.mesh.position.copy(pr.p);
      if (Math.floor(pr.life * 25) !== Math.floor((pr.life + dt) * 25)) w.fx.burst(pr.p, { count: 1, speed: 0.4, life: 0.6, size: 1.2, grow: 1.5, color: 0x9aa0a6, additive: false, alpha: 0.4 });
      const hitPlayer = pr.p.distanceTo(tgt) < pr.radius;
      const ground = w.collision.mechGroundAt(pr.p.x, pr.p.z, pr.p.y + 1);
      if (hitPlayer || pr.p.y < ground || pr.life <= 0) {
        pr.life = 0;
        w.fx.explosion(pr.p, 1.6, 0xff9050);
        w.audio?.sfx('debris.impact', pr.p, 0.7);
        if (hitPlayer || pr.p.distanceTo(tgt) < pr.radius * 1.6) w.aegis?.damage(pr.dmg, pr.p);
      }
    }
    this.projectiles = this.projectiles.filter((p) => { if (p.life <= 0) { w.scene.remove(p.mesh); return false; } return true; });
  }

  present(dt: number): void {
    this.rig.root.visible = true;
    this.rig.root.position.copy(this.alive ? this.pos : this.rig.root.position);
    this.rig.root.rotation.y = this.yaw + Math.PI;
    if (this.alive) this.driver.update(dt, { pos: this.pos, vel: this.vel, yaw: this.yaw + Math.PI, aimYaw: this.yaw + Math.PI, aimPitch: 0, grounded: true, maxSpeed: this.speed, thrust01: Math.min(1, this.vel.length() / 120), thrustUp01: 0, quickDir: this.dashT > 0 ? this.dashDir : null, stagger01: this.impactStagger > 0 ? 1 : 0 });
  }

  dispose(): void { this.w.scene.remove(this.rig.root); for (const p of this.projectiles) this.w.scene.remove(p.mesh); this.projectiles = []; }
}
