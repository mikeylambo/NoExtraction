import * as THREE from 'three';

export type SolidKind = 'floor' | 'wall' | 'cover-low' | 'cover-high' | 'crate' | 'berm' | 'ice-wall' | 'gate' | 'door-weak' | 'prop' | 'platform' | 'mech';
export type Surface = 'snow' | 'ice' | 'metal' | 'drift' | 'water' | 'rock';

export interface Solid {
  readonly id: number;
  min: THREE.Vector3;
  max: THREE.Vector3;
  kind: SolidKind;
  surface: Surface;
  /** Can be stood on. */
  walk: boolean;
  /** Blocks enemy sight (ice walls do not). */
  sight: boolean;
  /** Blocks bullets. */
  bullet: boolean;
  /** Blocks on-foot movement. */
  block: boolean;
  /** Blocks mech movement (small props do not). */
  mech: boolean;
  active: boolean;
  tag?: string;
  mesh?: THREE.Object3D;
}

let nextSolidId = 1;
export function makeSolid(min: THREE.Vector3, max: THREE.Vector3, kind: SolidKind, opts: Partial<Solid> = {}): Solid {
  const h = max.y - min.y;
  const defaults: Omit<Solid, 'id' | 'min' | 'max' | 'kind'> = {
    surface: kind === 'floor' ? 'snow' : kind === 'ice-wall' ? 'ice' : 'metal',
    walk: true,
    sight: kind !== 'ice-wall',
    bullet: true,
    block: kind !== 'floor',
    mech: kind === 'floor' || kind === 'mech' || h > 6,
    active: true,
  };
  return { id: nextSolidId++, min: min.clone(), max: max.clone(), kind, ...defaults, ...opts };
}

export interface RayHit { t: number; solid: Solid; point: THREE.Vector3; normal: THREE.Vector3 }
export type RayMask = 'sight' | 'bullet' | 'block' | 'mech' | 'walk';

/**
 * Axis-aligned world: every collidable is a box. Grid hash for broad phase, DDA for rays,
 * circle-vs-box push-out for characters. Authoritative and independent of render meshes.
 */
export class CollisionWorld {
  readonly solids = new Map<number, Solid>();
  private cells = new Map<number, Solid[]>();
  private stamp = new Map<number, number>();
  private stampN = 0;
  constructor(readonly cell = 8) {}

  private k(cx: number, cz: number) { return ((cx + 32768) & 0xffff) * 65536 + ((cz + 32768) & 0xffff); }

  add(s: Solid): Solid {
    this.solids.set(s.id, s);
    const c = this.cell;
    for (let x = Math.floor(s.min.x / c); x <= Math.floor(s.max.x / c); x++)
      for (let z = Math.floor(s.min.z / c); z <= Math.floor(s.max.z / c); z++) {
        const key = this.k(x, z);
        let arr = this.cells.get(key);
        if (!arr) { arr = []; this.cells.set(key, arr); }
        arr.push(s);
      }
    return s;
  }

  remove(s: Solid): void {
    if (!this.solids.delete(s.id)) return;
    const c = this.cell;
    for (let x = Math.floor(s.min.x / c); x <= Math.floor(s.max.x / c); x++)
      for (let z = Math.floor(s.min.z / c); z <= Math.floor(s.max.z / c); z++) {
        const arr = this.cells.get(this.k(x, z));
        if (arr) { const i = arr.indexOf(s); if (i >= 0) arr.splice(i, 1); }
      }
  }

  /** Move a solid (re-hash). */
  move(s: Solid, min: THREE.Vector3, max: THREE.Vector3): void {
    this.remove(s); s.min.copy(min); s.max.copy(max); this.add(s);
  }

  clear(): void { this.solids.clear(); this.cells.clear(); }

