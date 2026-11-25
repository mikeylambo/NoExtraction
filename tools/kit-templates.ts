// Code-built stand-ins for every environment kit piece (assets/manifest.ts KIT_PIECES).
//   npx tsx tools/kit-templates.ts [--out public/assets/kit] [--only rock_a,crate]
// Each GLB has the piece's exact bounds, stands on y = 0 with its front toward +Z, and uses one
// material named `world` (so the game paints it with the dressed box's scanned surface). They are
// what the game draws until an artist's GLB replaces the file, and the bounds an artist models to:
// import one into Blender as the reference block for that piece.
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import fs from 'node:fs';
import path from 'node:path';
import { KIT_PIECES } from '../assets/manifest';

const args = process.argv.slice(2);
const opt = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const OUT = opt('--out') ?? path.join('public', 'assets', 'kit');
const ONLY = opt('--only')?.split(',');

// ---------------------------------------------------------------- shapes (non-indexed, with normals)
type G = THREE.BufferGeometry;
/** Axis-aligned block from min to max corner. */
function block(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): G {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).toNonIndexed();
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return g;
}
/** Cylinder along an axis through (cx, cy, cz). */
function tube(r: number, len: number, axis: 'x' | 'y' | 'z', cx: number, cy: number, cz: number, seg = 20, r2 = r): G {
  const g = new THREE.CylinderGeometry(r2, r, len, seg, 1).toNonIndexed();
  if (axis === 'x') g.rotateZ(-Math.PI / 2);
  if (axis === 'z') g.rotateX(Math.PI / 2);
  g.translate(cx, cy, cz);
  return g;
}
function merge(parts: G[]): G {
  const out = new THREE.BufferGeometry();
  for (const k of ['position', 'normal'] as const) {
    const arr = new Float32Array(parts.reduce((a, g) => a + g.attributes[k]!.array.length, 0));
    let o = 0; for (const g of parts) { arr.set(g.attributes[k]!.array as Float32Array, o); o += g.attributes[k]!.array.length; }
    out.setAttribute(k, new THREE.BufferAttribute(arr, 3));
  }
  return out;
}

/** Deterministic value noise for rocks (no Math.random: same file every run). */
function noise3(x: number, y: number, z: number, seed: number): number {
  const h = (i: number, j: number, k: number) => { const s = Math.sin(i * 127.1 + j * 311.7 + k * 74.7 + seed * 19.3) * 43758.5453; return s - Math.floor(s); };
  const fx = Math.floor(x), fy = Math.floor(y), fz = Math.floor(z);
  const ux = x - fx, uy = y - fy, uz = z - fz;
  const s = (t: number) => t * t * (3 - 2 * t);
  let v = 0;
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) for (let k = 0; k < 2; k++)
    v += h(fx + i, fy + j, fz + k) * (i ? s(ux) : 1 - s(ux)) * (j ? s(uy) : 1 - s(uy)) * (k ? s(uz) : 1 - s(uz));
  return v;
}
/** A boulder (4 × 3 × 4) or, with `cliff`, a 4 × 10 × 4 column with vertical strata and ledges. */
function rock(seed: number, cliff = false): G {
  const W = 4, H = cliff ? 10 : 3, D = 4;
  let g: G = new THREE.BoxGeometry(W, H, D, 10, cliff ? 20 : 7, 10);
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  g = mergeVertices(g);
  const p = g.attributes.position!;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const q = new THREE.Vector3(v.x / (W / 2), v.y / (H / 2), v.z / (D / 2));
    // round the box toward an ellipsoid (keeps most of the collision box covered)
    if (cliff) {
      // round only across (a column, not a dome); the top edge crumbles with the noise below
      const hz = Math.hypot(q.x, q.z);
      if (hz > 0) { const k = 1 + (1.12 / hz - 1) * 0.45; q.x *= k; q.z *= k; }
    } else {
      const e = q.clone().normalize();
      q.lerp(e.multiplyScalar(q.length() > 0 ? 1.12 : 0), 0.4);
    }
    // facets and lumps: two octaves, stronger on the sides than the base
    const n = cliff
      // strata: stretched in y, plus stepped ledges
      ? noise3(v.x * 0.8, v.y * 0.18, v.z * 0.8, seed) * 0.55 + noise3(v.x * 2.1, v.y * 0.6, v.z * 2.1, seed + 5) * 0.25 + (Math.floor(v.y * 0.7 + noise3(v.x, 0, v.z, seed) * 2) % 2) * 0.2
      : noise3(v.x * 0.9, v.y * 0.9, v.z * 0.9, seed) * 0.7 + noise3(v.x * 2.3, v.y * 2.3, v.z * 2.3, seed + 5) * 0.3;
    const k = 1 + (n - 0.5) * 0.28 * (q.y < -0.85 ? 0.3 : 1);
    v.set(q.x * k * (W / 2), Math.max(q.y * k * (H / 2), -H / 2), q.z * k * (D / 2));
    p.setXYZ(i, v.x, v.y, v.z);
  }
  // exact bounds again after the noise (the game fits bounds to the box)
  g.computeBoundingBox();
  const sz = g.boundingBox!.getSize(new THREE.Vector3());
  g.scale(W / sz.x, H / sz.y, D / sz.z);
  g.computeVertexNormals();
  return g.toNonIndexed();
}

/** Pivot at the bottom centre (ASSET_SPEC.md §2): centred in x and z, standing on y = 0. */
function pivot(g: G): G {
  g.computeBoundingBox();
  const b = g.boundingBox!;
  g.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
  return g;
}

