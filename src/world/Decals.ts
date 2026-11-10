import * as THREE from 'three';
import { DECAL_SETS, DECAL_LIMIT, type DecalSet, type DecalKind, type DecalAnchor } from '../../data/decals';
import { decalTex, type DecalTex } from '../render/decals';
import { matSnow, type MatKey } from './Materials';
import type { SolidKind } from './Collision';

/** A static level box as the decal pass sees it. */
export interface DecalBox { min: THREE.Vector3; max: THREE.Vector3; mat: MatKey; kind: SolidKind }

/** Face a decal sits on: outward axis. */
export type DecalFaceDir = 'x+' | 'x-' | 'z+' | 'z-' | 'y+';

export interface DecalPlacement {
  tex: string; cell?: number;
  /** Centre on the face. */
  at: THREE.Vector3;
  face: DecalFaceDir;
  /** Metres. */
  w: number; h: number;
  /** Floor decals: rotation about the face normal (radians). */
  rot?: number;
  flip?: boolean;
  tint?: number; opacity?: number;
  /** Snow cover factor of the surface underneath (Materials snow). */
  snow?: number;
}

const LIFT = 0.012; // metres off the face; polygon offset does the rest

/** Mulberry32: deterministic stream from an integer seed (no Math.random in level construction). */
function stream(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function strHash(t: string): number { let h = 7; for (let i = 0; i < t.length; i++) h = Math.imul(h ^ t.charCodeAt(i), 0x01000193); return h >>> 0; }
function seedOf(...n: number[]): number {
  let h = 0x811c9dc5;
  for (const v of n) { h ^= Math.round(v * 100) | 0; h = Math.imul(h, 0x01000193); h ^= h >>> 13; }
  return h >>> 0;
}

/** Collects decal quads and builds one merged mesh per texture. */
export class DecalBatch {
  private quads = new Map<string, { tex: DecalTex; pos: number[]; nor: number[]; uv: number[]; col: number[]; snow: number[] }>();
  count = 0;

  add(p: DecalPlacement): boolean {
    const tex = decalTex(p.tex);
    if (!tex) return false;
    let q = this.quads.get(p.tex);
    if (!q) { q = { tex, pos: [], nor: [], uv: [], col: [], snow: [] }; this.quads.set(p.tex, q); }
    const n = new THREE.Vector3(), up = new THREE.Vector3(), right = new THREE.Vector3();
    if (p.face === 'y+') {
      n.set(0, 1, 0);
      const r = p.rot ?? 0;
      up.set(Math.sin(r), 0, -Math.cos(r)); // image top toward −Z at rot 0
    } else {
      const s = p.face[1] === '+' ? 1 : -1;
      if (p.face[0] === 'x') n.set(s, 0, 0); else n.set(0, 0, s);
      up.set(0, 1, 0);
    }
    right.crossVectors(n.clone().negate(), up); // as seen by a viewer facing the decal
    const c = p.at.clone().addScaledVector(n, LIFT);
    const hw = p.w / 2, hh = p.h / 2;
    const corner = (sx: number, sy: number) => c.clone().addScaledVector(right, sx * hw).addScaledVector(up, sy * hh);
    const tl = corner(-1, 1), tr = corner(1, 1), bl = corner(-1, -1), br = corner(1, -1);
    // atlas cell UVs (v runs down the image), inset half a texel's worth to stop neighbours bleeding
    const [cols, rows] = tex.atlas;
    const cell = p.cell ?? 0;
    const cx = cell % cols, cy = Math.floor(cell / cols);
    const ins = 0.004;
    let u0 = (cx + ins) / cols, u1 = (cx + 1 - ins) / cols;
    const v0 = (cy + ins) / rows, v1 = (cy + 1 - ins) / rows;
    if (p.flip) [u0, u1] = [u1, u0];
    const verts: [THREE.Vector3, number, number][] = [[tl, u0, v0], [bl, u0, v1], [tr, u1, v0], [tr, u1, v0], [bl, u0, v1], [br, u1, v1]];
    const col = new THREE.Color(p.tint ?? 0xffffff);
    for (const [v, u, vv] of verts) {
      q.pos.push(v.x, v.y, v.z); q.nor.push(n.x, n.y, n.z); q.uv.push(u, vv);
      q.col.push(col.r, col.g, col.b, p.opacity ?? 1); q.snow.push(p.snow ?? 0);
    }
    this.count++;
    return true;
  }

  build(): THREE.Mesh[] {
    const out: THREE.Mesh[] = [];
    for (const [id, q] of this.quads) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(q.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(q.nor, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(q.uv, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(q.col, 4));
      g.setAttribute('aSnow', new THREE.Float32BufferAttribute(q.snow, 1));
      g.computeBoundingSphere();
      const mesh = new THREE.Mesh(g, q.tex.material);
      mesh.name = `decals:${id}`;
      mesh.receiveShadow = true; mesh.castShadow = false;
      mesh.renderOrder = 1; // after opaque level geometry, before transparent ice/water
      out.push(mesh);
    }
    this.quads.clear();
    return out;
  }
}

/** Uniform-grid index of box AABBs for "is this point inside another box" tests. */
class BoxIndex {
  private cells = new Map<string, DecalBox[]>();
  constructor(boxes: DecalBox[], private size = 8) {
    for (const b of boxes) {
      for (let x = Math.floor(b.min.x / size); x <= Math.floor(b.max.x / size); x++)
        for (let z = Math.floor(b.min.z / size); z <= Math.floor(b.max.z / size); z++) {
          const k = `${x},${z}`; let a = this.cells.get(k); if (!a) this.cells.set(k, a = []); a.push(b);
        }
    }
  }
  /** True if `p` is inside any box (with a small tolerance so touching faces count). */
  occupied(p: THREE.Vector3): boolean {
    const a = this.cells.get(`${Math.floor(p.x / this.size)},${Math.floor(p.z / this.size)}`);
    if (!a) return false;
    const e = 0.002;
    for (const b of a) if (p.x > b.min.x - e && p.x < b.max.x + e && p.y > b.min.y - e && p.y < b.max.y + e && p.z > b.min.z - e && p.z < b.max.z + e) return true;
    return false;
  }
}

interface Face { dir: DecalFaceDir; w: number; h: number; /** origin = face's lower-left as seen from outside */ point: (s: number, t: number) => THREE.Vector3; n: THREE.Vector3 }

function facesOf(b: DecalBox, which: 'wall' | 'floor'): Face[] {
  const { min, max } = b;
  if (which === 'floor') {
    // s along +X, t along −Z (so "up" on the decal is −Z, matching DecalBatch at rot 0)
    return [{ dir: 'y+', w: max.x - min.x, h: max.z - min.z, n: new THREE.Vector3(0, 1, 0), point: (s, t) => new THREE.Vector3(min.x + s, max.y, max.z - t) }];
  }
  const H = max.y - min.y;
  return [
    { dir: 'z+', w: max.x - min.x, h: H, n: new THREE.Vector3(0, 0, 1), point: (s, t) => new THREE.Vector3(min.x + s, min.y + t, max.z) },
    { dir: 'z-', w: max.x - min.x, h: H, n: new THREE.Vector3(0, 0, -1), point: (s, t) => new THREE.Vector3(max.x - s, min.y + t, min.z) },
    { dir: 'x+', w: max.z - min.z, h: H, n: new THREE.Vector3(1, 0, 0), point: (s, t) => new THREE.Vector3(max.x, min.y + t, max.z - s) },
    { dir: 'x-', w: max.z - min.z, h: H, n: new THREE.Vector3(-1, 0, 0), point: (s, t) => new THREE.Vector3(min.x, min.y + t, min.z + s) },
  ];
}

/** Decal size in metres for a kind: explicit, else the texture's physical size split by its atlas. */
function kindSize(k: DecalKind, tex: DecalTex): [number, number] {
  if (k.size) return k.size;
  return [tex.size[0] / tex.atlas[0], tex.size[1] / tex.atlas[1]];
}

function heightFor(anchor: DecalAnchor, H: number, h: number, r: number): number {
  switch (anchor) {
    case 'top': return H - h / 2 - 0.02;
    case 'bottom': return h / 2;
    case 'middle': return Math.min(Math.max(1.5, h / 2 + 0.2), H - h / 2 - 0.1);
    default: return h / 2 + r * Math.max(0, H - h);
  }
}

const WALL_KINDS = new Set<SolidKind>(['wall', 'cover-low', 'cover-high', 'crate', 'prop', 'mech', 'gate', 'door-weak']);
const FLOOR_KINDS = new Set<SolidKind>(['floor', 'platform']);

/**
 * Scatter every DECAL_SETS entry over the level's static boxes. Faces hidden by another box (walls
 * butted together, floors under a wall) are skipped by probing just outside each decal corner.
 */
export function scatterDecals(boxes: DecalBox[], batch: DecalBatch, sets: DecalSet[] = DECAL_SETS): void {
  const live = sets.map((s) => ({ s, kinds: s.kinds.filter((k) => decalTex(k.tex)) })).filter((x) => x.kinds.length);
  if (!live.length) return;
  const index = new BoxIndex(boxes);
  const probe = new THREE.Vector3();
  boxes.forEach((b, bi) => {
    for (const { s, kinds } of live) {
      if (!s.on.includes(b.mat)) continue;
      if (s.face === 'wall' ? !WALL_KINDS.has(b.kind) : !FLOOR_KINDS.has(b.kind)) continue;
      for (const [fi, f] of facesOf(b, s.face).entries()) {
        if (batch.count >= DECAL_LIMIT) return;
        const [mw, mh] = s.minFace ?? [0.4, 0.4];
        if (f.w < mw || f.h < mh) continue;
        const rnd = stream(seedOf(b.min.x, b.min.y, b.min.z, bi, fi, strHash(s.id)));
        const want = Math.min(s.max, Math.floor((f.w * f.h * s.density) / 100 + rnd()));
        for (let i = 0; i < want; i++) {
          const k = kinds[Math.floor(rnd() * kinds.length)]!;
          const tex = decalTex(k.tex)!;
          const [sw, sh] = kindSize(k, tex);
          const [lo, hi] = s.scale ?? [1, 1];
          let sc = lo + rnd() * (hi - lo);
          // shrink to fit the face (down to 60% of the drawn scale), otherwise give up on this one
          const fit = Math.min(1, (f.w - 0.1) / (sw * sc), (f.h - 0.04) / (sh * sc));
          if (fit < 0.6) continue;
          sc *= fit;
          const w = sw * sc, h = sh * sc;
          const rot = s.face === 'floor' ? rnd() * Math.PI * 2 : 0;
          // floors: keep the rotated quad's bounding box inside the face
          const ew = s.face === 'floor' ? Math.abs(w * Math.cos(rot)) + Math.abs(h * Math.sin(rot)) : w;
          const eh = s.face === 'floor' ? Math.abs(w * Math.sin(rot)) + Math.abs(h * Math.cos(rot)) : h;
          if (ew > f.w - 0.05 || eh > f.h - 0.02) continue;
          const sPos = ew / 2 + rnd() * (f.w - ew);
          const tPos = s.face === 'floor' ? eh / 2 + rnd() * (f.h - eh) : heightFor(s.anchor ?? 'any', f.h, h, rnd());
          const at = f.point(sPos, tPos);
          // occlusion: centre and corners, just outside the face, must be free
          let hidden = false;
          for (const [ox, oy] of [[0, 0], [-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]] as const) {
            const p2 = f.point(sPos + ox * ew, s.face === 'floor' ? tPos + oy * eh : tPos + oy * h);
            probe.copy(p2).addScaledVector(f.n, 0.05);
            if (index.occupied(probe)) { hidden = true; break; }
          }
          if (hidden) continue;
          batch.add({
            tex: k.tex, cell: k.cell, at, face: f.dir, w, h, rot,
            flip: !!s.flip && rnd() < 0.5, tint: k.tint, opacity: k.opacity, snow: matSnow(b.mat),
          });
        }
      }
    }
  });
}