  near(x: number, z: number, r: number, out: Solid[] = []): Solid[] {
    out.length = 0;
    const n = ++this.stampN; const c = this.cell;
    for (let cx = Math.floor((x - r) / c); cx <= Math.floor((x + r) / c); cx++)
      for (let cz = Math.floor((z - r) / c); cz <= Math.floor((z + r) / c); cz++) {
        const arr = this.cells.get(this.k(cx, cz)); if (!arr) continue;
        for (const s of arr) { if (this.stamp.get(s.id) === n) continue; this.stamp.set(s.id, n); out.push(s); }
      }
    return out;
  }

  private tmp: Solid[] = [];

  /**
   * Highest walkable top under (x, z) that is at or below `maxY`. Returns -Infinity over a void.
   */
  groundAt(x: number, z: number, maxY = Infinity, radius = 0): { y: number; solid: Solid | null } {
    let best = -Infinity; let bs: Solid | null = null;
    for (const s of this.near(x, z, radius + 0.01, this.tmp)) {
      if (!s.active || !s.walk) continue;
      if (x < s.min.x - radius || x > s.max.x + radius || z < s.min.z - radius || z > s.max.z + radius) continue;
      const top = s.max.y;
      if (top <= maxY && top > best) { best = top; bs = s; }
    }
    return { y: best, solid: bs };
  }

  /** Mech ground: ignores solids the mech walks over (not mech-blocking, not floor). */
  mechGroundAt(x: number, z: number, maxY = Infinity): number {
    let best = -Infinity;
    for (const s of this.near(x, z, 0.01, this.tmp)) {
      if (!s.active || !s.walk || !(s.kind === 'floor' || s.mech)) continue;
      if (x < s.min.x || x > s.max.x || z < s.min.z || z > s.max.z) continue;
      if (s.max.y <= maxY && s.max.y > best) best = s.max.y;
    }
    return best;
  }