// ---------------------------------------------------------------- pieces (bounds = manifest size)
const BUILD: Record<string, () => G> = {
  // core fills the bounds; face plates leave 4 cm seams at the module edges and a mid-height formwork seam
  wall_panel: () => merge([
    block(0, 0, 0.03, 4, 2.5, 0.57),
    block(0.04, 0.04, 0.57, 3.96, 1.23, 0.6), block(0.04, 1.27, 0.57, 3.96, 2.46, 0.6),
    block(0.04, 0.04, 0, 3.96, 1.23, 0.03), block(0.04, 1.27, 0, 3.96, 2.46, 0.03),
  ]),
  wall_cap: () => merge([block(0, 0.12, 0, 4, 0.3, 0.9), block(0, 0, 0.12, 4, 0.12, 0.78)]),
  crate: () => {
    const s = 1.2, b = 0.08, parts: G[] = [block(0.05, 0.05, 0.05, s - 0.05, s - 0.05, s - 0.05)];
    for (const a of [0, s - b]) for (const c of [0, s - b]) {
      parts.push(block(0, a, c, s, a + b, c + b)); // along x
      parts.push(block(a, 0, c, a + b, s, c + b)); // along y
      parts.push(block(a, c, 0, a + b, c + b, s)); // along z
    }
    return merge(parts);
  },
  rock_a: () => rock(1), rock_b: () => rock(2), rock_c: () => rock(3),
  cliff_a: () => rock(11, true), cliff_b: () => rock(12, true),
  pipe_run: () => merge([
    tube(0.27, 4, 'x', 2, 0.32, 0.3), tube(0.15, 4, 'x', 2, 0.2, 0.63), tube(0.17, 4, 'x', 2, 0.8, 0.42),
    block(0.45, 0, 0, 0.6, 1.0, 0.8), block(3.4, 0, 0, 3.55, 1.0, 0.8),
  ]),
  tank: () => merge([
    block(0, 0, 0, 4, 0.3, 4), tube(1.9, 4.4, 'y', 2, 2.5, 2, 32), tube(1.5, 0.3, 'y', 2, 4.85, 2, 32, 1.1),
    block(1.9, 0.3, 3.88, 1.95, 4.7, 3.98), block(2.25, 0.3, 3.88, 2.3, 4.7, 3.98),
  ]),
  pole: () => merge([tube(0.09, 6, 'y', 0.15, 3, 0.15, 12), block(0, 0, 0, 0.3, 0.05, 0.3)]),
  blast_barrier: () => merge([block(0, 0, 0, 1, 0.35, 1), block(0.03, 0.35, 0.3, 0.97, 1.5, 0.7), block(0.03, 0.35, 0.25, 0.97, 0.5, 0.75)]),
};

// ---------------------------------------------------------------- minimal GLB writer
function glb(name: string, g: G): Buffer {
  const pos = g.attributes.position!.array as Float32Array, nor = g.attributes.normal!.array as Float32Array;
  g.computeBoundingBox();
  const bb = g.boundingBox!;
  const bin = Buffer.concat([Buffer.from(pos.buffer, pos.byteOffset, pos.byteLength), Buffer.from(nor.buffer, nor.byteOffset, nor.byteLength)]);
  const count = pos.length / 3;
  const json = {
    asset: { version: '2.0', generator: 'no-extraction kit-templates' },
    scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0, name }],
    meshes: [{ name, primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, material: 0 }] }],
    materials: [{ name: 'world', pbrMetallicRoughness: { baseColorFactor: [0.6, 0.6, 0.6, 1], metallicFactor: 0, roughnessFactor: 0.9 } }],
    buffers: [{ byteLength: bin.length }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: pos.byteLength, target: 34962 }, { buffer: 0, byteOffset: pos.byteLength, byteLength: nor.byteLength, target: 34962 }],
    accessors: [
      { bufferView: 0, componentType: 5126, count, type: 'VEC3', min: bb.min.toArray(), max: bb.max.toArray() },
      { bufferView: 1, componentType: 5126, count, type: 'VEC3' },
    ],
  };
  const pad = (b: Buffer, fill: number) => (b.length % 4 ? Buffer.concat([b, Buffer.alloc(4 - (b.length % 4), fill)]) : b);
  const j = pad(Buffer.from(JSON.stringify(json)), 0x20), d = pad(bin, 0);
  const head = Buffer.alloc(12); head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + j.length + 8 + d.length, 8);
  const ch = (len: number, type: number) => { const b = Buffer.alloc(8); b.writeUInt32LE(len, 0); b.writeUInt32LE(type, 4); return b; };
  return Buffer.concat([head, ch(j.length, 0x4e4f534a), j, ch(d.length, 0x004e4942), d]);
}

fs.mkdirSync(OUT, { recursive: true });
let bad = 0;
for (const p of KIT_PIECES) {
  if (ONLY && !ONLY.includes(p.id)) continue;
  const build = BUILD[p.id];
  if (!build) { console.log(`skip ${p.id}: no stand-in shape`); continue; }
  const g = pivot(build());
  g.computeBoundingBox();
  const s = g.boundingBox!.getSize(new THREE.Vector3());
  const ok = Math.abs(s.x - p.size[0]) < 0.01 && Math.abs(s.y - p.size[1]) < 0.01 && Math.abs(s.z - p.size[2]) < 0.01;
  if (!ok) bad++;
  const tris = g.attributes.position!.count / 3;
  fs.writeFileSync(path.join(OUT, `${p.id}.glb`), glb(p.id, g));
  console.log(`${ok ? 'ok ' : 'BAD'} ${p.id.padEnd(14)} ${s.toArray().map((v) => v.toFixed(2)).join(' x ')} m  ${tris} tris (budget ${p.tris})`);
}
if (bad) { console.error(`${bad} piece(s) do not match their manifest size`); process.exit(1); }
