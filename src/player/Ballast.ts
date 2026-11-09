import * as THREE from 'three';
import { PLAYER } from '../../data/player';
import { FEEL } from '../../data/feel';
import { buildHumanoid, HumanAnimator, type HumanRig } from '../world/Humanoid';
import { ShoulderCamera } from './ShoulderCamera';
import { Weapons } from './Weapons';
import { Visor } from './Visor';
import type { World } from '../game/World';
import type { InputFrame } from '../game/Input';
import type { Enemy } from '../ai/Enemy';
import type { Surface } from '../world/Collision';

const M = PLAYER.move;
const TD = PLAYER.takedown;
type Mode = 'move' | 'slide' | 'vault' | 'mantle' | 'takedown' | 'dead' | 'locked';

/**
 * Ballast on foot: movement (walk / sprint / crouch / slide / vault / mantle), takedowns with
 * chains, the visor, health and noise. Fixed-step simulation; presentation in `present()`.
 */
export class Ballast {
  readonly pos = new THREE.Vector3();
  readonly vel = new THREE.Vector3();
  facing = 0;
  mode: Mode = 'move';
  crouched = false;
  sprinting = false;
  private sprintToggle = false;
  grounded = true;
  surface: Surface = 'snow';
  health: number = PLAYER.health.max;
  private sinceDamage = 99;
  readonly cam = new ShoulderCamera();
  readonly weapons: Weapons;
  readonly visor: Visor;
  readonly rig: HumanRig;
  readonly anim: HumanAnimator;
  aiming = false;
  private aimToggle = false;
  private crouchToggle = false;

  // timers / actions
  private t = 0;
  private dur = 0;
  private from = new THREE.Vector3();
  private to = new THREE.Vector3();
  private slideDir = new THREE.Vector3();
  private slideCD = 0;
  private stepT = 0;
  private noiseT = 0;
  private landVel = 0;
  private tdTarget: Enemy | null = null;
  private tdHit = false;
  private tdChain = 0;
  /** Seconds left in the chain window after a takedown. */
  chainWindow = 0;
  chainCount = 0;
  chainCandidate: Enemy | null = null;
  takedownCandidate: Enemy | null = null;
  /** Darkness at the player's position (0 lit, 1 pitch dark). */
  darkness = 0;
  inSteam = false;
  submerged = 0;
  /** True on the step a takedown connected (for prompts/onboarding). */
  events: string[] = [];
  deadT = 0;
  private bodyYaw = 0;

  constructor(private readonly w: World) {
    this.rig = buildHumanoid('ballast');
    this.anim = new HumanAnimator(this.rig);
    this.anim.pose.maxSpeed = M.sprint;
    w.scene.add(this.rig.root);
    this.weapons = new Weapons(w, this);
    this.visor = new Visor(w, this);
  }

  get alive(): boolean { return this.mode !== 'dead'; }
  get height(): number { return this.crouched || this.mode === 'slide' ? M.crouchHeight : M.height; }
  get eye(): THREE.Vector3 { return this.pos.clone().setY(this.pos.y + this.height - 0.15); }
  get speed(): number { return Math.hypot(this.vel.x, this.vel.z); }
  get busy(): boolean { return this.mode !== 'move'; }

  /** Perception visibility multiplier. */
  get visibility(): number {
    if (this.inSteam || this.mode === 'dead') return 0;
    const V = PLAYER.visibility;
    let v = this.crouched || this.mode === 'slide' ? V.crouched : this.sprinting ? V.sprinting : V.standing;
    v *= 1 - this.darkness * (1 - V.dark);
    if (this.submerged > 0.6) v *= 0.4;
    return v;
  }

  spawn(p: THREE.Vector3, yaw: number): void {
    this.pos.copy(p); this.vel.set(0, 0, 0); this.facing = yaw; this.bodyYaw = yaw; this.mode = 'move'; this.crouched = false;
    this.cam.snapBehind(yaw); this.deadT = 0; this.tdTarget = null; this.chainWindow = 0; this.chainCount = 0;
    this.rig.root.visible = true; this.anim.pose.dead = 0;
  }

