import * as THREE from 'three';
import { COLLAPSE, MECH_COLLAPSE_DAMAGE_SCALE, type CollapseKind } from '../../data/collapse';
import { PALETTE } from '../../data/palette';
import { FEEL } from '../../data/feel';
import type { World } from '../game/World';
import type { Solid } from './Collision';

/** An authored collapse instance placed in a level. */
export interface CollapseInstance {
  id: string;
  kind: CollapseKind;
  at: [number, number, number];
  /** Solids (by tag) removed when it lands (gap / opened route). */
  remove?: string[];
  /** Solids (by tag) activated when it lands (new path / blocked route). Start inactive. */
  add?: string[];
  /** Falling pieces (by tag): meshes drop from above and become solid. */
  drop?: string[];
  /** Fissure/shelf line end (crack line from `at` to `to`). */
  to?: [number, number, number];
  radius?: number;
  /** Steam volume box (relative half extents). */
  extent?: [number, number, number];
  /** Scales telegraph (difficulty does not shorten world telegraphs). */
  telegraphScale?: number;
  mech?: boolean;
  onLand?: () => void;
}

interface Running { inst: CollapseInstance; t: number; tele: number; fx: THREE.Object3D[] }

/**
 * Collapse events: every one announces itself (sound + light) for its telegraph time, then lands.
 * World changes are permanent within a chapter and recorded in WorldState.
 */
export class CollapseSystem {
  private defs = new Map<string, CollapseInstance>();
  private running: Running[] = [];
  private tagged = new Map<string, Solid[]>();
  readonly log: { id: string; kind: CollapseKind; telegraphAt: number; landAt: number }[] = [];
  constructor(private readonly w: World) {}

  register(list: CollapseInstance[]): void { for (const c of list) this.defs.set(c.id, c); }
  /** Index solids by tag (call after the level is built). */
  index(): void {
    this.tagged.clear();
    for (const s of this.w.collision.solids.values()) if (s.tag) { const a = this.tagged.get(s.tag) ?? []; a.push(s); this.tagged.set(s.tag, a); }
  }
  solidsByTag(tag: string): Solid[] { return this.tagged.get(tag) ?? []; }
  get activeCount(): number { return this.running.length; }
  isRunning(id: string): boolean { return this.running.some((r) => r.inst.id === id); }
  has(id: string): boolean { return this.defs.has(id); }

  /** Start a registered collapse, or an ad-hoc one (debris fields). */
  trigger(idOrInst: string | CollapseInstance): void {
    const inst = typeof idOrInst === 'string' ? this.defs.get(idOrInst) : idOrInst;
    if (!inst) return;
    if (typeof idOrInst === 'string' && this.w.state.applied(`collapse.${inst.id}`)) return;
    if (this.isRunning(inst.id)) return;
    const def = COLLAPSE[inst.kind];
    const tele = def.telegraph * (inst.telegraphScale ?? 1);
    const r: Running = { inst, t: 0, tele, fx: [] };
    this.running.push(r);
    this.log.push({ id: inst.id, kind: inst.kind, telegraphAt: this.w.simTime, landAt: this.w.simTime + tele });
    this.telegraph(r);
  }

  /** Re-apply landed collapses after a checkpoint restore (no telegraph, no damage). */
  restore(): void {
    for (const c of this.defs.values()) if (this.w.state.applied(`collapse.${c.id}`)) this.applyChanges(c, true);
  }

  private at(inst: CollapseInstance) { return new THREE.Vector3(...inst.at); }

