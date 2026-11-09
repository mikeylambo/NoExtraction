import * as THREE from 'three';
import { WEAPONS, THROWABLES, type WeaponId, type ThrowableId } from '../../data/weapons';
import { FEEL } from '../../data/feel';
import { PALETTE } from '../../data/palette';
import type { World } from '../game/World';
import type { InputFrame } from '../game/Input';
import type { Ballast } from './Ballast';
import type { Enemy } from '../ai/Enemy';

interface Thrown { kind: ThrowableId; p: THREE.Vector3; v: THREE.Vector3; t: number; mesh: THREE.Mesh; landed: boolean; active: number }

/** Deterministic spread stream for the player's weapons (simulation-safe). */
class Spread { private s = 0x1234567; next() { let t = (this.s += 0x6d2b79f5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 - 0.5; } }

/** Sidearm / carbine / shotgun, reloads, swaps, throwables, aim assist. */
export class Weapons {
  private cd = 0;
  private reloadT = 0;
  private fireHeld = 0;
  private thrown: Thrown[] = [];
  private spread = new Spread();
  recentlyFiredT = 0;
  private swapHoldUsed = false;
  constructor(private readonly w: World, private readonly p: Ballast) {}

  get recentlyFired(): boolean { return this.recentlyFiredT > 0; }
  get current(): WeaponId { return this.w.inventory.weapons[this.w.inventory.current] as WeaponId; }
  get def() { return WEAPONS[this.current]; }
  get reloading(): boolean { return this.reloadT > 0; }
  get reloadProgress(): number { return this.reloadT > 0 ? 1 - this.reloadT / this.def.reload : 1; }

  give(id: WeaponId, ammo?: number): void {
    const inv = this.w.inventory;
    if (!inv.weapons.includes(id)) { inv.weapons.push(id); inv.ammo[id] = { mag: WEAPONS[id].mag, reserve: Math.min(WEAPONS[id].reserveMax, ammo ?? WEAPONS[id].mag * 2) }; }
    else this.addAmmo(id, ammo ?? WEAPONS[id].mag);
  }
  addAmmo(id: WeaponId, n: number): void {
    const a = this.w.inventory.ammo[id]; if (!a) return;
    a.reserve = Math.min(WEAPONS[id].reserveMax, a.reserve + n);
  }

  select(i: number): void {
    const inv = this.w.inventory;
    if (i < 0 || i >= inv.weapons.length || i === inv.current) return;
    inv.current = i; this.reloadT = 0; this.cd = 0.35;
    this.w.audio?.sfx('gear.rattle', this.p.pos, 0.5);
  }

  update(dt: number, f: InputFrame, canAct: boolean): void {
    const w = this.w, inv = w.inventory;
    this.cd = Math.max(0, this.cd - dt);
    this.recentlyFiredT = Math.max(0, this.recentlyFiredT - dt);
    this.updateThrown(dt);
    if (!canAct) { this.fireHeld = 0; return; }
    const a = inv.ammo[this.current]!;
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) { const need = this.def.mag - a.mag; const take = Math.min(need, a.reserve); a.mag += take; a.reserve -= take; }
    }
    // swaps: number keys / wheel; pad Y = tap reload, hold swap
    if (f.pressed.has('weapon1')) this.select(0);
    if (f.pressed.has('weapon2')) this.select(1);
    if (f.pressed.has('weapon3')) this.select(2);
    if (f.wheel) this.select(((inv.current + Math.sign(f.wheel)) % inv.weapons.length + inv.weapons.length) % inv.weapons.length);
    const holdY = f.held.get('reload') ?? 0;
    if (f.pad && holdY > 0.35 && !this.swapHoldUsed) { this.swapHoldUsed = true; this.select((inv.current + 1) % inv.weapons.length); }
    if (f.released.has('reload')) { if (!this.swapHoldUsed) this.startReload(); this.swapHoldUsed = false; }
    else if (!f.pad && f.pressed.has('reload')) this.startReload();

    if (f.pressed.has('throwCycle')) inv.throwable = inv.throwable === 'flash' ? 'decoy' : 'flash';
    if (f.pressed.has('throw')) this.throwOne();