  damage(amount: number, from?: THREE.Vector3): void {
    if (this.mode === 'dead' || this.w.dev.god) return;
    const dmg = amount * this.w.difficulty.enemyDamage;
    this.health = Math.max(0, this.health - dmg);
    this.sinceDamage = 0;
    this.w.addShake(FEEL.shake.hurt * Math.min(1.5, dmg / 10));
    this.w.hud?.hurt(from ?? null, this.pos, this.cam.yaw);
    this.w.audio?.sfx('hit.flesh', this.pos, 0.6);
    if (this.health <= 0) this.die();
  }

  heal(to: number): void { this.health = Math.min(PLAYER.health.max, Math.max(this.health, to)); }

  die(): void {
    if (this.mode === 'dead') return;
    this.mode = 'dead'; this.deadT = 0;
    this.w.time.slowmo(FEEL.death.scale, FEEL.death.slowmo * 1000, 'easeIn');
    this.w.counters.deaths++;
    this.events.push('death');
  }

  setLocked(locked: boolean): void { if (this.mode === 'dead') return; this.mode = locked ? 'locked' : 'move'; if (locked) this.vel.set(0, 0, 0); }

  update(dt: number, f: InputFrame): void {
    this.events.length = 0;
    const w = this.w;
    this.slideCD = Math.max(0, this.slideCD - dt);
    this.chainWindow = Math.max(0, this.chainWindow - dt);
    if (this.chainWindow <= 0) this.chainCount = 0;
    this.sinceDamage += dt;
    // health regen to the cap (Story difficulty may raise the cap)
    const cap = w.difficulty.regenCap;
    if (this.mode !== 'dead' && this.sinceDamage > PLAYER.health.regenDelay && this.health < cap) this.health = Math.min(cap, this.health + PLAYER.health.regenRate * dt);

    if (this.mode === 'dead') { this.deadT += dt; this.vel.set(0, 0, 0); return; }
    const control = this.mode !== 'locked' && !w.cinematic.controlLocked;
    if (control) this.cam.look(f.lookX, f.lookY);

    // stance inputs
    const opt = w.options;
    if (control) {
      if (f.pressed.has('shoulder')) this.cam.swapShoulder();
      if (opt.aimMode === 'toggle') { if (f.pressed.has('aim')) this.aimToggle = !this.aimToggle; this.aiming = this.aimToggle; } else this.aiming = f.down.has('aim');
      const padToggle = f.pad || opt.sprintMode === 'toggle';
      if (padToggle) { if (f.pressed.has('sprint')) this.sprintToggle = !this.sprintToggle; } else this.sprintToggle = f.down.has('sprint');
      if (f.pressed.has('crouch')) {
        if (this.sprinting && this.speed > PLAYER.slide.minEntrySpeed && this.grounded && this.slideCD <= 0 && this.mode === 'move') this.startSlide();
        else if (opt.crouchMode === 'toggle' || f.pad) this.crouchToggle = !this.crouchToggle;
      }
      if (opt.crouchMode === 'hold' && !f.pad) this.crouchToggle = f.down.has('crouch');
      if (this.crouchToggle && !this.crouched) this.crouched = true;
      if (!this.crouchToggle && this.crouched && w.collision.free(this.pos.x, this.pos.z, this.pos.y + 0.2, this.pos.y + M.height, M.radius * 0.9)) this.crouched = false;
    }
    if (this.aiming) this.sprintToggle = false;

    switch (this.mode) {
      case 'move': this.updateMove(dt, f, control); break;
      case 'slide': this.updateSlide(dt, f); break;
      case 'vault': case 'mantle': this.updateTraverse(dt); break;
      case 'takedown': this.updateTakedown(dt); break;
      case 'locked': this.vel.multiplyScalar(0.8); this.applyGravity(dt); break;
    }

    // takedown availability
    this.takedownCandidate = this.mode === 'move' ? this.findTakedown(TD.range) : null;
    this.chainCandidate = this.chainWindow > 0 && this.chainCount < TD.chainMax && this.mode === 'move' ? this.findChain() : null;
    if (control && this.mode === 'move' && f.pressed.has('takedown')) {
      const tgt = this.chainCandidate ?? this.takedownCandidate;
      if (tgt) this.startTakedown(tgt, tgt === this.chainCandidate);
    }
    if (control && this.mode === 'move' && f.pressed.has('stim') && w.inventory.stims > 0 && this.health < PLAYER.health.max) {
      w.inventory.stims--; this.heal(100); w.audio?.sfx('gear.rattle', this.pos, 0.8); w.hud?.toast('Stim', 'cyan');
    }

    this.weapons.update(dt, f, control && (this.mode === 'move' || this.mode === 'slide'));
    this.visor.update(dt, f, control);
    this.emitNoise(dt);
    w.inventory.health = this.health;
  }