  private telegraph(r: Running): void {
    const w = this.w, inst = r.inst, p = this.at(inst);
    switch (inst.kind) {
      case 'fissure': {
        w.audio?.sfx('ice.crack.near', p, 1); w.audio?.rumble(0.8, r.tele);
        const to = inst.to ? new THREE.Vector3(...inst.to) : p.clone().add(new THREE.Vector3(8, 0, 0));
        r.fx.push(this.crackLine(p, to, PALETTE.violet));
        w.addShake(0.15);
        break;
      }
      case 'structure':
        w.audio?.sfx('structure.groan', p, 1);
        for (const tag of inst.drop ?? []) for (const s of this.solidsByTag(tag)) if (s.mesh) { s.mesh.visible = true; s.mesh.position.y = (s.min.y + s.max.y) / 2 + 30; }
        break;
      case 'shelf': {
        w.audio?.sfx('shelf.tilt', p, 1); w.audio?.rumble(1, r.tele);
        const to = inst.to ? new THREE.Vector3(...inst.to) : p.clone().add(new THREE.Vector3(0, 0, 20));
        r.fx.push(this.crackLine(p, to, PALETTE.violet));
        break;
      }
      case 'debris':
        w.audio?.sfx('debris.whistle', p, 1);
        w.fx.marker(p, inst.radius ?? COLLAPSE.debris.radius!, PALETTE.violet, r.tele, true);
        r.fx.push(this.streak(p));
        break;
      case 'aurora':
        w.audio?.sfx('aurora.flare', p, 1);
        w.atmo.flare = 1;
        w.hud?.staticBurst(r.tele);
        break;
      case 'steam':
        w.audio?.sfx('steam.vent', p, 1);
        w.fx.burst(p, { count: 20, speed: 3, up: 2, life: 1.2, size: 1, grow: 1.5, color: 0xe6eef4, alpha: 0.5, additive: false });
        break;
    }
    w.audio?.sting('collapse');
  }

  private crackLine(a: THREE.Vector3, b: THREE.Vector3, color: number): THREE.Mesh {
    const len = a.distanceTo(b);
    const g = new THREE.PlaneGeometry(len, 0.35); g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.position.copy(a).lerp(b, 0.5).setY(Math.max(a.y, b.y) + 0.08);
    m.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
    this.w.scene.add(m);
    return m;
  }

