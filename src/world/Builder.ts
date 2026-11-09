import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CollisionWorld, makeSolid, type Solid, type SolidKind, type Surface } from './Collision';
import { worldMat, isTransparent, glowSprite, type MatKey } from './Materials';

export interface BoxOpts {
  mat?: MatKey;
  kind?: SolidKind;
  surface?: Surface;
  /** No collision (decor). */
  decor?: boolean;
  /** Gets its own mesh (gates, collapsing pieces). */
  dynamic?: boolean;
  tag?: string;
  solid?: Partial<Solid>;
  /** Per-box tint jitter 0..1. */
  jitter?: number;
  shadow?: boolean;
}

export const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** Deterministic hash for cosmetic jitter (no Math.random in level construction). */
function hash3(x: number, y: number, z: number): number {
  let h = Math.imul(Math.floor(x * 73.1) ^ 0x9e3779b1, 0x85ebca6b) ^ Math.imul(Math.floor(y * 19.7) + 7, 0xc2b2ae35) ^ Math.imul(Math.floor(z * 37.3) + 13, 0x27d4eb2f);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12;
  return ((h >>> 0) % 10000) / 10000;
}

/**
 * Level construction DSL. Every collidable is an axis-aligned box registered with the collision
 * world; static boxes are merged per material into a handful of meshes for the draw-call budget.
 */
export class LevelBuilder {
  private batches = new Map<MatKey, THREE.BufferGeometry[]>();
  readonly root = new THREE.Group();
  readonly dynamicMeshes: THREE.Mesh[] = [];

  constructor(readonly world: CollisionWorld) { this.root.name = 'level'; }

