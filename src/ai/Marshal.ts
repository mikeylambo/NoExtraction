import * as THREE from 'three';
import { MARSHAL } from '../../data/bosses/marshal';
import { PALETTE } from '../../data/palette';
import { MechHostile } from './MechHostile';
import { glowSprite } from '../world/Materials';
import type { World } from '../game/World';

type Attack = 'rifleBurst' | 'bladeLunge' | 'missileSalvo' | 'gantryCrush' | 'overcharge';
interface Pending { kind: Attack; t: number; total: number; aim: THREE.Vector3; dir: THREE.Vector3; fx: THREE.Object3D[] }

/** Sovereign plating: share of non-cannon damage that gets through (tuned for 4–6 min TTK). */
export const SOVEREIGN_PLATING = { rifle: 0.36, missile: 0.5, blade: 0.6, cannon: 1 };

/**
 * THE MARSHAL in SOVEREIGN. Three phases by armor: Duel (100–65%), Platform breaks (65–30%: arena
 * shrinks a third, gantry crush, twin Warden support), Desperate (30–0%: takes your shoulder
 * cannon in a scripted grapple, 20% shorter telegraphs, overcharge beam).
 */
export class Marshal extends MechHostile {
  phase = 1;
  private cd: Record<Attack, number> = { rifleBurst: 2, bladeLunge: 6, missileSalvo: 9, gantryCrush: 5, overcharge: 6 };
  private pending: Pending | null = null;
  private lungeT = 0;
  private lungeDir = new THREE.Vector3();
  private lungeHit = false;
  private blade: THREE.Sprite;
  onPhase: (phase: number) => void = () => {};
  onEvent: (e: string) => void = () => {};
  readonly attackLog: { kind: Attack; telegraph: number; at: number }[] = [];
  grappling = 0;
  startedAt = 0;

  constructor(w: World, at: THREE.Vector3, yaw: number) {
    super(w, at, yaw, MARSHAL.armor * w.difficulty.bossArmor, true);
    this.name = 'SOVEREIGN';
    this.evasion = 0.5;
    this.speed = MARSHAL.speed;
    this.band = [70, 180];
    this.blade = glowSprite(PALETTE.red, 10, 0);
    this.rig.root.add(this.blade); this.blade.position.set(4, 6, -6);
    this.startedAt = w.simTime;
  }

  get armor01(): number { return this.hp / this.hpMax; }
  private scale(): { tele: number; cd: number; speed: number } {
    const p3 = this.phase === 3;
    return { tele: (p3 ? MARSHAL.phase3.telegraphScale : 1) * this.w.difficulty.telegraph, cd: p3 ? MARSHAL.phase3.cooldownScale : 1, speed: p3 ? MARSHAL.phase3.speedScale : 1 };
  }

  override damage(amount: number, from?: THREE.Vector3, impact = 0): boolean {
    if (this.grappling > 0) return false;
    const src = impact >= 400 ? 'cannon' : impact === 90 ? 'missile' : impact === 180 ? 'blade' : 'rifle';
    return super.damage(amount * SOVEREIGN_PLATING[src], from, impact * 0.4);
  }