  // ------------------------------------------------------------------ movement
  private updateMove(dt: number, f: InputFrame, control: boolean): void {
    const w = this.w;
    const fwd = this.cam.forward(), rgt = this.cam.right();
    const ix = control ? f.moveX : 0, iz = control ? f.moveZ : 0;
    const wish = fwd.multiplyScalar(iz).add(rgt.multiplyScalar(ix));
    const mag = Math.min(1, wish.length());
    if (mag > 1e-3) wish.divideScalar(Math.max(1e-3, wish.length()));
    this.sprinting = this.sprintToggle && !this.crouched && iz > 0.3 && mag > 0.5;
    if (!this.sprinting && mag < 0.1) this.sprintToggle = this.sprintToggle && f.pad;
    let target = this.crouched ? M.crouch : this.sprinting ? M.sprint : M.walk;
    if (this.surface === 'drift') target *= M.driftSpeedScale;
    if (this.submerged > 0.3) target *= 0.6;
    if (this.aiming) target = Math.min(target, M.walk * 0.85);
    const ice = this.surface === 'ice';
    const accel = (this.grounded ? M.accelGround : M.accelAir) * (ice ? M.turnRateIceScale : 1);
    const wantX = wish.x * target * mag, wantZ = wish.z * target * mag;
    const k = 1 - Math.exp(-(mag > 0.05 ? accel / Math.max(1, target) : M.decel / 4 * (ice ? 0.3 : 1)) * dt);
    this.vel.x += (wantX - this.vel.x) * k;
    this.vel.z += (wantZ - this.vel.z) * k;

    // vault / mantle
    if (control && f.pressed.has('jump') && this.grounded && !w.interact.focused) this.tryTraverse(mag > 0.1 ? wish : this.cam.forward());

    this.applyGravity(dt);
    this.integrate(dt);

    // facing: aim → camera, else movement
    const sp = this.speed;
    if (this.aiming || this.weapons.recentlyFired) this.facing = this.cam.yaw;
    else if (sp > 0.4) this.facing = Math.atan2(-this.vel.x, -this.vel.z);
  }

  private applyGravity(dt: number): void {
    const g = this.w.collision.groundAt(this.pos.x, this.pos.z, this.pos.y + M.stepHeight, M.radius * 0.5);
    if (this.pos.y > g.y + 0.02 || g.y === -Infinity) {
      this.vel.y -= M.gravity * dt;
      this.grounded = false;
    } else {
      if (!this.grounded && this.landVel < -6) { this.w.audio?.sfx('land', this.pos, 0.7); this.w.addShake(FEEL.shake.land); this.emit(PLAYER.noise.land); this.w.fx.snowPuff(this.pos, 0.8); }
      if (!this.grounded && this.landVel < -19) this.damage(Math.min(100, (-this.landVel - 19) * 9));
      this.pos.y = g.y; this.vel.y = Math.max(0, this.vel.y); this.grounded = true;
      if (g.solid) this.surface = g.solid.surface;
    }
    this.landVel = this.vel.y;
  }

  private integrate(dt: number): void {
    const w = this.w;
    const before = this.pos.y;
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt; this.pos.y += this.vel.y * dt;
    // step up onto anything within step height
    const g = w.collision.groundAt(this.pos.x, this.pos.z, before + M.stepHeight, M.radius * 0.5);
    if (g.y > -Infinity && this.pos.y < g.y && g.y - before <= M.stepHeight + 0.01) { this.pos.y = g.y; if (this.vel.y < 0) this.vel.y = 0; }
    w.collision.resolveCylinder(this.pos, M.radius, this.height, M.stepHeight);
    if (this.pos.y < -40) { this.health = 0; this.die(); }
  }

