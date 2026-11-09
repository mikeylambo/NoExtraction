import * as THREE from 'three';
import { MechFrame, ChaseCamera, LockSystem, RigDriver, buildPlayerMech, cloneBaseline, updateThrusterTime, type MechRig, type MechPalette } from '@slu/mech-frame';
import { AEGIS, type AegisSystem } from '../../data/aegis';
import { FEEL } from '../../data/feel';
import { PALETTE } from '../../data/palette';
import type { World } from '../game/World';
import type { InputFrame } from '../game/Input';
import type { MechHostile } from '../ai/MechHostile';

/** Aegis wears signal white; its HUD shifts to red as systems fail. */
export const AEGIS_PALETTE: MechPalette = { armor: 0xe9edf2, armor2: 0x2a3036, dark: 0x15191d, metal: 0x7a838c, joint: 0x23272b, accent: 0xb9c6d2, glow: 0xf4f7ff };

interface Shell { p: THREE.Vector3; v: THREE.Vector3; life: number; mesh: THREE.Mesh; target: MechHostile | null; dmg: number; missile: boolean }

/**
 * Aegis-07: @slu/mech-frame movement/camera/lock (AlphaMech feel) + this game's armor, weapons,
 * components and authored systems loss.
 */
export class Aegis {
  readonly frame: MechFrame;
  readonly cam: ChaseCamera;
  readonly lock = new LockSystem<MechHostile>();
  readonly rig: MechRig;
  readonly driver: RigDriver;
  active = false;
  armor: number = AEGIS.armor;
  armorMax: number = AEGIS.armor;
  readonly lost = new Set<AegisSystem>();
  stormT = 0;
  private boostHeld = 0;
  private boostConsumed = false;
  private rifleMag: number = AEGIS.rifle.mag;
  private rifleCD = 0;
  private reloadT = 0;
  cannonShells: number = AEGIS.cannon.shells;
  private cannonReload = 0;
  private cannonWind = 0;
  missileCD = 0;
  private missileQueue = 0;
  private missileT = 0;
  private bladeStep = 0;
  private bladeT = 0;
  private bladeCD = 0;
  private lunge = 0;
  private shells: Shell[] = [];
  private pendingHits: { t: number; dmg: number; range: number; impact: number; color: number }[] = [];
  invuln = 0;
  /** Lines displayed on the cockpit status list. */
  readonly events: string[] = [];
  aimYawOffset = 0;
  bounds: { center: THREE.Vector3; radius: number } | null = null;
  scriptedLock = false;

