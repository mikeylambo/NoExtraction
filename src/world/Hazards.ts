import * as THREE from 'three';
import type { World } from '../game/World';
import { worldMat } from './Materials';

interface Box3 { min: THREE.Vector3; max: THREE.Vector3 }
export interface WaterVolume { id: string; box: Box3; level: number; rate: number; target: number; mesh: THREE.Mesh; lethal: boolean }
interface Steam { box: Box3; t: number; mesh: THREE.Points }
interface Flare { p: THREE.Vector3; r: number; t: number; light: THREE.PointLight }

const inside = (b: Box3, p: { x: number; y: number; z: number }) => p.x >= b.min.x && p.x <= b.max.x && p.y >= b.min.y && p.y <= b.max.y && p.z >= b.min.z && p.z <= b.max.z;

/** Rising water, steam (vision blockers), flares, darkness zones and kill planes. */
export class Hazards {
  readonly water: WaterVolume[] = [];
  private steam: Steam[] = [];
  private flares: Flare[] = [];
  readonly dark: { box: Box3; amount: number }[] = [];
  private drownT = 0;
  constructor(private readonly w: World) {}

  addWater(id: string, min: [number, number, number], max: [number, number, number], level: number, lethal = true): WaterVolume {
    const box = { min: new THREE.Vector3(...min), max: new THREE.Vector3(...max) };
    const geo = new THREE.PlaneGeometry(box.max.x - box.min.x, box.max.z - box.min.z, 1, 1); geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, worldMat('water'));
    mesh.position.set((box.min.x + box.max.x) / 2, level, (box.min.z + box.max.z) / 2);
    mesh.renderOrder = 2;
    this.w.scene.add(mesh);
    const v = { id, box, level, rate: 0, target: level, mesh, lethal };
    this.water.push(v);
    return v;
  }

  /** Raise a volume toward `level` at `rate` m/s. */
  rise(id: string, level: number, rate: number): void { const v = this.water.find((x) => x.id === id); if (v) { v.target = level; v.rate = rate; } }
  setLevel(id: string, level: number): void { const v = this.water.find((x) => x.id === id); if (v) { v.level = v.target = level; v.rate = 0; v.mesh.position.y = level; } }

  addSteam(min: [number, number, number], max: [number, number, number], seconds: number): void {
    const box = { min: new THREE.Vector3(...min), max: new THREE.Vector3(...max) };
    const n = 260; const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = box.min.x + ((i * 0.618) % 1) * (box.max.x - box.min.x); pos[i * 3 + 1] = box.min.y + ((i * 0.381) % 1) * (box.max.y - box.min.y); pos[i * 3 + 2] = box.min.z + ((i * 0.7548) % 1) * (box.max.z - box.min.z); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xe6eef4, size: 2.6, transparent: true, opacity: 0.55, depthWrite: false }));
    this.w.scene.add(pts);
    this.steam.push({ box, t: seconds, mesh: pts });
  }

  addDark(min: [number, number, number], max: [number, number, number], amount: number): void { this.dark.push({ box: { min: new THREE.Vector3(...min), max: new THREE.Vector3(...max) }, amount }); }

  flare(p: THREE.Vector3, r: number, seconds: number): void {
    const light = new THREE.PointLight(0xffd0c0, 30, r * 2.2, 1.6);
    light.position.copy(p).setY(p.y + 6); this.w.scene.add(light);
    this.flares.push({ p: p.clone(), r, t: seconds, light });
    this.w.fx.flash(light.position, 0xffe0d0, 4, 0.5);
  }

  /** Segment passes through active steam. */
  visionBlocked(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): boolean {
    for (const s of this.steam) {
      if (s.t <= 0) continue;
      for (let k = 0.15; k < 1; k += 0.17) {
        const p = { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k };
        if (inside(s.box, p)) return true;
      }
    }
    return false;
  }
  inSteam(p: THREE.Vector3): boolean { return this.steam.some((s) => s.t > 0 && inside(s.box, { x: p.x, y: p.y + 1, z: p.z })); }
  darknessAt(p: THREE.Vector3): number { let d = 0; for (const z of this.dark) if (inside(z.box, p)) d = Math.max(d, z.amount); for (const f of this.flares) if (f.t > 0 && f.p.distanceTo(p) < f.r) d = 0; return d; }
  /** Player visibility boost inside a flare. */
  flareBoost(p: THREE.Vector3): number { return this.flares.some((f) => f.t > 0 && f.p.distanceTo(p) < f.r) ? 1.6 : 1; }

  waterDepthAt(p: THREE.Vector3): number {
    let d = 0;
    for (const v of this.water) if (p.x >= v.box.min.x && p.x <= v.box.max.x && p.z >= v.box.min.z && p.z <= v.box.max.z) d = Math.max(d, v.level - p.y);
    return d;
  }

  update(dt: number): void {
    for (const v of this.water) {
      if (v.rate > 0 && v.level !== v.target) { v.level += Math.sign(v.target - v.level) * Math.min(Math.abs(v.target - v.level), v.rate * dt); v.mesh.position.y = v.level; }
    }
    for (const s of this.steam) {
      s.t -= dt;
      const m = s.mesh.material as THREE.PointsMaterial;
      m.opacity = Math.max(0, Math.min(0.55, s.t * 0.4));
      s.mesh.position.y = Math.sin(this.w.simTime) * 0.2;
    }
    this.steam = this.steam.filter((s) => { if (s.t <= -1.5) { this.w.scene.remove(s.mesh); return false; } return true; });
    for (const f of this.flares) { f.t -= dt; f.light.intensity = Math.max(0, f.t) * 6; }
    this.flares = this.flares.filter((f) => { if (f.t <= 0) { this.w.scene.remove(f.light); return false; } return true; });

    // player drowning in lethal water
    const p = this.w.player;
    if (p && p.alive && !this.w.inMech) {
      const depth = this.waterDepthAt(p.pos);
      p.submerged = Math.min(1, depth / 1.6);
      const lethal = this.water.some((v) => v.lethal && depth > 0);
      if (depth > 1.65 && lethal) { this.drownT += dt; if (this.drownT > 2.5) p.damage(60 * dt * 4); }
      else this.drownT = Math.max(0, this.drownT - dt);
      p.darkness = this.darknessAt(p.pos);
      p.inSteam = this.inSteam(p.pos);
    }
  }

  clear(): void {
    for (const v of this.water) this.w.scene.remove(v.mesh);
    for (const s of this.steam) this.w.scene.remove(s.mesh);
    for (const f of this.flares) this.w.scene.remove(f.light);
    this.water.length = 0; this.steam = []; this.flares = []; this.dark.length = 0;
  }
}