  private startSlide(): void {
    this.mode = 'slide'; this.t = 0;
    this.dur = PLAYER.slide.duration * (this.surface === 'ice' ? PLAYER.slide.iceLengthScale : 1);
    this.slideDir.set(this.vel.x, 0, this.vel.z).normalize();
    const s = Math.max(this.speed, PLAYER.slide.exitSpeed + 1.5);
    this.vel.x = this.slideDir.x * s; this.vel.z = this.slideDir.z * s;
    this.w.audio?.sfx('slide', this.pos, 0.9);
    this.w.fx.snowPuff(this.pos, 1.2);
    this.events.push('slide');
  }

  private updateSlide(dt: number, f: InputFrame): void {
    this.t += dt;
    const k = Math.min(1, this.t / this.dur);
    const s = (PLAYER.slide.exitSpeed + 1.5) + (PLAYER.slide.exitSpeed - (PLAYER.slide.exitSpeed + 1.5)) * k;
    this.vel.x = this.slideDir.x * s; this.vel.z = this.slideDir.z * s;
    this.facing = Math.atan2(-this.slideDir.x, -this.slideDir.z);
    if (f.pressed.has('jump') && this.tryTraverse(this.slideDir)) return; // slide → vault chain
    this.applyGravity(dt);
    this.integrate(dt);
    if (Math.floor(this.t * 20) !== Math.floor((this.t - dt) * 20)) this.w.fx.snowPuff(this.pos, 0.4);
    if (this.t >= this.dur) {
      this.mode = 'move'; this.slideCD = PLAYER.slide.cooldown;
      if (!this.w.collision.free(this.pos.x, this.pos.z, this.pos.y + 0.2, this.pos.y + M.height, M.radius * 0.9)) { this.crouched = true; this.crouchToggle = true; }
    }
  }

  /** Vault low cover / mantle a ledge in direction `dir`. */
  private tryTraverse(dir: THREE.Vector3): boolean {
    const w = this.w;
    const d = dir.clone().setY(0).normalize();
    const feet = this.pos.y;
    const reach = this.pos.clone().addScaledVector(d, M.radius + 0.45);
    const ob = w.collision.probe(reach.x, reach.z, feet + 0.3, feet + PLAYER.mantle.maxHeight + 0.1, 0.12);
    if (!ob) return false;
    const top = ob.max.y - feet;
    if (top > PLAYER.mantle.maxHeight + 0.01) return false;
    // vault if low and thin enough with space beyond
    if (top <= PLAYER.vault.maxHeight + 0.01) {
      for (let depth = 0.6; depth <= PLAYER.vault.maxDepth + 0.7; depth += 0.2) {
        const land = reach.clone().addScaledVector(d, depth + M.radius);
        const g = w.collision.groundAt(land.x, land.z, feet + 0.5, 0);
        if (g.y > -Infinity && feet - g.y < 3 && w.collision.free(land.x, land.z, g.y + 0.25, g.y + M.height, M.radius * 0.8)) {
          const over = w.collision.probe(land.x, land.z, feet + 0.3, feet + 1.2, 0.05);
          if (over) continue;
          this.mode = 'vault'; this.t = 0; this.dur = PLAYER.vault.duration;
          this.from.copy(this.pos); this.to.set(land.x, g.y, land.z); this.toTop = feet + top + 0.25;
          this.w.audio?.sfx('mantle', this.pos, 0.6); this.events.push('vault'); this.emit(PLAYER.noise.mantle);
          this.facing = Math.atan2(-d.x, -d.z);
          return true;
        }
      }
    }
    // mantle onto the top
    const onTop = reach.clone().addScaledVector(d, 0.35);
    if (onTop.x < ob.min.x || onTop.x > ob.max.x || onTop.z < ob.min.z || onTop.z > ob.max.z) onTop.copy(reach).addScaledVector(d, 0.15);
    if (!w.collision.free(onTop.x, onTop.z, ob.max.y + 0.05, ob.max.y + (this.crouched ? M.crouchHeight : M.crouchHeight), M.radius * 0.7)) return false;
    this.mode = 'mantle'; this.t = 0; this.dur = PLAYER.mantle.duration;
    this.from.copy(this.pos); this.to.set(onTop.x, ob.max.y, onTop.z); this.toTop = ob.max.y + 0.15;
    this.w.audio?.sfx('mantle', this.pos, 0.8); this.events.push('mantle'); this.emit(PLAYER.noise.mantle);
    this.facing = Math.atan2(-d.x, -d.z);
    return true;
  }
  private toTop = 0;