  /**
   * Push a vertical cylinder out of blocking boxes. Boxes whose top is within `step` of the feet
   * are ignored (they are stepped onto, not pushed against). Returns true if pushed.
   */
  resolveCylinder(pos: THREE.Vector3, radius: number, height: number, step: number, mech = false): boolean {
    let pushed = false;
    for (let iter = 0; iter < 3; iter++) {
      let any = false;
      for (const s of this.near(pos.x, pos.z, radius + 0.5, this.tmp)) {
        if (!s.active) continue;
        if (mech ? !s.mech || s.kind === 'floor' : !s.block) continue;
        if (s.max.y <= pos.y + step || s.min.y >= pos.y + height) continue;
        const cx = Math.max(s.min.x, Math.min(pos.x, s.max.x));
        const cz = Math.max(s.min.z, Math.min(pos.z, s.max.z));
        let dx = pos.x - cx, dz = pos.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= radius * radius) continue;
        if (d2 < 1e-10) {
          // centre inside the box: push out along the shallowest axis
          const pxn = pos.x - s.min.x, pxp = s.max.x - pos.x, pzn = pos.z - s.min.z, pzp = s.max.z - pos.z;
          const m = Math.min(pxn, pxp, pzn, pzp);
          if (m === pxn) pos.x = s.min.x - radius; else if (m === pxp) pos.x = s.max.x + radius; else if (m === pzn) pos.z = s.min.z - radius; else pos.z = s.max.z + radius;
        } else {
          const d = Math.sqrt(d2); dx /= d; dz /= d;
          pos.x = cx + dx * radius; pos.z = cz + dz * radius;
        }
        any = pushed = true;
      }
      if (!any) break;
    }
    return pushed;
  }

  /** First solid blocking a probe box at a height band in front of a point (for vault/mantle). */
  probe(x: number, z: number, minY: number, maxY: number, r = 0.05): Solid | null {
    let best: Solid | null = null;
    for (const s of this.near(x, z, r + 0.05, this.tmp)) {
      if (!s.active || !s.block) continue;
      if (x < s.min.x - r || x > s.max.x + r || z < s.min.z - r || z > s.max.z + r) continue;
      if (s.max.y < minY || s.min.y > maxY) continue;
      if (!best || s.max.y > best.max.y) best = s;
    }
    return best;
  }

  /** Is the box space free (no blocking solid overlapping)? */
  free(x: number, z: number, y0: number, y1: number, r: number): boolean {
    for (const s of this.near(x, z, r + 0.1, this.tmp)) {
      if (!s.active || !s.block) continue;
      if (x + r <= s.min.x || x - r >= s.max.x || z + r <= s.min.z || z - r >= s.max.z) continue;
      if (y1 <= s.min.y || y0 >= s.max.y) continue;
      return false;
    }
    return true;
  }

  /** Ray cast (segment from → to). DDA over grid cells; slab test per box. */
  ray(from: THREE.Vector3, to: THREE.Vector3, mask: RayMask, ignore?: (s: Solid) => boolean): RayHit | null {
    const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-6) return null;
    const c = this.cell;
    let cx = Math.floor(from.x / c), cz = Math.floor(from.z / c);
    const ex = Math.floor(to.x / c), ez = Math.floor(to.z / c);
    const sx = dx > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
    const tdx = dx !== 0 ? Math.abs(c / dx) : Infinity, tdz = dz !== 0 ? Math.abs(c / dz) : Infinity;
    let tmx = dx !== 0 ? ((dx > 0 ? (cx + 1) * c : cx * c) - from.x) / dx : Infinity;
    let tmz = dz !== 0 ? ((dz > 0 ? (cz + 1) * c : cz * c) - from.z) / dz : Infinity;
    const n = ++this.stampN;
    let bestT = Infinity; let best: Solid | null = null; let bestAxis = 0;
    let steps = 0;
    for (;;) {
      const arr = this.cells.get(this.k(cx, cz));
      if (arr) for (const s of arr) {
        if (this.stamp.get(s.id) === n) continue;
        this.stamp.set(s.id, n);
        if (!s.active || !s[mask] || (ignore && ignore(s))) continue;
        const r = slab(from, dx, dy, dz, s);
        if (r && r.t < bestT) { bestT = r.t; best = s; bestAxis = r.axis; }
      }
      // early out: the next cell boundary is beyond the best hit
      const tNext = Math.min(tmx, tmz);
      if (best && bestT <= tNext) break;
      if ((cx === ex && cz === ez) || ++steps > 4096) break;
      if (tmx < tmz) { cx += sx; tmx += tdx; } else { cz += sz; tmz += tdz; }
      if (tNext > 1) break;
    }
    if (!best) return null;
    const point = new THREE.Vector3(from.x + dx * bestT, from.y + dy * bestT, from.z + dz * bestT);
    const normal = new THREE.Vector3();
    if (bestAxis === 0) normal.x = -Math.sign(dx); else if (bestAxis === 1) normal.y = -Math.sign(dy); else normal.z = -Math.sign(dz);
    return { t: bestT, solid: best, point, normal };
  }

  blocked(from: THREE.Vector3, to: THREE.Vector3, mask: RayMask): boolean { return this.ray(from, to, mask) !== null; }
}

function slab(o: THREE.Vector3, dx: number, dy: number, dz: number, s: Solid): { t: number; axis: number } | null {
  let tmin = 0, tmax = 1, axis = -1;
  const ox = [o.x, o.y, o.z], d = [dx, dy, dz], mn = [s.min.x, s.min.y, s.min.z], mx = [s.max.x, s.max.y, s.max.z];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]!) < 1e-9) { if (ox[i]! < mn[i]! || ox[i]! > mx[i]!) return null; continue; }
    let t1 = (mn[i]! - ox[i]!) / d[i]!, t2 = (mx[i]! - ox[i]!) / d[i]!;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    if (t1 > tmin) { tmin = t1; axis = i; }
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return null;
  }
  if (axis < 0) return null; // origin inside the box: ignore (shooting out of cover you hug)
  return { t: tmin, axis };
}