    const def = this.def;
    const firing = def.auto ? f.down.has('fire') : f.pressed.has('fire');
    if (firing && this.cd <= 0 && this.reloadT <= 0) {
      if (a.mag <= 0) { if (f.pressed.has('fire')) { w.audio?.sfx('empty', this.p.pos, 0.6); if (a.reserve > 0) this.startReload(); } }
      else this.fire();
    }
    if (!f.down.has('fire')) this.fireHeld = 0;
  }

  private startReload(): void {
    const a = this.w.inventory.ammo[this.current]!;
    if (this.reloadT > 0 || a.mag >= this.def.mag || a.reserve <= 0) return;
    this.reloadT = this.def.reload;
    this.w.audio?.sfx('reload', this.p.pos, 0.6);
  }

  /** Camera-centre aim ray with spread, against enemies and world. */
  private fire(): void {
    const w = this.w, def = this.def, inv = w.inventory;
    const a = inv.ammo[this.current]!;
    if (!w.dev.infiniteAmmo) a.mag--;
    this.cd = def.interval;
    this.fireHeld++;
    this.recentlyFiredT = 1.2;
    w.counters.shotsFired++;
    const origin = this.p.cam.position.clone();
    const dir = this.aimDir();
    const muzzle = new THREE.Vector3(); this.p.rig.muzzle.getWorldPosition(muzzle);
    const spread = (this.p.aiming ? def.spreadAim : def.spreadHip) * (1 + Math.min(4, this.fireHeld * 0.15)) * (this.p.speed > 3 ? 1.6 : 1);
    const hits = new Map<Enemy, number>();
    for (let i = 0; i < def.pellets; i++) {
      const d = dir.clone();
      d.x += this.spread.next() * spread * 2; d.y += this.spread.next() * spread * 2; d.z += this.spread.next() * spread * 2; d.normalize();
      const end = origin.clone().addScaledVector(d, def.range);
      const wh = w.collision.ray(origin, end, 'bullet', (s) => s.kind === 'berm' && false);
      const maxT = wh ? wh.t * def.range : def.range;
      let best: { e: Enemy; t: number; head: boolean } | null = null;
      for (const e of w.enemies) {
        if (!e.alive) continue;
        const r = e.rayHit(origin, d, maxT);
        if (r && (!best || r.t < best.t)) best = { e, t: r.t, head: r.head };
      }
      const hitPoint = origin.clone().addScaledVector(d, best ? best.t : maxT);
      w.fx.tracer(muzzle, hitPoint, PALETTE.cyan, def.loud ? 0.06 : 0.04);
      if (best) {
        const dmg = def.headshotKill && best.head ? 9999 : def.damage * (best.head ? def.headMult : 1) * w.difficulty.playerDamage;
        hits.set(best.e, (hits.get(best.e) ?? 0) + dmg);
        w.fx.burst(hitPoint, { count: 5, speed: 3, life: 0.3, size: 0.12, color: 0xd0d8e0 });
        if (def.breach === false || !best) void 0;
      } else if (wh) {
        w.fx.burst(hitPoint, { count: 4, speed: 2.5, life: 0.35, size: 0.1, color: 0xe8eef3, additive: false, alpha: 0.7 });
        if (def.breach && wh.solid.kind === 'door-weak') w.gates.breach(wh.solid);
      }
    }
    for (const [e, dmg] of hits) e.damage(dmg, { from: this.p.pos, loud: def.loud, weapon: def.id });
    w.fx.flash(muzzle, def.loud ? 0xffd9a0 : 0x9fdfff, def.loud ? 0.8 : 0.35, 0.05);
    w.audio?.sfx(`${def.id}.fire`, this.p.pos, 1);
    w.addShake(def.id === 'shotgun' ? FEEL.shake.shotgun : def.id === 'carbine' ? FEEL.shake.carbine : FEEL.shake.sidearm);
    this.p.cam.look(this.spread.next() * def.recoil * 0.5, def.recoil);
    w.perception.emit({ kind: def.loud ? 'loud' : 'noise', pos: this.p.pos, radius: def.noise, sourceId: 'player' });
    if (a.mag === 0 && a.reserve > 0) this.startReload();
  }

  /** Aim direction with optional pad aim assist (magnetism toward the nearest head). */
  aimDir(): THREE.Vector3 {
    const dir = new THREE.Vector3(); this.w.camera.getWorldDirection(dir);
    const assist = this.w.options.aimAssist * (this.w.dev.god ? 1 : 1);
    if (assist <= 0 || !this.p.aiming) return dir;
    let best: THREE.Vector3 | null = null; let bestDot = Math.cos(0.06 + assist * 0.05);
    const origin = this.p.cam.position;
    for (const e of this.w.enemies) {
      if (!e.alive) continue;
      const to = e.headPos().sub(origin); const dist = to.length(); to.divideScalar(dist);
      const dot = to.dot(dir);
      if (dot > bestDot && dist < this.def.range) { bestDot = dot; best = to; }
    }
    return best ? dir.lerp(best, 0.35 * assist).normalize() : dir;
  }

  private throwOne(): void {
    const w = this.w, inv = w.inventory;
    const kind = inv.throwable;
    if (inv[kind] <= 0) { const other = kind === 'flash' ? 'decoy' : 'flash'; if (inv[other] > 0) inv.throwable = other; else { w.audio?.sfx('empty', this.p.pos, 0.4); return; } }
    const k = inv.throwable;
    inv[k]--;
    const def = THROWABLES[k];
    const dir = this.aimDir(); dir.y += 0.25; dir.normalize();
    const p = this.p.eye.addScaledVector(this.p.cam.right(), 0.3);
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshStandardMaterial({ color: 0x222831, emissive: PALETTE.cyan, emissiveIntensity: 1.5 }));
    mesh.position.copy(p); w.scene.add(mesh);
    this.thrown.push({ kind: k, p, v: dir.multiplyScalar(def.speed), t: def.fuse, mesh, landed: false, active: 0 });
    w.audio?.sfx('throw', this.p.pos, 0.5);
  }

  private updateThrown(dt: number): void {
    const w = this.w;
    for (const t of this.thrown) {
      if (t.active > 0) {
        t.active -= dt;
        if (t.kind === 'decoy' && Math.floor((t.active + dt) / 0.6) !== Math.floor(t.active / 0.6)) {
          w.perception.emit({ kind: 'noise', pos: t.p, radius: THROWABLES.decoy.radius, sourceId: 'decoy' });
          w.audio?.sfx('decoy.ping', t.p, 0.6);
          w.fx.marker(t.p, 1.5, PALETTE.cyan, 0.5);
        }
        continue;
      }
      if (!t.landed) {
        t.v.y -= 20 * dt;
        const next = t.p.clone().addScaledVector(t.v, dt);
        const hit = w.collision.ray(t.p, next, 'block');
        if (hit) { t.p.copy(hit.point).addScaledVector(hit.normal, 0.1); if (hit.normal.y > 0.5) { t.v.multiplyScalar(0.3); t.v.y = Math.abs(t.v.y) * 0.3; if (t.v.length() < 1.5) t.landed = true; } else t.v.reflect(hit.normal).multiplyScalar(0.4); }
        else t.p.copy(next);
        const g = w.collision.groundAt(t.p.x, t.p.z, t.p.y + 0.1);
        if (t.p.y <= g.y + 0.09) { t.p.y = g.y + 0.09; t.v.y = Math.abs(t.v.y) * 0.3; t.v.x *= 0.6; t.v.z *= 0.6; if (t.v.length() < 1.2) t.landed = true; }
        t.mesh.position.copy(t.p);
      }
      t.t -= dt;
      if (t.t <= 0 && t.active <= 0) this.detonate(t);
    }
    this.thrown = this.thrown.filter((t) => { const keep = t.t > 0 || t.active > 0; if (!keep) w.scene.remove(t.mesh); return keep; });
  }

  private detonate(t: Thrown): void {
    const w = this.w;
    if (t.kind === 'flash') {
      const r = THROWABLES.flash.radius;
      w.fx.flash(t.p, 0xffffff, 18, 0.25);
      w.fx.burst(t.p, { count: 30, speed: 9, life: 0.4, size: 0.3, color: 0xffffff });
      w.audio?.sfx('flash.bang', t.p, 1);
      w.perception.emit({ kind: 'noise', pos: t.p, radius: 14, sourceId: 'flash' });
      for (const e of w.enemies) {
        if (!e.alive) continue;
        if (e.pos.distanceTo(t.p) <= r && !w.collision.blocked(t.p.clone().setY(t.p.y + 0.3), e.pos.clone().setY(e.pos.y + 1.4), 'sight')) e.stun(THROWABLES.flash.stun ?? 3);
      }
      const pd = this.p.pos.distanceTo(t.p);
      if (pd < r && !w.options.reduceFlashes) w.hud?.whiteout(0.6 * (1 - pd / r));
      t.active = 0;
    } else {
      t.active = 3.6;
      w.audio?.sfx('decoy.ping', t.p, 0.8);
    }
  }

  dispose(): void { for (const t of this.thrown) this.w.scene.remove(t.mesh); this.thrown = []; }
}