  private updateTraverse(dt: number): void {
    this.t += dt;
    const k = Math.min(1, this.t / this.dur);
    const e = k * k * (3 - 2 * k);
    this.pos.lerpVectors(this.from, this.to, e);
    const arc = this.mode === 'mantle' ? Math.min(1, k * 1.6) : Math.sin(k * Math.PI);
    this.pos.y = this.mode === 'mantle' ? this.from.y + (this.toTop - this.from.y) * arc - (k > 0.85 ? (k - 0.85) / 0.15 * (this.toTop - this.to.y) : 0) : Math.max(this.from.y, this.to.y) + (this.toTop - Math.max(this.from.y, this.to.y)) * arc + (this.to.y - this.from.y) * e * (1 - arc);
    this.vel.set(0, 0, 0);
    if (k >= 1) {
      this.pos.copy(this.to);
      const exit = this.mode === 'vault' ? Math.max(M.walk, this.speed) : 0;
      this.mode = 'move';
      if (exit) { const d = this.to.clone().sub(this.from).setY(0).normalize(); this.vel.set(d.x * (this.sprinting ? M.sprint : M.walk * 1.2), 0, d.z * (this.sprinting ? M.sprint : M.walk * 1.2)); }
      this.grounded = true;
    }
  }

  // ------------------------------------------------------------------ takedowns
  private eligible(e: Enemy, range: number): boolean {
    if (!e.alive || e.awareness === 'hunted' || e.def.takedown === 'none') return false;
    if (e.stunned <= 0 && e.def.takedown === 'rear') {
      const toMe = this.pos.clone().sub(e.pos).setY(0).normalize();
      const fwd = new THREE.Vector3(-Math.sin(e.yaw), 0, -Math.cos(e.yaw));
      if (toMe.dot(fwd) > -Math.cos((TD.heavyRearArcDeg * Math.PI) / 180)) return false;
    }
    const d = e.pos.distanceTo(this.pos);
    if (d > range || Math.abs(e.pos.y - this.pos.y) > 1.2) return false;
    return !this.w.collision.blocked(this.eye, e.pos.clone().setY(e.pos.y + 1.2), 'block');
  }

  private findTakedown(range: number): Enemy | null {
    let best: Enemy | null = null, bd = Infinity;
    const fwd = this.cam.forward();
    for (const e of this.w.enemies) {
      if (!this.eligible(e, range)) continue;
      const to = e.pos.clone().sub(this.pos).setY(0);
      const d = to.length();
      const score = d - to.normalize().dot(fwd) * 0.8;
      if (score < bd) { bd = score; best = e; }
    }
    return best;
  }

