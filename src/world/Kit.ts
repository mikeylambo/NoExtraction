import * as THREE from 'three';
import { KIT_RULES, type KitRule } from '../../data/kit';
import { kitPiece, type LoadedPiece } from '../render/kit';
import { worldMat, matSnow, patchWorld, type MatKey } from './Materials';
import type { SolidKind } from './Collision';

/** A static level box as the kit pass sees it. */
export interface KitBox { min: THREE.Vector3; max: THREE.Vector3; mat: MatKey; kind: SolidKind }

/** Result: what to draw, and which boxes no longer need their box mesh (and whether they keep decals). */
export interface KitResult { meshes: THREE.InstancedMesh[]; dressed: Map<number, { decals: boolean }> }

function hash(...n: number[]): number {
  let h = 0x9e3779b1;
  for (const v of n) { h ^= Math.round(v * 100) | 0; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; }
  return (h >>> 0) / 4294967296;
}

const inRange = (v: number, r?: [number, number]) => !r || (v >= r[0] - 1e-6 && v <= r[1] + 1e-6);

function matches(rule: KitRule, b: KitBox): boolean {
  if (!rule.mats.includes(b.mat) || !rule.kinds.includes(b.kind)) return false;
  const sx = b.max.x - b.min.x, sz = b.max.z - b.min.z, h = b.max.y - b.min.y;
  const len = Math.max(sx, sz), thick = Math.min(sx, sz);
  if (!inRange(len, rule.len) || !inRange(thick, rule.thick) || !inRange(h, rule.h)) return false;
  if (rule.square && len / thick > rule.square) return false;
  if (rule.tall && h < rule.tall * len) return false;
  return rule.pieces.some((p) => kitPiece(p));
}

/**
 * Matrix that maps a piece's bounds [0, size] onto the cell [min, min + cell], after turning it
 * `turn` quarter turns about Y. Odd turns swap which piece axis runs along world X.
 */
const _box = new THREE.Box3(), _r = new THREE.Matrix4(), _s = new THREE.Matrix4();
function fitMatrix(piece: THREE.Vector3, min: THREE.Vector3, cell: THREE.Vector3, turn: number): THREE.Matrix4 {
  const odd = turn % 2 === 1;
  _s.makeScale((odd ? cell.z : cell.x) / piece.x, cell.y / piece.y, (odd ? cell.x : cell.z) / piece.z);
  _r.makeRotationY((turn * Math.PI) / 2);
  const m = new THREE.Matrix4().multiplyMatrices(_r, _s);
  _box.set(new THREE.Vector3(0, 0, 0), piece.clone()).applyMatrix4(m);
  const t = new THREE.Matrix4().makeTranslation(min.x - _box.min.x, min.y - _box.min.y, min.z - _box.min.z);
  return t.multiply(m);
}

/** Cells (min corner + size) a box is cut into for its rule. */
function cells(rule: KitRule, b: KitBox, piece: LoadedPiece): { min: THREE.Vector3; size: THREE.Vector3 }[] {
  const size = b.max.clone().sub(b.min);
  if (rule.mode === 'fit') return [{ min: b.min.clone(), size }];
  if (rule.mode === 'stack') {
    const foot = Math.max(size.x, size.z);
    const n = Math.max(1, Math.round(size.y / Math.max(foot, piece.size.y * (foot / piece.size.x))));
    return Array.from({ length: n }, (_, i) => ({ min: new THREE.Vector3(b.min.x, b.min.y + (size.y / n) * i, b.min.z), size: new THREE.Vector3(size.x, size.y / n, size.z) }));
  }
  // tile: along the long horizontal side, and up when the module has a height
  const alongX = size.x >= size.z;
  const len = alongX ? size.x : size.z;
  const [mLen, mH] = rule.module ?? [piece.size.x];
  const nA = Math.max(1, Math.round(len / mLen));
  const nU = mH ? Math.max(1, Math.round(size.y / mH)) : 1;
  const out: { min: THREE.Vector3; size: THREE.Vector3 }[] = [];
  for (let i = 0; i < nA; i++) for (let j = 0; j < nU; j++) {
    const min = b.min.clone(); const cs = size.clone();
    if (alongX) { min.x += (len / nA) * i; cs.x = len / nA; } else { min.z += (len / nA) * i; cs.z = len / nA; }
    min.y += (size.y / nU) * j; cs.y = size.y / nU;
    out.push({ min, size: cs });
  }
  return out;
}

const authored = new Map<string, THREE.Material>();
/** An authored GLB material with the world patch (snow cover, visor scan, core glow), per snow level. */
function authoredMat(m: THREE.Material, snow: number): THREE.Material {
  const key = `${m.uuid}:${snow}`;
  let out = authored.get(key);
  if (!out) {
    out = m.clone();
    if ((out as THREE.MeshStandardMaterial).isMeshStandardMaterial) patchWorld(out as THREE.MeshStandardMaterial, snow, 0);
    authored.set(key, out);
  }
  return out;
}

/**
 * Dress static level boxes with kit pieces (data/kit.ts rules). Collision is untouched: this only
 * decides what is drawn. One InstancedMesh per piece part and material, so a hundred rocks cost a
 * handful of draw calls.
 */
export function dressBoxes(boxes: KitBox[], rules: KitRule[] = KIT_RULES): KitResult {
  const dressed = new Map<number, { decals: boolean }>();
  const batches = new Map<string, { geo: THREE.BufferGeometry; mat: THREE.Material; mats: THREE.Matrix4[]; name: string }>();
  boxes.forEach((b, bi) => {
    const rule = rules.find((r) => matches(r, b));
    if (!rule) return;
    const avail = rule.pieces.filter((p) => kitPiece(p));
    const piece = kitPiece(avail[Math.floor(hash(b.min.x, b.min.z, bi) * avail.length)]!)!;
    const size = b.max.clone().sub(b.min);
    // tiles run along the long side: a piece's length (x) goes along Z on a north-south box
    const baseTurn = rule.mode === 'tile' && size.z > size.x ? 1 : 0;
    for (const [ci, c] of cells(rule, b, piece).entries()) {
      const turn = rule.turn ? Math.floor(hash(b.min.x, b.min.y + ci, b.min.z, 7) * 4) : baseTurn;
      const m = fitMatrix(piece.size, c.min, c.size, turn);
      for (const [pi, part] of piece.parts.entries()) {
        const mat = part.material ? authoredMat(part.material, matSnow(b.mat)) : worldMat(b.mat);
        const key = `${piece.id}:${pi}:${part.material ? 'own' : b.mat}`;
        let batch = batches.get(key);
        if (!batch) batches.set(key, batch = { geo: part.geometry, mat, mats: [], name: `kit:${piece.id}:${part.material ? pi : b.mat}` });
        batch.mats.push(m);
      }
    }
    dressed.set(bi, { decals: rule.decals });
  });
  const meshes: THREE.InstancedMesh[] = [];
  for (const b of batches.values()) {
    const im = new THREE.InstancedMesh(b.geo, b.mat, b.mats.length);
    b.mats.forEach((m, i) => im.setMatrixAt(i, m));
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
    im.castShadow = true; im.receiveShadow = true;
    im.name = b.name;
    meshes.push(im);
  }
  return { meshes, dressed };
}