  /** Box by min/max corners. */
  box(min: THREE.Vector3, max: THREE.Vector3, o: BoxOpts = {}): Solid | null {
    const mat = o.mat ?? 'concrete';
    const size = max.clone().sub(min);
    if (size.x <= 0 || size.y <= 0 || size.z <= 0) return null;
    const geo = new THREE.BoxGeometry(size.x, size.y, size.z);
    geo.translate(min.x + size.x / 2, min.y + size.y / 2, min.z + size.z / 2);
    // UV-free vertex colour tint with small deterministic variation
    const j = (o.jitter ?? 0.08) * (hash3(min.x, min.y, min.z) - 0.5) * 2;
    const n = geo.attributes.position!.count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const k = 1 + j; col[i * 3] = k; col[i * 3 + 1] = k; col[i * 3 + 2] = k * (1 + j * 0.15); }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    let solid: Solid | null = null;
    if (!o.decor) {
      solid = makeSolid(min, max, o.kind ?? 'wall', { surface: o.surface, tag: o.tag, ...o.solid });
      this.world.add(solid);
    }
    if (o.dynamic) {
      geo.translate(-(min.x + size.x / 2), -(min.y + size.y / 2), -(min.z + size.z / 2));
      const mesh = new THREE.Mesh(geo, worldMat(mat));
      mesh.position.set(min.x + size.x / 2, min.y + size.y / 2, min.z + size.z / 2);
      mesh.castShadow = o.shadow ?? true; mesh.receiveShadow = true;
      this.root.add(mesh);
      this.dynamicMeshes.push(mesh);
      if (solid) solid.mesh = mesh;
      else return { id: -1, min, max, kind: 'prop', surface: 'metal', walk: false, sight: false, bullet: false, block: false, mech: false, active: false, mesh } as Solid;
    } else {
      let arr = this.batches.get(mat);
      if (!arr) { arr = []; this.batches.set(mat, arr); }
      arr.push(geo);
    }
    return solid;
  }

  /** Box by centre-x/z, footprint, height, base y. */
  at(x: number, z: number, w: number, d: number, h: number, y = 0, o: BoxOpts = {}): Solid | null {
    return this.box(V(x - w / 2, y, z - d / 2), V(x + w / 2, y + h, z + d / 2), o);
  }

  /** Walkable slab whose top is at `y`. */
  floor(x: number, z: number, w: number, d: number, y = 0, o: BoxOpts = {}): Solid | null {
    return this.at(x, z, w, d, o.kind === 'platform' ? 0.5 : 3, y - (o.kind === 'platform' ? 0.5 : 3), { mat: 'snow', kind: 'floor', surface: 'snow', ...o, solid: { block: false, ...o.solid } });
  }

  wall(x: number, z: number, w: number, d: number, h: number, y = 0, o: BoxOpts = {}) { return this.at(x, z, w, d, h, y, { mat: 'concrete', kind: 'wall', ...o }); }
  coverLow(x: number, z: number, w: number, d: number, y = 0, o: BoxOpts = {}) { return this.at(x, z, w, d, 1.0, y, { mat: 'metal', kind: 'cover-low', ...o }); }
  coverHigh(x: number, z: number, w: number, d: number, y = 0, o: BoxOpts = {}) { return this.at(x, z, w, d, 1.5, y, { mat: 'metalDark', kind: 'cover-high', ...o }); }
  crate(x: number, z: number, s = 1.2, h = s, y = 0, o: BoxOpts = {}) { return this.at(x, z, s, s, h, y, { mat: 'crate', kind: 'crate', ...o }); }
  /** Snow berm: soft cover (blocks sight when crouched, not bullets). */
  berm(x: number, z: number, w: number, d: number, y = 0) { return this.at(x, z, w, d, 1.0, y, { mat: 'drift', kind: 'berm', surface: 'drift', solid: { bullet: false } }); }
  /** Ice wall: transparent to the visor, not to bullets; does not block sight. */
  iceWall(x: number, z: number, w: number, d: number, h: number, y = 0) { return this.at(x, z, w, d, h, y, { mat: 'iceWall', kind: 'ice-wall', surface: 'ice', solid: { sight: false } }); }
  rock(x: number, z: number, w: number, d: number, h: number, y = 0, o: BoxOpts = {}) { return this.at(x, z, w, d, h, y, { mat: 'rock', kind: 'wall', surface: 'rock', jitter: 0.2, ...o }); }

  /** Hollow building with door gaps. Doors: side + offset along side (from centre) + width. */
  building(x: number, z: number, w: number, d: number, h: number, o: { y?: number; mat?: MatKey; doors?: { side: 'n' | 's' | 'e' | 'w'; at?: number; width?: number; height?: number }[]; roof?: boolean; thick?: number; floorMat?: MatKey } = {}) {
    const y = o.y ?? 0, t = o.thick ?? 0.4, mat = o.mat ?? 'concrete';
    const sides: Record<'n' | 's' | 'e' | 'w', { cx: number; cz: number; len: number; alongX: boolean }> = {
      n: { cx: x, cz: z - d / 2 + t / 2, len: w, alongX: true },
      s: { cx: x, cz: z + d / 2 - t / 2, len: w, alongX: true },
      w: { cx: x - w / 2 + t / 2, cz: z, len: d - 2 * t, alongX: false },
      e: { cx: x + w / 2 - t / 2, cz: z, len: d - 2 * t, alongX: false },
    };
    for (const k of ['n', 's', 'e', 'w'] as const) {
      const sd = sides[k];
      const doors = (o.doors ?? []).filter((dd) => dd.side === k).map((dd) => ({ c: dd.at ?? 0, w: dd.width ?? 2.2, h: dd.height ?? 2.6 })).sort((a, b) => a.c - b.c);
      let cursor = -sd.len / 2;
      const seg = (a: number, b: number, y0: number, hh: number) => {
        if (b - a < 0.05) return;
        const mid = (a + b) / 2, len = b - a;
        if (sd.alongX) this.at(sd.cx + mid, sd.cz, len, t, hh, y0, { mat, kind: 'wall' });
        else this.at(sd.cx, sd.cz + mid, t, len, hh, y0, { mat, kind: 'wall' });
      };
      for (const dd of doors) {
        seg(cursor, dd.c - dd.w / 2, y, h);
        if (h - dd.h > 0.05) seg(dd.c - dd.w / 2, dd.c + dd.w / 2, y + dd.h, h - dd.h);
        cursor = dd.c + dd.w / 2;
      }
      seg(cursor, sd.len / 2, y, h);
    }
    if (o.roof !== false) this.at(x, z, w, d, 0.4, y + h, { mat, kind: 'wall', solid: { walk: true } });
    this.floor(x, z, w - 2 * t, d - 2 * t, y + 0.02, { mat: o.floorMat ?? 'grate', surface: 'metal', kind: 'platform' });
  }

  /** Stairs climbing along +dir from (x,z). */
  stairs(x: number, z: number, dir: 'x+' | 'x-' | 'z+' | 'z-', width: number, steps: number, stepH = 0.4, stepD = 0.6, y = 0, mat: MatKey = 'concrete') {
    for (let i = 0; i < steps; i++) {
      const off = i * stepD + stepD / 2, top = y + (i + 1) * stepH;
      const [cx, cz, w, d] = dir === 'x+' ? [x + off, z, stepD, width] : dir === 'x-' ? [x - off, z, stepD, width] : dir === 'z+' ? [x, z + off, width, stepD] : [x, z - off, width, stepD];
      this.at(cx, cz, w, d, top - y, y, { mat, kind: 'floor', solid: { block: true, walk: true } });
    }
  }

  /** Point glow (sprite only; real lights come from the light pool). */
  glow(x: number, y: number, z: number, color: number, size = 2, opacity = 0.7): THREE.Sprite {
    const s = glowSprite(color, size, opacity); s.position.set(x, y, z); this.root.add(s); return s;
  }

  /** Merge static batches into meshes. Call once after building. */
  finish(): void {
    for (const [mat, geos] of this.batches) {
      const merged = mergeGeometries(geos, false);
      for (const g of geos) g.dispose();
      if (!merged) continue;
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, worldMat(mat));
      mesh.name = `static:${mat}`;
      mesh.castShadow = !isTransparent(mat) && mat !== 'snow' && mat !== 'drift';
      mesh.receiveShadow = !isTransparent(mat);
      mesh.renderOrder = isTransparent(mat) ? 2 : 0;
      this.root.add(mesh);
    }
    this.batches.clear();
  }
}