  private findChain(): Enemy | null {
    let best: Enemy | null = null, bd = Infinity;
    for (const e of this.w.enemies) {
      if (e === this.tdTarget || !this.eligible(e, TD.chainRange) || e.awareness !== 'unaware') continue;
      const d = e.pos.distanceTo(this.pos);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  private startTakedown(e: Enemy, chain: boolean): void {
    this.mode = 'takedown'; this.t = 0; this.tdHit = false; this.tdTarget = e; this.tdChain = chain ? 1 : 0;
    this.dur = chain ? TD.chainDuration : TD.duration;
    this.from.copy(this.pos);
    const back = new THREE.Vector3(Math.sin(e.yaw), 0, Math.cos(e.yaw)); // behind the target
    const dir = this.pos.clone().sub(e.pos).setY(0);
    const useBack = dir.normalize().dot(back) > 0.2 || e.def.takedown === 'rear';
    this.to.copy(e.pos).addScaledVector(useBack ? back : dir, 0.75); this.to.y = e.pos.y;
    this.facing = Math.atan2(-(e.pos.x - this.to.x), -(e.pos.z - this.to.z));
    e.grab();
    this.w.audio?.sfx('gear.rattle', this.pos, 0.5);
  }

  private updateTakedown(dt: number): void {
    const e = this.tdTarget!;
    this.t += dt;
    const k = Math.min(1, this.t / this.dur);
    const dash = Math.min(1, k / (this.tdChain ? 0.45 : 0.4));
    this.pos.lerpVectors(this.from, this.to, dash * dash * (3 - 2 * dash));
    this.vel.set(0, 0, 0);
    this.anim.pose.attack = Math.sin(Math.min(1, k * 1.4) * Math.PI);
    const contactAt = this.tdChain ? 0.5 : 0.45;
    if (!this.tdHit && k >= contactAt) {
      this.tdHit = true;
      e.takenDown();
      this.w.hitstop(this.tdChain ? FEEL.hitstop.chainTakedown : FEEL.hitstop.takedown);
      this.cam.pushIn(TD.cameraPush);
      this.w.addShake(FEEL.shake.takedown);
      this.w.audio?.sfx(this.tdChain ? 'takedown.chain' : 'takedown.hit', this.pos, 1);
      this.w.counters.takedowns++;
      this.chainCount = this.tdChain ? this.chainCount + 1 : 1;
      this.chainWindow = TD.chainWindow;
      this.events.push(this.tdChain ? 'chain' : 'takedown');
    }
    if (k >= 1) { this.mode = 'move'; this.anim.pose.attack = 0; this.tdTarget = null; this.chainWindow = TD.chainWindow; }
  }

  // ------------------------------------------------------------------ noise
  private emit(radius: number): void { this.w.perception.emit({ kind: 'noise', pos: this.pos, radius, sourceId: 'player' }); }

  private emitNoise(dt: number): void {
    const sp = this.speed;
    if (sp < 0.4 || !this.grounded || this.mode === 'takedown') return;
    this.noiseT -= dt;
    this.stepT -= dt;
    const N = PLAYER.noise;
    const radius = this.mode === 'slide' ? N.slide : this.crouched ? N.crouch : this.sprinting ? N.sprint : N.walk;
    if (this.noiseT <= 0) { this.noiseT = 0.3; this.emit(this.surface === 'drift' ? radius * 0.8 : radius); }
    if (this.stepT <= 0) {
      this.stepT = this.sprinting ? 0.3 : this.crouched ? 0.6 : 0.45;
      const s = this.submerged > 0.1 ? 'foot.water' : this.surface === 'ice' ? 'foot.ice' : this.surface === 'metal' ? 'foot.metal' : 'foot.snow';
      this.w.audio?.sfx(s, this.pos, this.crouched ? 0.25 : this.sprinting ? 0.8 : 0.5);
    }
  }

  // ------------------------------------------------------------------ presentation
  present(dt: number): void {
    const r = this.rig.root;
    r.position.copy(this.pos);
    const dy = Math.atan2(Math.sin(this.facing - this.bodyYaw), Math.cos(this.facing - this.bodyYaw));
    this.bodyYaw += dy * (1 - Math.exp(-14 * dt));
    r.rotation.y = this.bodyYaw;
    const p = this.anim.pose;
    p.speed = this.speed;
    p.crouch += ((this.crouched ? 1 : 0) - p.crouch) * (1 - Math.exp(-12 * dt));
    p.aim += ((this.aiming || this.weapons.recentlyFired ? 1 : 0) - p.aim) * (1 - Math.exp(-14 * dt));
    p.slide += ((this.mode === 'slide' ? 1 : 0) - p.slide) * (1 - Math.exp(-16 * dt));
    p.mantle += ((this.mode === 'mantle' || this.mode === 'vault' ? 1 : 0) - p.mantle) * (1 - Math.exp(-16 * dt));
    p.dead += ((this.mode === 'dead' ? 1 : 0) - p.dead) * (1 - Math.exp(-6 * dt));
    this.anim.update(dt);
    // hide the body when the camera is inside it
    r.visible = this.cam.position.distanceTo(this.eye) > 0.55;
  }

  updateCamera(dt: number): void {
    this.cam.baseFov = this.w.options.fov;
    this.cam.update(dt, this.w, this.pos, { crouch: this.anim.pose.crouch, sprint: this.sprinting, aim: this.aiming, slide: this.anim.pose.slide });
  }

  dispose(): void { this.w.scene.remove(this.rig.root); this.weapons.dispose(); this.visor.dispose(); }
}