  constructor(private readonly w: World) {
    const env = {
      groundAt: (x: number, z: number) => { const g = w.collision.mechGroundAt(x, z, this.frame.pos.y + 4); return g === -Infinity ? -10000 : g; },
      confine: (pos: THREE.Vector3) => {
        w.collision.resolveCylinder(pos, 4.5, 10, 4, true);
        if (this.bounds) { const d = pos.clone().sub(this.bounds.center).setY(0); const l = d.length(); if (l > this.bounds.radius) { d.multiplyScalar(this.bounds.radius / l); pos.x = this.bounds.center.x + d.x; pos.z = this.bounds.center.z + d.z; return true; } }
        return false;
      },
    };
    this.frame = new MechFrame(env, cloneBaseline(), {
      onQuickBoost: (d) => { w.audio?.sfx('mech.boost', this.frame.pos, 1); w.fx.burst(this.frame.pos.clone().setY(this.frame.pos.y + 5), { count: 18, speed: 22, life: 0.35, size: 1.4, color: PALETTE.signal, dir: d.clone().negate(), spread: 0.4 }); w.addShake(0.12); },
      onAssault: (on) => { if (on) w.audio?.sfx('mech.assault', this.frame.pos, 0.8); },
      onLand: (v) => { if (v > 20) { w.audio?.sfx('mech.step', this.frame.pos, 1); w.addShake(0.2); w.fx.snowPuff(this.frame.pos, 6); } },
      onEmpty: () => w.audio?.sfx('empty', null, 0.5),
    });
    this.cam = new ChaseCamera(this.frame.tune);
    this.cam.baseFov = AEGIS.fov;
    this.cam.shakeCap = FEEL.shakeCap.mech;
    this.lock.range = AEGIS.lock.range;
    this.rig = buildPlayerMech(AEGIS_PALETTE);
    this.driver = new RigDriver(this.rig);
    this.rig.root.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true; });
    w.scene.add(this.rig.root);
    this.applyComponents();
  }

  /** Components decide what works when Aegis boots (GDD §6). */
  applyComponents(): void {
    const flight = this.w.hasComponent('flightGovernor');
    this.frame.caps = { sustainedFlight: flight, hopHeight: 12, airBoost: flight };
    this.rig.shoulderWeaponR.visible = this.w.hasComponent('missileRack') && !this.lost.has('shoulders');
    this.rig.shoulderWeaponL.visible = !this.lost.has('shoulderCannon') && !this.lost.has('shoulders');
    this.rig.armL.visible = !this.lost.has('leftArm');
  }

  get hasBlade(): boolean { return this.w.hasComponent('arcBlade'); }
  get hasMissiles(): boolean { return this.w.hasComponent('missileRack'); }
  get hardLockOnline(): boolean { return !this.lost.has('hardLock') && this.stormT <= 0; }
  get armor01(): number { return this.armor / this.armorMax; }
  get rifleAmmo(): number { return this.rifleMag; }
  get reloading(): boolean { return this.reloadT > 0; }
  get cannonReady01(): number { return this.cannonShells > 0 ? 1 : 1 - this.cannonReload / AEGIS.cannon.reload; }
  get missileReady01(): number { return 1 - this.missileCD / AEGIS.missiles.cooldown; }
  get alive(): boolean { return this.armor > 0; }

  spawn(p: THREE.Vector3, yaw: number): void {
    this.frame.reset(p, yaw); this.cam.snap({ pos: this.frame.pos, yaw, pitch: this.frame.pitch, assault: false, locked: null, speed: 0 });
    this.lock.release();
  }

  loseSystem(s: AegisSystem): void {
    if (this.lost.has(s)) return;
    this.lost.add(s);
    this.events.push(s);
    if (s === 'hardLock') this.lock.release();
    this.w.audio?.sfx('mech.systemloss', null, 1);
    if (s === 'leftArm') { this.w.fx.explosion(this.rig.armL.getWorldPosition(new THREE.Vector3()), 2, 0xffa060); }
    if (s === 'shoulderCannon') { this.w.fx.explosion(this.rig.shoulderWeaponL.getWorldPosition(new THREE.Vector3()), 1.6, 0xffa060); }
    this.applyComponents();
  }
  restoreSystem(s: AegisSystem): void { this.lost.delete(s); this.applyComponents(); }

  /** Magnetic storm: hard lock offline, manual aim, aim-assist halved. */
  storm(seconds: number): void { this.stormT = seconds; this.lock.release(); }
  stormStatic(seconds: number): void { this.stormT = Math.max(this.stormT, Math.min(seconds, 2)); }

  damage(amount: number, from?: THREE.Vector3): void {
    if (!this.active || this.w.dev.god || this.invuln > 0 || this.armor <= 0) return;
    const d = amount * this.w.difficulty.enemyDamage;
    this.armor = Math.max(0, this.armor - d);
    this.w.addShake(d > 150 ? FEEL.shake.mechHeavyHit : FEEL.shake.mechHit);
    this.w.hud?.hurt(from ?? null, this.frame.pos, this.frame.yaw);
    if (d > 40) this.w.audio?.sfx('mech.alarm', null, 0.6);
    if (this.armor <= 0) { this.w.fx.explosion(this.frame.pos.clone().setY(this.frame.pos.y + 6), 3); this.w.audio?.sfx('mech.explosion', this.frame.pos, 1); this.w.time.slowmo(FEEL.death.scale, FEEL.death.slowmo * 1000); this.w.counters.deaths++; }
  }
  repair(amount: number = AEGIS.repairStation): void { this.armor = Math.min(this.armorMax, this.armor + amount); this.w.audio?.sfx('ui.checkpoint', null, 0.8); }

  private hostiles(): MechHostile[] { return this.w.mechHostiles.filter((h) => h.alive && h.targetable); }

  update(dt: number, f: InputFrame): void {
    const w = this.w, fr = this.frame;
    this.stormT = Math.max(0, this.stormT - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    const control = !w.cinematic.controlLocked && this.alive && !this.scriptedLock;
    if (control) { fr.yaw += f.lookX * 1.05; fr.pitch = Math.max(fr.tune.pitchMin, Math.min(fr.tune.pitchMax, fr.pitch + f.lookY)); }
    fr.locked = !control;

    // boost: tap → quick boost; hold ≥ 0.3 s → assault boost while held
    if (control && f.down.has('m_boost')) {
      this.boostHeld += dt;
      if (this.boostHeld >= AEGIS.assaultHoldSeconds) { fr.setAssault(true); this.boostConsumed = true; }
    } else {
      if (this.boostHeld > 0 && !this.boostConsumed && control) {
        const wish = fr.forward().multiplyScalar(f.moveZ).add(fr.right().multiplyScalar(f.moveX));
        fr.quickBoost(wish.lengthSq() > 0.01 ? wish : fr.forward());
      }
      this.boostHeld = 0; this.boostConsumed = false; fr.setAssault(false);
    }
    if (this.lunge > 0) { this.lunge -= dt; const d = fr.forward(); fr.vel.x = d.x * AEGIS.blade.lungeSpeed; fr.vel.z = d.z * AEGIS.blade.lungeSpeed; }
    fr.update(dt, { moveX: f.moveX, moveZ: f.moveZ, rise: f.down.has('m_jets'), descend: f.down.has('m_descend') }, w.dev.god);

    // lock
    const hs = this.hostiles();
    this.lock.prune();
    if (this.lock.hard && !this.lock.primary) this.lock.release(); // target died: drop to soft lock
    if (control && f.pressed.has('m_lock')) {
      if (this.hardLockOnline) { const on = this.lock.toggleHard(hs, fr.pos, fr.forward()); w.audio?.sfx(on ? 'mech.lock' : 'ui.back', null, 0.6); }
      else w.audio?.sfx('mech.systemloss', null, 0.4);
    }
    if (!this.lock.hard) this.lock.acquire(hs, fr.pos, this.aimForward());
    if (control) this.weapons(dt, f);
    this.updateShells(dt);
    for (const h of this.pendingHits) { h.t -= dt; if (h.t <= 0) this.meleeHit(h.dmg, h.range, h.impact, h.color); }
    this.pendingHits = this.pendingHits.filter((h) => h.t > 0);
  }

  /** Where the camera looks (manual aim). */
  aimForward(): THREE.Vector3 { const d = new THREE.Vector3(); this.w.camera.getWorldDirection(d); return d.setY(0).normalize(); }

  /** Aim assist: soft target if within the assist cone (halved by the storm), else manual. */
  private aimTarget(): MechHostile | null {
    const t = this.lock.hard ? this.lock.primary : this.lock.primary;
    if (!t) return null;
    if (this.lock.hard && this.hardLockOnline) return t;
    const assist = AEGIS.lock.assist * (this.stormT > 0 || this.lost.has('hardLock') ? AEGIS.lock.stormAssistScale : 1) * (0.5 + this.w.options.aimAssist);
    const dir = new THREE.Vector3(); this.w.camera.getWorldDirection(dir);
    const to = t.aimPoint().sub(this.w.camera.position).normalize();
    return to.dot(dir) > Math.cos(0.05 + assist * 0.12) ? t : null;
  }

  private weapons(dt: number, f: InputFrame): void {
    const w = this.w, fr = this.frame;
    this.rifleCD = Math.max(0, this.rifleCD - dt);
    this.bladeCD = Math.max(0, this.bladeCD - dt);
    this.bladeT = Math.max(0, this.bladeT - dt);
    if (this.bladeT <= 0) this.bladeStep = 0;
    this.missileCD = Math.max(0, this.missileCD - dt);
    if (this.reloadT > 0) { this.reloadT -= dt; if (this.reloadT <= 0) this.rifleMag = AEGIS.rifle.mag; }
    if (this.cannonShells < AEGIS.cannon.shells) { this.cannonReload -= dt; if (this.cannonReload <= 0) { this.cannonShells = AEGIS.cannon.shells; this.cannonReload = 0; } }
    const weaponsGone = this.lost.has('weapons');

    // rifle
    if (!weaponsGone && f.down.has('m_rifle') && this.rifleCD <= 0 && this.reloadT <= 0) {
      const interval = AEGIS.rifle.interval * (this.lost.has('leftArm') ? AEGIS.rifleRightMount.intervalScale : 1);
      this.rifleCD = interval;
      this.rifleMag--;
      if (this.rifleMag <= 0) this.reloadT = AEGIS.rifle.reload;
      this.fireRifle();
    }
    // cannon (0.4 s wind-up)
    if (!weaponsGone && !this.lost.has('shoulderCannon') && !this.lost.has('shoulders') && f.pressed.has('m_cannon') && this.cannonShells > 0 && this.cannonWind <= 0) { this.cannonWind = AEGIS.cannon.windup; w.audio?.sfx('mech.servo', fr.pos, 0.8); }
    if (this.cannonWind > 0) { this.cannonWind -= dt; if (this.cannonWind <= 0) this.fireCannon(); }
    // missiles
    if (!weaponsGone && this.hasMissiles && !this.lost.has('shoulders') && f.pressed.has('m_missiles') && this.missileCD <= 0) { this.missileCD = AEGIS.missiles.cooldown; this.missileQueue = AEGIS.missiles.count; this.missileT = 0; }
    if (this.missileQueue > 0) { this.missileT -= dt; if (this.missileT <= 0) { this.missileT = AEGIS.missiles.spacing; this.missileQueue--; this.launchMissile(); } }
    // blade / shove
    if (f.pressed.has('m_blade') && this.bladeCD <= 0) this.melee();
  }

  private muzzle(): THREE.Vector3 { const m = new THREE.Vector3(); this.rig.muzzleR.getWorldPosition(m); return m; }

  private fireRifle(): void {
    const w = this.w;
    const t = this.aimTarget();
    const m = this.muzzle();
    const dir = new THREE.Vector3(); w.camera.getWorldDirection(dir);
    let end: THREE.Vector3;
    const spread = AEGIS.rifle.spread;
    const jitter = () => (w.rng.next() - 0.5) * spread * 2;
    if (t) {
      end = t.aimPoint().add(new THREE.Vector3(jitter() * 60, jitter() * 60, jitter() * 60));
      if (!w.collision.blocked(m, end, 'mech') && !(t.evading && w.rng.chance(t.evasion))) {
        const killed = t.damage(AEGIS.rifle.damage * w.difficulty.playerDamage, this.frame.pos, AEGIS.rifle.impact);
        w.fx.burst(end, { count: 4, speed: 8, life: 0.25, size: 0.6, color: 0xffd0a0 });
        if (killed) w.hitstop(FEEL.hitstop.mechRifleKill);
      }
    } else {
      const from = w.camera.position.clone();
      end = from.clone().addScaledVector(dir.add(new THREE.Vector3(jitter(), jitter(), jitter())).normalize(), AEGIS.rifle.range);
      const hit = w.collision.ray(from, end, 'mech');
      if (hit) { end = hit.point; w.fx.burst(end, { count: 3, speed: 5, life: 0.3, size: 0.5, color: 0xe8eef3, additive: false, alpha: 0.6 }); }
      for (const h of this.hostiles()) { const r = h.rayHit(from, dir, hit ? hit.t * AEGIS.rifle.range : AEGIS.rifle.range); if (r) { if (h.damage(AEGIS.rifle.damage * w.difficulty.playerDamage, this.frame.pos, AEGIS.rifle.impact)) w.hitstop(FEEL.hitstop.mechRifleKill); break; } }
    }
    w.fx.tracer(m, end, PALETTE.signal, 0.08);
    w.fx.flash(m, 0xfff0d0, 3, 0.05);
    w.audio?.sfx('mech.rifle', this.frame.pos, 0.8);
    w.addShake(FEEL.shake.mechRifle);
    this.driver.fireRifle();
    // on-foot enemies near the impact die (mech scale)
    for (const e of w.enemies) if (e.alive && e.pos.distanceTo(end) < 3) e.damage(200, { from: this.frame.pos, mech: true });
  }

  private fireCannon(): void {
    const w = this.w;
    this.cannonShells--;
    if (this.cannonShells <= 0) this.cannonReload = AEGIS.cannon.reload;
    const m = new THREE.Vector3(); this.rig.muzzleCannon.getWorldPosition(m);
    const t = this.aimTarget();
    const dir = t ? t.aimPoint().sub(m).normalize() : (() => { const d = new THREE.Vector3(); w.camera.getWorldDirection(d); return d; })();
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff2d0 }));
    mesh.position.copy(m); w.scene.add(mesh);
    this.shells.push({ p: m.clone(), v: dir.multiplyScalar(AEGIS.cannon.speed), life: 3, mesh, target: t, dmg: AEGIS.cannon.damage, missile: false });
    w.fx.flash(m, 0xffe0b0, 9, 0.12);
    w.audio?.sfx('mech.cannon', this.frame.pos, 1);
    w.addShake(FEEL.shake.mechCannon);
    this.driver.fireShoulder();
  }

  private launchMissile(): void {
    const w = this.w;
    const bay = this.rig.missileBays[this.missileQueue % Math.max(1, this.rig.missileBays.length)];
    const from = new THREE.Vector3(); if (bay) bay.getWorldPosition(from); else from.copy(this.frame.pos).setY(this.frame.pos.y + 10);
    const t = this.lock.primary;
    const dir = this.frame.forward().add(new THREE.Vector3((w.rng.next() - 0.5) * 0.8, 0.7, (w.rng.next() - 0.5) * 0.8)).normalize();
    const mesh = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.4, 6), new THREE.MeshBasicMaterial({ color: 0xf4f7ff }));
    mesh.position.copy(from); w.scene.add(mesh);
    this.shells.push({ p: from, v: dir.multiplyScalar(AEGIS.missiles.speed * 0.6), life: AEGIS.missiles.life, mesh, target: t, dmg: AEGIS.missiles.damage, missile: true });
    w.audio?.sfx('mech.missile', this.frame.pos, 0.6);
  }

  private melee(): void {
    const w = this.w, fr = this.frame;
    const t = this.lock.primary ?? this.lock.best(this.hostiles(), fr.pos, fr.forward());
    if (this.hasBlade) {
      const hits = AEGIS.blade.hits;
      const step = this.bladeStep;
      this.bladeCD = AEGIS.blade.cooldown; this.bladeT = AEGIS.blade.comboWindow; this.bladeStep = (step + 1) % hits.length;
      // boost-lunge into a target up to 25 m away
      if (t && step === 0) { const d = t.pos.distanceTo(fr.pos); if (d > AEGIS.blade.range && d < AEGIS.blade.range + AEGIS.blade.lungeDistance) { fr.yaw = Math.atan2(-(t.pos.x - fr.pos.x), -(t.pos.z - fr.pos.z)); this.lunge = (d - AEGIS.blade.range * 0.6) / AEGIS.blade.lungeSpeed; } }
      this.driver.swingBlade();
      w.audio?.sfx('mech.blade', fr.pos, 1);
      const dmg = hits[step]!;
      const lungeDelay = Math.max(0.12, this.lunge);
      this.pendingHits.push({ t: lungeDelay, dmg, range: AEGIS.blade.range, impact: 180, color: PALETTE.signal });
    } else {
      this.bladeCD = AEGIS.shove.cooldown;
      this.driver.swingBlade();
      w.audio?.sfx('mech.shove', fr.pos, 0.8);
      this.meleeHit(AEGIS.shove.damage, AEGIS.shove.range, AEGIS.shove.impact, 0xb9c9d6);
    }
  }

  private meleeHit(dmg: number, range: number, impact: number, color: number): void {
    const w = this.w, fr = this.frame, f = fr.forward();
    let any = false;
    for (const h of this.hostiles()) {
      const d = h.pos.clone().sub(fr.pos); d.y = 0;
      if (d.length() < range + 6 && d.normalize().dot(f) > 0.25) { any = true; h.damage(dmg * w.difficulty.playerDamage, fr.pos, impact); }
    }
    for (const e of w.enemies) if (e.alive && e.pos.distanceTo(fr.pos) < range) e.damage(999, { from: fr.pos, mech: true });
    if (any) { w.addShake(0.3); w.fx.burst(fr.pos.clone().setY(fr.pos.y + 7).addScaledVector(f, range * 0.7), { count: 20, speed: 14, life: 0.3, size: 0.8, color }); }
  }

  private updateShells(dt: number): void {
    const w = this.w;
    for (const s of this.shells) {
      s.life -= dt;
      if (s.missile) {
        const tgt = s.target?.alive ? s.target.aimPoint() : null;
        if (tgt) { const want = tgt.sub(s.p).normalize().multiplyScalar(AEGIS.missiles.speed); s.v.lerp(want, Math.min(1, AEGIS.missiles.turn * dt)); }
        else s.v.setLength(AEGIS.missiles.speed);
        if (Math.floor(s.life * 30) !== Math.floor((s.life + dt) * 30)) w.fx.burst(s.p, { count: 1, speed: 0.5, life: 0.5, size: 0.8, grow: 1, color: 0xd8dde2, additive: false, alpha: 0.5 });
      }
      const next = s.p.clone().addScaledVector(s.v, dt);
      let hit: MechHostile | null = null;
      for (const h of this.hostiles()) if (h.aimPoint().distanceTo(next) < (s.missile ? 5 : 6)) { hit = h; break; }
      const wh = w.collision.ray(s.p, next, 'mech');
      s.p.copy(wh ? wh.point : next); s.mesh.position.copy(s.p);
      if (hit || wh || s.life <= 0 || s.p.y < -50) {
        s.life = 0;
        if (hit) {
          hit.damage(s.dmg * w.difficulty.playerDamage, this.frame.pos, s.missile ? 90 : AEGIS.cannon.impact);
          if (!s.missile) { w.hitstop(FEEL.hitstop.cannonHit); if (!w.options.reduceBlur) w.hud?.radialBlur(FEEL.blur.cannonRadial); }
        }
        if (!s.missile) for (const h of this.hostiles()) if (h !== hit && h.pos.distanceTo(s.p) < AEGIS.cannon.splash) h.damage(s.dmg * 0.3, s.p, 120);
        for (const e of w.enemies) if (e.alive && e.pos.distanceTo(s.p) < 10) e.damage(999, { from: s.p, mech: true });
        w.fx.explosion(s.p, s.missile ? 1.2 : 2.6, 0xffb070);
        w.audio?.sfx(s.missile ? 'debris.impact' : 'mech.explosion', s.p, s.missile ? 0.5 : 0.9);
      }
    }
    this.shells = this.shells.filter((s) => { if (s.life <= 0) { w.scene.remove(s.mesh); return false; } return true; });
  }

  present(dt: number): void {
    const fr = this.frame;
    this.rig.root.visible = this.active || this.parked;
    this.rig.root.position.copy(fr.pos);
    this.rig.root.rotation.y = fr.yaw + Math.PI;
    const t = this.lock.primary;
    const aimYaw = t ? Math.atan2(t.pos.x - fr.pos.x, t.pos.z - fr.pos.z) + Math.PI : fr.yaw + Math.PI;
    this.driver.update(dt, { pos: fr.pos, vel: fr.vel, yaw: fr.yaw + Math.PI, aimYaw, aimPitch: fr.pitch * 0.6, grounded: fr.grounded, maxSpeed: fr.tune.speed, thrust01: fr.assault ? 1 : Math.min(1, fr.speed / fr.tune.speed) * 0.55, thrustUp01: fr.state === 'VERTICAL THRUST' ? 1 : fr.grounded ? 0 : 0.25, quickDir: fr.quickBoosting ? fr.vel.clone().normalize() : null, stagger01: 0 });
    updateThrusterTime(this.w.simTime);
  }
  parked = false;

  updateCamera(dt: number): void {
    const fr = this.frame;
    this.cam.shakeScale = this.w.options.reduceShake;
    this.cam.update(dt, { pos: fr.pos, yaw: fr.yaw, pitch: fr.pitch, assault: fr.assault, locked: this.lock.hard ? this.lock.primary : null, speed: fr.speed });
  }

  dispose(): void { this.w.scene.remove(this.rig.root); for (const s of this.shells) this.w.scene.remove(s.mesh); this.shells = []; }
}
