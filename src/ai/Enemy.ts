import * as THREE from 'three';
import { createPerceiver, type Perceiver, type Awareness } from '@slu/perception';
import { ARCHETYPES, type ArchetypeDef, type ArchetypeId } from '../../data/enemies';
import { BARKS, type BarkSituation } from '../../data/barks';
import { PALETTE } from '../../data/palette';
import { buildHumanoid, HumanAnimator, buildDrone, buildHound, type HumanRig } from '../world/Humanoid';
import { glowSprite } from '../world/Materials';
import type { World } from '../game/World';

export interface PatrolPoint { p: [number, number, number]; wait?: number; look?: number }
export interface EnemySpawn {
  id?: string;
  type: ArchetypeId;
  at: [number, number, number];
  yaw?: number;
  patrol?: PatrolPoint[];
  /** Drone flight loop (y is altitude). */
  loop?: [number, number, number][];
  area: string;
  /** Never moves (sentry, spotter). */
  post?: boolean;
  /** Idle bark chatter partner. */
  chatty?: boolean;
  tag?: string;
}

export type EnemyState = 'patrol' | 'idle' | 'investigate' | 'combat' | 'alarm' | 'stunned' | 'grabbed' | 'dead' | 'scripted';

let ids = 1;
const TMP = new THREE.Vector3();

/**
 * One Sable enemy: archetype data + shared perception + small behaviour state machine.
 * Behaviour differs by archetype (patrols, overwatch, armoured suppression, drone loops, hounds).
 */
export class Enemy {
  readonly id = ids++;
  readonly key: string;
  readonly def: ArchetypeDef;
  readonly pos = new THREE.Vector3();
  readonly vel = new THREE.Vector3();
  yaw: number;
  hp: number;
  alive = true;
  state: EnemyState = 'patrol';
  readonly perceiver: Perceiver;
  readonly root = new THREE.Group();
  private rig: HumanRig | null = null;
  private anim: HumanAnimator | null = null;
  private drone: ReturnType<typeof buildDrone> | null = null;
  private hound: ReturnType<typeof buildHound> | null = null;
  private glint: THREE.Sprite;
  private cone: THREE.Mesh | null = null;
  private outline: THREE.Mesh | null = null;
  marked = 0;
  stunned = 0;
  private patrolIndex = 0;
  private waitT = 0;
  private burstLeft = 0;
  private burstT = 0;
  private gapT = 1;
  private telegraphT = 0;
  private stuckT = 0;
  private sideStep = 0;
  private lastPos = new THREE.Vector3();
  private searchT = 0;
  private deadT = 0;
  private home = new THREE.Vector3();
  private homeYaw = 0;
  private barkT = 0;
  private flareCD = 0;
  private lastAwareness: Awareness = 'unaware';
  /** Set by the alert director when this enemy is running to a panel. */
  alarmTarget: { id: string; pos: THREE.Vector3 } | null = null;
  alarmT = 0;
  private strafeDir = 1;
  private loopIndex = 0;
  bodyFound = false;
  killedBy: 'takedown' | 'gun' | 'collapse' | 'mech' | null = null;
  scriptedMove: THREE.Vector3 | null = null;

  constructor(private readonly w: World, readonly spawn: EnemySpawn) {
    this.def = ARCHETYPES[spawn.type];
    this.key = spawn.id ?? `${spawn.type}-${this.id}`;
    this.pos.set(...spawn.at);
    this.yaw = spawn.yaw ?? 0;
    this.home.copy(this.pos); this.homeYaw = this.yaw;
    this.hp = this.def.hp;
    const cfg = structuredClone(this.def.perception);
    if (cfg.sight) { cfg.sight.fillClose *= w.difficulty.fillTime; cfg.sight.fillFar *= w.difficulty.fillTime; }
    this.perceiver = w.perception.add(createPerceiver(spawn.area, cfg, this.pos, this.yaw));
    this.perceiver.pos = this.pos;
    if (spawn.type === 'drone') { this.drone = buildDrone(); this.root.add(this.drone.root); }
    else if (spawn.type === 'hound') { this.hound = buildHound(); this.root.add(this.hound.root); }
    else {
      this.rig = buildHumanoid(spawn.type === 'heavy' ? 'heavy' : spawn.type === 'spotter' ? 'spotter' : 'trooper');
      this.anim = new HumanAnimator(this.rig);
      this.anim.pose.maxSpeed = this.def.run;
      this.root.add(this.rig.root);
    }
    this.glint = glowSprite(PALETTE.red, 1.1, 0);
    this.root.add(this.glint);
    w.scene.add(this.root);
    this.state = spawn.post ? 'idle' : spawn.patrol?.length || spawn.loop?.length ? 'patrol' : 'idle';
    this.barkT = 6 + w.rng.next() * 20;
    this.lastPos.copy(this.pos);
    this.present(0);
  }