  override update(dt: number): void {
    this.updateProjectiles(dt);
    if (!this.alive || !this.active) { if (!this.alive) super.update(dt); return; }
    const k = this.armor01;
    const want = k > MARSHAL.phases[1]!.from ? 1 : k > MARSHAL.phases[2]!.from ? 2 : 3;
    if (want > this.phase) { this.phase = want; this.onPhase(want); }
    if (this.grappling > 0) { this.grappling -= dt; this.vel.set(0, 0, 0); return; }
    const s = this.scale();
    for (const a of Object.keys(this.cd) as Attack[]) this.cd[a] -= dt;
    const tgt = this.target();
    const to = tgt.clone().sub(this.pos).setY(0); const dist = to.length(); to.normalize();

    if (this.lungeT > 0) {
      this.lungeT -= dt;
      this.vel.copy(this.lungeDir).multiplyScalar(MARSHAL.attacks.bladeLunge.lungeSpeed * s.speed);
      this.integrate(dt);
      if (!this.lungeHit && this.pos.distanceTo(tgt) < MARSHAL.attacks.bladeLunge.reach) { this.lungeHit = true; this.w.aegis?.damage(MARSHAL.attacks.bladeLunge.damage, this.pos); this.w.fx.burst(tgt.clone().setY(tgt.y + 7), { count: 30, speed: 20, life: 0.3, size: 1, color: PALETTE.red }); }
      if (this.lungeT <= 0) this.blade.material.opacity = 0;
      return;
    }
    if (this.pending) { this.resolvePending(dt); this.vel.multiplyScalar(0.92); this.integrate(dt); return; }

    // movement: duel orbit with frequent boost-strafes
    this.yaw = Math.atan2(-to.x, -to.z);
    this.dashCD -= dt * s.speed;
    if (this.dashT > 0) { this.dashT -= dt; this.vel.copy(this.dashDir).multiplyScalar(MARSHAL.boostSpeed * s.speed); }
    else {
      if (this.dashCD <= 0) { this.dashCD = 1.6 + this.w.rng.next() * 1.8; this.dashT = 0.3; this.dashDir.set(-to.z * this.orbitDir, 0, to.x * this.orbitDir); if (this.w.rng.chance(0.35)) this.orbitDir *= -1; this.w.audio?.sfx('mech.boost', this.pos, 0.8); }
      const radial = dist > this.band[1] ? 1 : dist < this.band[0] ? -1 : 0;
      const v = new THREE.Vector3(-to.z * this.orbitDir, 0, to.x * this.orbitDir).multiplyScalar(0.9).addScaledVector(to, radial).normalize().multiplyScalar(this.speed * s.speed);
      this.vel.lerp(v, Math.min(1, dt * 3));
    }
    this.integrate(dt);
    this.chooseAttack(tgt, dist);
  }

  /** Evasion while boosting: the rifle has to lead a moving duelist. */
  /** Seconds left on the current telegraph (null if none) — the window to sidestep. */
  get telegraphLeft(): number | null { return this.pending ? this.pending.t : null; }
  get telegraphKind(): string | null { return this.pending?.kind ?? null; }

  override get evading(): boolean { return this.dashT > 0 || this.lungeT > 0; }

  private chooseAttack(tgt: THREE.Vector3, dist: number): void {
    const A = MARSHAL.attacks, s = this.scale();
    const order: Attack[] = this.phase === 3 ? ['overcharge', 'bladeLunge', 'gantryCrush', 'missileSalvo', 'rifleBurst'] : this.phase === 2 ? ['gantryCrush', 'bladeLunge', 'missileSalvo', 'rifleBurst'] : ['bladeLunge', 'missileSalvo', 'rifleBurst'];
    for (const a of order) {
      if (this.cd[a] > 0) continue;
      if (a === 'bladeLunge' && dist > 230) continue;
      const tele = A[a].telegraph * s.tele;
      this.cd[a] = A[a].cooldown * s.cd * (0.85 + this.w.rng.next() * 0.3);
      this.cd.rifleBurst = Math.max(this.cd.rifleBurst, 1.2);
      this.pending = { kind: a, t: tele, total: tele, aim: tgt.clone(), dir: tgt.clone().sub(this.pos).setY(0).normalize(), fx: [] };
      this.attackLog.push({ kind: a, telegraph: tele, at: this.w.simTime });
      this.telegraph(this.pending);
      return;
    }
  }