  private streak(p: THREE.Vector3): THREE.Mesh {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.05, 30, 6), new THREE.MeshBasicMaterial({ color: 0xffe2c0, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.position.copy(p).add(new THREE.Vector3(40, 140, -20));
    m.lookAt(p); m.rotateX(Math.PI / 2);
    m.userData.from = m.position.clone(); m.userData.to = p.clone();
    this.w.scene.add(m);
    return m;
  }

  update(dt: number): void {
    const w = this.w;
    for (const r of [...this.running]) {
      r.t += dt;
      const k = Math.min(1, r.t / r.tele);
      for (const o of r.fx) {
        const mat = (o as THREE.Mesh).material as THREE.MeshBasicMaterial;
        if (o.userData.from) { o.position.lerpVectors(o.userData.from, o.userData.to, k * k); }
        else mat.opacity = 0.3 + 0.7 * k * (0.7 + 0.3 * Math.sin(r.t * 30));
      }
      if (r.inst.kind === 'structure') {
        for (const tag of r.inst.drop ?? []) for (const s of this.solidsByTag(tag)) if (s.mesh && Math.floor(r.t * 6) !== Math.floor((r.t - dt) * 6)) w.fx.burst(s.mesh.position.clone().setY(s.max.y + 1), { count: 3, speed: 1, life: 1, size: 0.4, color: 0xb9c2c9, additive: false, alpha: 0.6, gravity: 6 });
      }
      if (r.inst.kind === 'shelf' && w.player) w.addShake(0.05 * k);
      if (r.t >= r.tele) { this.land(r); this.running.splice(this.running.indexOf(r), 1); for (const o of r.fx) w.scene.remove(o); }
    }
  }

  private land(r: Running): void {
    const w = this.w, inst = r.inst, p = this.at(inst);
    w.addShake(FEEL.shake.collapse);
    switch (inst.kind) {
      case 'debris': {
        const rad = inst.radius ?? COLLAPSE.debris.radius!;
        w.fx.explosion(p, inst.mech ? 3 : 1.4, 0xffb070);
        w.audio?.sfx('debris.impact', p, 1);
        this.damageRadius(p, rad, COLLAPSE.debris.damage!);
        break;
      }
      case 'aurora':
        w.player?.visor && (w.player.visor.offline = COLLAPSE.aurora.duration!);
        w.perception.radioEnabled = false;
        w.alert.alarmsOfflineT = COLLAPSE.aurora.duration!;
        w.onStep('aurora-radio', (dt) => { if (w.alert.alarmsOfflineT <= dt) { w.perception.radioEnabled = true; w.offStep('aurora-radio'); } });
        if (w.aegis) w.aegis.stormStatic(COLLAPSE.aurora.duration!);
        break;
      case 'steam': {
        const e = inst.extent ?? [4, 4, 4];
        w.hazards.addSteam([p.x - e[0], p.y, p.z - e[2]], [p.x + e[0], p.y + e[1] * 2, p.z + e[2]], COLLAPSE.steam.duration!);
        break;
      }
      case 'structure':
        this.damageRadius(p, inst.radius ?? COLLAPSE.structure.radius!, COLLAPSE.structure.damage!);
        w.fx.burst(p, { count: 40, speed: 6, life: 1.6, size: 1.6, grow: 2, color: 0xb9c2c9, additive: false, alpha: 0.6, up: 0.5 });
        w.audio?.sfx('debris.impact', p, 0.8);
        break;
      case 'fissure': case 'shelf':
        w.fx.burst(p, { count: 30, speed: 5, life: 1.2, size: 0.8, grow: 1.2, color: 0xe8eef3, additive: false, alpha: 0.6, up: 0.6 });
        w.audio?.sfx('ice.crack.near', p, 1);
        break;
    }
    this.applyChanges(inst, false);
    if (inst.kind !== 'debris') w.state.apply(`collapse.${inst.id}`);
    inst.onLand?.();
  }

  private applyChanges(inst: CollapseInstance, silent: boolean): void {
    for (const tag of inst.remove ?? []) for (const s of this.solidsByTag(tag)) {
      s.active = false;
      if (s.mesh) { if (silent) s.mesh.visible = false; else this.fall(s.mesh); }
    }
    for (const tag of [...(inst.add ?? []), ...(inst.drop ?? [])]) for (const s of this.solidsByTag(tag)) {
      s.active = true;
      if (s.mesh) { s.mesh.visible = true; s.mesh.position.y = (s.min.y + s.max.y) / 2; }
      // crush anything inside a dropped piece
      if (!silent) for (const e of this.w.enemies) if (e.alive && e.pos.x > s.min.x - 0.4 && e.pos.x < s.max.x + 0.4 && e.pos.z > s.min.z - 0.4 && e.pos.z < s.max.z + 0.4) e.kill('collapse');
    }
  }

  private fall(mesh: THREE.Object3D): void {
    let v = 0; const id = `fall-${mesh.id}`;
    this.w.onStep(id, (dt) => { v += 25 * dt; mesh.position.y -= v * dt; mesh.rotation.z += dt * 0.4; if (mesh.position.y < -60) { mesh.visible = false; this.w.offStep(id); } });
  }

  private damageRadius(p: THREE.Vector3, r: number, dmg: number): void {
    const w = this.w;
    if (w.inMech && w.aegis) { if (w.aegis.frame.pos.distanceTo(p) < r * 3) w.aegis.damage(dmg * MECH_COLLAPSE_DAMAGE_SCALE, p); }
    else if (w.player && w.player.pos.distanceTo(p) < r) w.player.damage(dmg / Math.max(0.2, w.difficulty.enemyDamage) * (w.difficultyId === 'story' ? 0.5 : 1), p);
    for (const e of w.enemies) if (e.alive && e.pos.distanceTo(p) < r) { e.damage(dmg * 2, { from: p }); if (e.alive) e.stun(1.5); }
    for (const m of w.mechHostiles) if (m.alive && m.pos.distanceTo(p) < r * 3) m.damage(dmg * MECH_COLLAPSE_DAMAGE_SCALE, p);
  }

  clear(): void { for (const r of this.running) for (const o of r.fx) this.w.scene.remove(o); this.running = []; this.defs.clear(); this.tagged.clear(); this.log.length = 0; }
}