  get awareness(): Awareness { return this.perceiver.awareness; }
  get isDrone(): boolean { return !!this.drone; }
  get isHound(): boolean { return !!this.hound; }
  get height(): number { return this.drone ? 0.4 : this.hound ? 1 : this.def.id === 'heavy' ? 2.05 : 1.8; }
  headPos(): THREE.Vector3 { return this.drone ? this.pos.clone() : this.pos.clone().setY(this.pos.y + (this.hound ? 0.85 : this.def.id === 'heavy' ? 1.82 : 1.62)); }
  forward(out = new THREE.Vector3()): THREE.Vector3 { return out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); }

  /** Ray vs head sphere and body capsule (approximated as stacked spheres). */
  rayHit(o: THREE.Vector3, d: THREE.Vector3, maxT: number): { t: number; head: boolean } | null {
    const test = (c: THREE.Vector3, r: number) => {
      const oc = o.clone().sub(c); const b = oc.dot(d); const cc = oc.dot(oc) - r * r; const disc = b * b - cc;
      if (disc < 0) return null; const t = -b - Math.sqrt(disc); return t > 0 && t < maxT ? t : null;
    };
    const head = this.headPos();
    const th = this.drone ? test(head, 0.7) : test(head, this.def.id === 'heavy' ? 0.2 : 0.17);
    if (th !== null) return { t: th, head: !this.drone };
    if (this.drone) return null;
    let best: number | null = null;
    const rr = this.hound ? 0.42 : this.def.id === 'heavy' ? 0.42 : 0.3;
    for (const h of this.hound ? [0.75] : [0.5, 0.95, 1.3]) {
      const t = test(TMP.copy(this.pos).setY(this.pos.y + h), rr);
      if (t !== null && (best === null || t < best)) best = t;
    }
    return best !== null ? { t: best, head: false } : null;
  }

  mark(seconds: number): void { this.marked = Math.max(this.marked, seconds); }
  stun(seconds: number): void {
    if (!this.alive || this.isDrone) return;
    this.stunned = Math.max(this.stunned, seconds);
    this.perceiver.blind = true;
    this.state = 'stunned';
  }

  /** Grabbed by a takedown: freeze. */
  grab(): void { this.state = 'grabbed'; this.perceiver.enabled = false; this.vel.set(0, 0, 0); }

  takenDown(): void { this.kill('takedown'); }

  damage(amount: number, o: { from?: THREE.Vector3; loud?: boolean; weapon?: string; mech?: boolean } = {}): void {
    if (!this.alive) return;
    let dmg = amount;
    if (this.def.frontArmor < 1 && o.from && !o.mech) {
      const to = o.from.clone().sub(this.pos).setY(0).normalize();
      if (to.dot(this.forward()) > 0.3) dmg *= this.def.frontArmor;
    }
    this.hp -= dmg;
    this.w.fx.burst(this.headPos().setY(this.pos.y + this.height * 0.6), { count: 4, speed: 2, life: 0.25, size: 0.12, color: 0xff9a7a });
    if (this.hp <= 0) { this.kill(o.mech ? 'mech' : 'gun'); return; }
    // getting shot means hunted (silent shots: they know roughly where it came from)
    if (o.from) this.w.perception.escalate(this.perceiver, 'hunted', 'loud', o.from);
    this.bark('hurt');
  }

  kill(by: 'takedown' | 'gun' | 'collapse' | 'mech'): void {
    if (!this.alive) return;
    this.alive = false; this.state = 'dead'; this.killedBy = by; this.deadT = 0;
    this.perceiver.enabled = false;
    this.w.counters.kills++;
    this.glint.visible = false;
    if (this.drone) { this.w.fx.explosion(this.pos, 0.5, 0xffb070); this.w.audio?.sfx('debris.impact', this.pos, 0.4); }
    else this.w.audio?.sfx('enemy.death', this.pos, by === 'takedown' ? 0.4 : 0.8);
    // a body is something that must not be seen
    if (!this.drone) this.w.perception.addVisual(`body-${this.id}`, this.pos, 'hunted');
    this.w.alert?.onEnemyDown(this);
  }

  /** Remove from the world (chapter teardown). */
  dispose(): void { this.w.scene.remove(this.root); this.w.perception.remove(this.perceiver.id); this.w.perception.removeVisual(`body-${this.id}`); }

  bark(s: BarkSituation): void {
    const pool = BARKS[s];
    const p = this.w.focusPos();
    if (!pool?.length || this.pos.distanceTo(p) > 28 || this.w.inMech) return;
    const id = pool[Math.floor(this.w.rng.next() * pool.length)]!;
    if (this.w.dialogue.coolingDown(id)) return;
    this.w.dialogue.say(id, { channel: 'bark', cooldownKey: id });
    this.w.audio?.voiceAt(this.pos);
  }

  // ------------------------------------------------------------------ simulation
  update(dt: number): void {
    if (!this.alive) { this.deadT += dt; return; }
    const w = this.w;
    this.marked = Math.max(0, this.marked - dt);
    this.flareCD = Math.max(0, this.flareCD - dt);
    const aw = this.awareness;
    if (aw !== this.lastAwareness) this.onAwareness(this.lastAwareness, aw);
    this.lastAwareness = aw;

    if (this.state === 'grabbed' || this.state === 'scripted') { if (this.scriptedMove) this.moveToward(this.scriptedMove, this.def.walk, dt); this.perceiver.yaw = this.yaw; return; }
    if (this.stunned > 0) {
      this.stunned -= dt;
      if (this.stunned <= 0) { this.perceiver.blind = false; this.state = aw === 'hunted' ? 'combat' : 'investigate'; }
      this.vel.multiplyScalar(0.5);
      return;
    }

    if (this.drone) { this.updateDrone(dt); return; }

    // state from awareness
    if (this.state !== 'alarm') {
      if (aw === 'hunted') this.state = 'combat';
      else if (aw === 'suspicious') this.state = 'investigate';
      else if (this.state === 'combat' || this.state === 'investigate') this.state = this.spawn.patrol?.length ? 'patrol' : 'idle';
    }
    switch (this.state) {
      case 'patrol': this.updatePatrol(dt); break;
      case 'idle': this.updateIdle(dt); break;
      case 'investigate': this.updateInvestigate(dt); break;
      case 'combat': this.updateCombat(dt); break;
      case 'alarm': this.updateAlarm(dt); break;
    }
    this.perceiver.yaw = this.yaw;
    // idle chatter
    this.barkT -= dt;
    if (this.barkT <= 0 && aw === 'unaware') { this.barkT = 25 + w.rng.next() * 35; if (this.spawn.chatty !== false) this.bark('idle'); }
  }

  private onAwareness(from: Awareness, to: Awareness): void {
    if (to === 'suspicious' && from === 'unaware') { this.bark('suspicious'); this.waitT = 0.8; }
    if (to === 'hunted') { this.bark(this.perceiver.lastKnown && this.bodyFound ? 'bodyFound' : 'hunted'); this.gapT = 0.6 + this.w.rng.next() * 0.6; }
    if (to === 'unaware' && from !== 'unaware') { this.bark('calm'); this.patrolIndex = this.nearestPatrol(); }
    if (to === 'suspicious' && from === 'hunted') this.bark('lostTarget');
    if (this.def.id === 'spotter' && to !== 'unaware' && this.flareCD <= 0) this.fireFlare();
  }

  private nearestPatrol(): number {
    const pts = this.spawn.patrol; if (!pts?.length) return 0;
    let bi = 0, bd = Infinity;
    pts.forEach((p, i) => { const d = Math.hypot(p.p[0] - this.pos.x, p.p[2] - this.pos.z); if (d < bd) { bd = d; bi = i; } });
    return bi;
  }

  private turnToward(yaw: number, rate: number, dt: number): void {
    const d = Math.atan2(Math.sin(yaw - this.yaw), Math.cos(yaw - this.yaw));
    this.yaw += Math.max(-rate * dt, Math.min(rate * dt, d));
  }
  private faceDir(x: number, z: number): number { return Math.atan2(-x, -z); }

  /** Steer toward a point with simple stuck recovery. Returns distance remaining. */
  private moveToward(target: THREE.Vector3, speed: number, dt: number, stopAt = 0.3): number {
    const to = target.clone().sub(this.pos).setY(0);
    const dist = to.length();
    if (dist <= stopAt) { this.vel.set(0, 0, 0); return dist; }
    to.divideScalar(dist);
    if (this.sideStep > 0) { this.sideStep -= dt; to.set(to.z * this.strafeDir, 0, -to.x * this.strafeDir).lerp(to, 0.3).normalize(); }
    this.turnToward(this.faceDir(to.x, to.z), 6, dt);
    this.vel.set(to.x * speed, 0, to.z * speed);
    this.integrate(dt);
    // stuck detection
    if (this.pos.distanceTo(this.lastPos) < speed * dt * 0.25) { this.stuckT += dt; if (this.stuckT > 0.4) { this.sideStep = 0.6; this.strafeDir *= -1; this.stuckT = 0; } }
    else this.stuckT = 0;
    this.lastPos.copy(this.pos);
    return dist;
  }

  private integrate(dt: number): void {
    const w = this.w;
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
    if (this.hound || this.rig) {
      w.collision.resolveCylinder(this.pos, this.hound ? 0.4 : 0.35, this.height, 0.45);
      const g = w.collision.groundAt(this.pos.x, this.pos.z, this.pos.y + 0.5, 0.15);
      if (g.y > -Infinity) this.pos.y += (g.y - this.pos.y) * Math.min(1, dt * 14);
      else { this.pos.y -= 9 * dt; if (this.pos.y < -30) this.kill('collapse'); }
    }
  }

  private updatePatrol(dt: number): void {
    const pts = this.spawn.patrol;
    if (!pts?.length) { this.state = 'idle'; return; }
    if (this.waitT > 0) {
      this.waitT -= dt;
      const look = pts[this.patrolIndex]?.look;
      if (look !== undefined) this.turnToward(look, 1.5, dt);
      this.vel.set(0, 0, 0);
      return;
    }
    const pt = pts[this.patrolIndex]!;
    const d = this.moveToward(TMP.set(pt.p[0], pt.p[1], pt.p[2]).clone(), this.def.walk, dt, 0.4);
    if (d <= 0.45) { this.waitT = pt.wait ?? 1.5; this.patrolIndex = (this.patrolIndex + 1) % pts.length; }
  }

  private updateIdle(dt: number): void {
    const d = this.spawn.post || this.def.walk === 0 ? 0 : this.moveToward(this.home, this.def.walk, dt, 0.5);
    if (d <= 0.5) { this.vel.set(0, 0, 0); this.turnToward(this.homeYaw + Math.sin(this.w.simTime * 0.25 + this.id) * (this.spawn.post ? 0.6 : 0.3), 1.2, dt); }
  }

  private updateInvestigate(dt: number): void {
    const lk = this.perceiver.lastKnown;
    if (this.waitT > 0) { this.waitT -= dt; if (lk) this.turnToward(this.faceDir(lk.x - this.pos.x, lk.z - this.pos.z), 3, dt); this.vel.set(0, 0, 0); return; }
    if (!lk || this.def.walk === 0 || this.spawn.post) {
      if (lk) this.turnToward(this.faceDir(lk.x - this.pos.x, lk.z - this.pos.z), 2.5, dt);
      this.vel.set(0, 0, 0); return;
    }
    const d = this.moveToward(TMP.set(lk.x, lk.y, lk.z).clone(), this.def.walk * 1.25, dt, 1.2);
    if (d <= 1.3) { this.searchT += dt; this.turnToward(this.yaw + 1.2, 1.4, dt); }
  }

  private updateAlarm(dt: number): void {
    const a = this.alarmTarget;
    if (!a) { this.state = 'combat'; return; }
    const d = this.moveToward(a.pos, this.def.run, dt, 1.0);
    if (d <= 1.1) {
      this.vel.set(0, 0, 0);
      this.alarmT += dt;
      this.w.alert.alarmProgress(this, a.id, this.alarmT);
    } else this.alarmT = 0;
  }

  private canSeePlayerNow(): boolean { return this.perceiver.seesTarget; }

  private updateCombat(dt: number): void {
    const w = this.w;
    const target = w.focusPos();
    const lk = this.perceiver.lastKnown ?? target;
    const sees = this.canSeePlayerNow();
    const toT = TMP.set(lk.x - this.pos.x, 0, lk.z - this.pos.z);
    const dist = toT.length();
    if (this.hound) { this.updateHound(dt, sees, dist, lk); return; }
    // alarm duty
    if (this.def.canAlarm && !this.alarmTarget) w.alert.requestAlarm(this);
    if (this.alarmTarget) { this.state = 'alarm'; return; }
    const range = this.def.weapon.range;
    if (sees && dist < range) {
      this.turnToward(this.faceDir(target.x - this.pos.x, target.z - this.pos.z), 7, dt);
      // hold a band; heavies advance slowly, troopers strafe/flank
      const band = this.def.id === 'heavy' ? 14 : 18;
      if (this.def.walk > 0 && !this.spawn.post) {
        const side = new THREE.Vector3(-toT.z, 0, toT.x).normalize().multiplyScalar(this.strafeDir);
        const adv = dist > band ? toT.clone().normalize() : dist < band * 0.5 ? toT.clone().normalize().negate() : new THREE.Vector3();
        const mv = side.multiplyScalar(this.def.id === 'heavy' ? 0.3 : 0.75).add(adv).normalize().multiplyScalar(this.def.walk * 1.3);
        this.vel.copy(mv); this.integrate(dt);
        if (w.rng.chance(dt * 0.25)) this.strafeDir *= -1;
      }
      this.shoot(dt, target);
    } else {
      this.telegraphT = 0; this.glint.material.opacity = 0;
      if (this.def.walk > 0 && !this.spawn.post) {
        // flank: approach the last known position from an offset
        const off = new THREE.Vector3(-toT.z, 0, toT.x).normalize().multiplyScalar(this.strafeDir * Math.min(6, dist * 0.4));
        const goal = new THREE.Vector3(lk.x, lk.y, lk.z).add(off);
        this.moveToward(goal, this.def.run, dt, 1.5);
      } else this.turnToward(this.faceDir(toT.x, toT.z), 3, dt);
    }
  }

  private shoot(dt: number, target: THREE.Vector3): void {
    const W = this.def.weapon, w = this.w;
    if (W.damage <= 0) return;
    if (this.burstLeft <= 0) {
      this.gapT -= dt;
      if (this.gapT <= 0 && this.telegraphT <= 0) this.telegraphT = W.telegraph * w.difficulty.telegraph;
      if (this.telegraphT > 0) {
        this.telegraphT -= dt;
        // the threat announces itself: red muzzle glint
        this.glint.material.opacity = 0.9 * (0.6 + 0.4 * Math.sin(w.simTime * 40));
        if (this.telegraphT <= 0) { this.burstLeft = W.burst; this.burstT = 0; this.glint.material.opacity = 0; }
        else if (Math.floor((this.telegraphT + dt) * 6) !== Math.floor(this.telegraphT * 6)) w.audio?.sfx('enemy.glint', this.pos, 0.35);
      }
      return;
    }
    this.burstT -= dt;
    if (this.burstT > 0) return;
    this.burstT = W.interval; this.burstLeft--;
    if (this.burstLeft <= 0) this.gapT = W.burstGap * (0.8 + w.rng.next() * 0.5);
    const muzzle = this.muzzlePos();
    const aim = target.clone().setY(target.y + (w.inMech ? 7 : 1.2));
    // hit chance: accuracy × difficulty, worse with distance, target speed and crouch
    const p = w.player;
    const dist = muzzle.distanceTo(aim);
    let chance = W.accuracy * w.difficulty.enemyAccuracy * (1 - Math.min(0.6, dist / (W.range * 1.6)));
    if (p && !w.inMech) { chance *= p.speed > 5 ? 0.6 : 1; chance *= p.crouched ? 0.75 : 1; }
    const blocked = w.collision.blocked(muzzle, aim, 'bullet');
    const hit = !blocked && w.rng.chance(chance);
    const end = hit ? aim : aim.clone().add(new THREE.Vector3((w.rng.next() - 0.5) * 3, (w.rng.next() - 0.5) * 2, (w.rng.next() - 0.5) * 3));
    w.fx.tracer(muzzle, end, PALETTE.red, 0.06);
    w.fx.flash(muzzle, 0xffb080, 0.5, 0.05);
    w.audio?.sfx(this.def.id === 'heavy' ? 'enemy.lmg' : 'enemy.shot', this.pos, 0.9);
    w.perception.emit({ kind: 'loud', pos: this.pos, radius: 30, group: this.spawn.area });
    if (hit) {
      if (w.inMech) w.aegis?.damage(W.damage * 0.25, this.pos);
      else p?.damage(W.damage, this.pos);
    }
  }

  private muzzlePos(): THREE.Vector3 {
    if (this.rig) { const m = new THREE.Vector3(); this.rig.muzzle.getWorldPosition(m); return m; }
    return this.headPos();
  }

  private biteT = 0;
  private updateHound(dt: number, sees: boolean, dist: number, lk: { x: number; y: number; z: number }): void {
    const w = this.w;
    const target = w.focusPos();
    const dp = target.distanceTo(this.pos);
    if (dp < 2.4 && (sees || dp < 1.5)) {
      this.vel.set(0, 0, 0);
      this.turnToward(this.faceDir(target.x - this.pos.x, target.z - this.pos.z), 9, dt);
      this.biteT += dt;
      if (this.biteT > this.def.weapon.telegraph * w.difficulty.telegraph) {
        this.biteT = -this.def.weapon.burstGap;
        w.audio?.sfx('enemy.hound', this.pos, 1);
        if (dp < 2.4) w.player?.damage(this.def.weapon.damage, this.pos);
      }
      return;
    }
    this.biteT = Math.min(this.biteT, 0);
    this.moveToward(new THREE.Vector3(lk.x, lk.y, lk.z), this.def.run, dt, 0.8);
    void dist;
  }

  private updateDrone(dt: number): void {
    const loop = this.spawn.loop ?? [this.spawn.at];
    const aw = this.awareness;
    const lk = this.perceiver.lastKnown;
    let goal: THREE.Vector3;
    if (aw !== 'unaware' && lk) goal = new THREE.Vector3(lk.x, this.home.y, lk.z);
    else {
      const pt = loop[this.loopIndex % loop.length]!;
      goal = new THREE.Vector3(pt[0], pt[1], pt[2]);
      if (goal.distanceTo(this.pos) < 1) this.loopIndex++;
    }
    const to = goal.sub(this.pos);
    const d = to.length();
    const sp = aw === 'unaware' ? this.def.walk : this.def.walk * 0.6;
    if (d > 0.05) { to.divideScalar(d); this.pos.addScaledVector(to, Math.min(d, sp * dt)); if (aw === 'unaware') this.turnToward(this.faceDir(to.x, to.z), 2.5, dt); }
    if (aw !== 'unaware' && lk) this.turnToward(this.faceDir(lk.x - this.pos.x, lk.z - this.pos.z), 2, dt);
    this.perceiver.yaw = this.yaw;
    // its beam spotting the player escalates the area (drones call it in)
    if (aw === 'suspicious' && this.perceiver.seesTarget) this.w.alert?.droneSpotted(this);
  }

  private fireFlare(): void {
    const lk = this.perceiver.lastKnown; if (!lk) return;
    this.flareCD = 14;
    const p = new THREE.Vector3(lk.x, lk.y, lk.z);
    this.w.audio?.sfx('enemy.flare', this.pos, 0.9);
    this.w.hazards?.flare(p, 18, 8);
    this.w.perception.emit({ kind: 'noise', pos: p, radius: 24, group: this.spawn.area });
  }

  // ------------------------------------------------------------------ presentation
  present(dt: number): void {
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.yaw;
    if (this.anim) {
      const p = this.anim.pose;
      p.speed = this.alive ? Math.hypot(this.vel.x, this.vel.z) : 0;
      p.aim += ((this.state === 'combat' && this.alive ? 1 : 0) - p.aim) * Math.min(1, dt * 8);
      p.dead += ((this.alive ? 0 : 1) - p.dead) * Math.min(1, dt * (this.killedBy === 'takedown' ? 5 : 8));
      p.stun = this.stunned > 0 ? 1 : 0;
      p.crouch = this.state === 'investigate' && this.waitT <= 0 ? 0.25 : 0;
      this.anim.update(dt);
    }
    if (this.drone) {
      const t = this.w.simTime;
      this.drone.root.position.y = Math.sin(t * 2 + this.id) * 0.08;
      const s = this.def.perception.sight!;
      const len = 14, r = Math.tan(((s.fovDeg / 2) * Math.PI) / 180) * len;
      this.drone.beam.scale.set(r, len, r);
      this.drone.beam.rotation.x = -((90 - (s.pitchDeg ?? 90)) * Math.PI) / 180;
      this.drone.beam.visible = this.alive;
      (this.drone.beam.material as THREE.MeshBasicMaterial).opacity = this.awareness === 'unaware' ? 0.05 : 0.12;
      if (!this.alive) { this.drone.root.rotation.z = Math.min(1.4, this.deadT * 2); this.pos.y = Math.max(this.w.collision.groundAt(this.pos.x, this.pos.z, this.pos.y).y + 0.3, this.pos.y - dt * 9); }
    }
    if (this.hound) {
      const t = this.w.simTime * (Math.hypot(this.vel.x, this.vel.z) > 3 ? 14 : 6);
      const moving = Math.hypot(this.vel.x, this.vel.z) > 0.2 ? 1 : 0;
      this.hound.legs.forEach((l, i) => { l.rotation.x = Math.sin(t + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI / 2 : 0)) * 0.6 * moving; });
      this.hound.root.rotation.z = this.alive ? 0 : Math.min(1.5, this.deadT * 4);
    }
    // glint sits on the muzzle
    if (this.rig) { const m = this.muzzlePos(); this.glint.position.copy(m.sub(this.pos)).applyAxisAngle(new THREE.Vector3(0, 1, 0), -this.yaw); }
    this.updateMarkVisuals();
  }

  private updateMarkVisuals(): void {
    const show = this.marked > 0 && this.alive;
    if (show && !this.cone && this.def.perception.sight && !this.drone) {
      const s = this.def.perception.sight;
      const range = Math.min(s.range, 30);
      const geo = new THREE.CircleGeometry(range, 24, Math.PI / 2 - ((s.fovDeg / 2) * Math.PI) / 180, (s.fovDeg * Math.PI) / 180);
      geo.rotateX(-Math.PI / 2);
      this.cone = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: PALETTE.red, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
      this.cone.position.y = 0.08; this.cone.renderOrder = 3;
      this.root.add(this.cone);
    }
    if (show && !this.outline) {
      const h = this.height;
      const geo = new THREE.CapsuleGeometry(this.drone ? 0.6 : this.hound ? 0.45 : 0.34, Math.max(0.1, h - 0.7), 4, 8); geo.translate(0, this.drone ? 0 : h / 2, 0);
      this.outline = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: PALETTE.red, transparent: true, opacity: 0.35, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending }));
      this.outline.renderOrder = 10;
      this.root.add(this.outline);
    }
    if (this.cone) { this.cone.visible = show; (this.cone.material as THREE.MeshBasicMaterial).opacity = this.awareness === 'unaware' ? 0.1 : 0.22; }
    if (this.outline) { this.outline.visible = show; (this.outline.material as THREE.MeshBasicMaterial).opacity = 0.18 + 0.12 * Math.min(1, this.marked); }
  }

  /** The cyan takedown prompt sits above eligible targets; HUD reads this. */
  promptAnchor(): THREE.Vector3 { return this.pos.clone().setY(this.pos.y + this.height + 0.35); }
}