  private telegraph(p: Pending): void {
    const w = this.w;
    switch (p.kind) {
      case 'rifleBurst': this.glint.material.opacity = 1; w.audio?.sfx('enemy.glint', this.pos, 1); break;
      case 'bladeLunge': this.blade.material.opacity = 1; w.audio?.sfx('mech.blade', this.pos, 1); w.audio?.sfx('sting.hunted', null, 0.5); this.onEvent('blade'); break;
      case 'missileSalvo': w.audio?.sfx('mech.lock', null, 1); w.hud?.lockWarning(p.total); break;
      case 'gantryCrush': {
        w.audio?.sfx('structure.groan', p.aim, 1);
        w.fx.marker(p.aim, MARSHAL.attacks.gantryCrush.radius, PALETTE.red, p.total, true);
        const shadow = new THREE.Mesh(new THREE.CircleGeometry(MARSHAL.attacks.gantryCrush.radius, 32), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4, depthWrite: false }));
        shadow.rotation.x = -Math.PI / 2; shadow.position.copy(p.aim).setY(p.aim.y + 0.2); w.scene.add(shadow); p.fx.push(shadow);
        const beam = new THREE.Mesh(new THREE.BoxGeometry(8, 8, 60), new THREE.MeshStandardMaterial({ color: 0x3a3f45, metalness: 0.6, roughness: 0.5 }));
        beam.position.copy(p.aim).setY(p.aim.y + 120); beam.rotation.y = this.w.rng.next() * Math.PI; w.scene.add(beam); p.fx.push(beam);
        break;
      }
      case 'overcharge': {
        w.audio?.sfx('aurora.flare', null, 1); w.hud?.chargeGlow(p.total);
        this.onEvent('beam');
        const glow = glowSprite(PALETTE.red, 30, 0.2); glow.position.set(0, 8, -4); this.rig.root.add(glow); p.fx.push(glow);
        break;
      }
    }
  }

  private resolvePending(dt: number): void {
    const p = this.pending!, w = this.w, A = MARSHAL.attacks;
    p.t -= dt;
    const k = 1 - p.t / p.total;
    if (p.kind === 'overcharge') {
      // the beam tracks until the last 0.25 s, then locks: sidestep with a quick boost
      if (p.t > 0.25) p.dir.copy(this.target().sub(this.pos).setY(0).normalize());
      const glow = p.fx[0] as THREE.Sprite; glow.material.opacity = 0.2 + 0.8 * k; glow.scale.setScalar(30 + 40 * k);
      this.yaw = Math.atan2(-p.dir.x, -p.dir.z);
    }
    if (p.kind === 'gantryCrush') { const beam = p.fx[1]!; beam.position.y = p.aim.y + 6 + 114 * (1 - k * k); }
    if (p.kind === 'bladeLunge' || p.kind === 'rifleBurst') { const to = this.target().sub(this.pos).setY(0).normalize(); this.yaw = Math.atan2(-to.x, -to.z); }
    if (p.t > 0) return;
    this.pending = null;
    for (const o of p.fx) { if (o.parent) o.parent.remove(o); }
    const tgt = this.target();
    switch (p.kind) {
      case 'rifleBurst': {
        this.glint.material.opacity = 0;
        for (let i = 0; i < A.rifleBurst.shots; i++) this.shoot(tgt, A.rifleBurst.damage, 0.6);
        break;
      }
      case 'bladeLunge': this.lungeT = Math.min(0.9, (this.pos.distanceTo(tgt) + 20) / A.bladeLunge.lungeSpeed); this.lungeDir.copy(tgt.clone().sub(this.pos).setY(0).normalize()); this.lungeHit = false; this.yaw = Math.atan2(-this.lungeDir.x, -this.lungeDir.z); break;
      case 'missileSalvo': for (let i = 0; i < A.missileSalvo.count; i++) { this.fireRocket(tgt, i % 2); const pr = this.projectiles[this.projectiles.length - 1]!; pr.dmg = A.missileSalvo.damage; pr.v.applyAxisAngle(new THREE.Vector3(0, 1, 0), (i - 2.5) * 0.18); } break;
      case 'gantryCrush':
        w.fx.explosion(p.aim, 3, 0xd0d6dc); w.audio?.sfx('debris.impact', p.aim, 1); w.addShake(0.5);
        if (tgt.distanceTo(p.aim) < A.gantryCrush.radius) w.aegis?.damage(A.gantryCrush.damage, p.aim);
        break;
      case 'overcharge': {
        const from = this.aimPoint();
        const end = from.clone().addScaledVector(p.dir, 900);
        for (let i = 0; i < 4; i++) w.fx.tracer(from.clone().add(new THREE.Vector3(0, i - 1.5, 0)), end, PALETTE.red, 0.6);
        w.fx.flash(from, 0xff6060, 20, 0.3);
        w.audio?.sfx('mech.cannon', this.pos, 1); w.addShake(0.6);
        // distance from the target to the beam line
        const rel = tgt.clone().sub(this.pos).setY(0);
        const along = rel.dot(p.dir);
        const perp = rel.clone().addScaledVector(p.dir, -along).length();
        if (along > 0 && perp < A.overcharge.width / 2) w.aegis?.damage(A.overcharge.damage, this.pos);
        else this.onEvent('beam-dodged');
        break;
      }
    }
  }

  /** Phase 3 grapple: he closes, rips the shoulder cannon off. The hit lands regardless (no QTE). */
  grapple(): void {
    const a = this.w.aegis; if (!a) return;
    this.grappling = 1.6;
    const p = a.frame.pos.clone().add(a.frame.forward().multiplyScalar(14));
    this.pos.copy(p);
    this.yaw = Math.atan2(-(a.frame.pos.x - p.x), -(a.frame.pos.z - p.z));
    a.loseSystem('shoulderCannon');
    a.damage(120, this.pos);
    this.w.addShake(0.6);
    this.w.hitstop(90);
  }

  override present(dt: number): void { super.present(dt); }
}
