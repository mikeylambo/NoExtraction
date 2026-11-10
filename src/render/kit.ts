import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { KIT_PIECES } from '../../assets/manifest';

const DIR = `${import.meta.env?.BASE_URL ?? '/'}assets/kit/`;

/** One drawable part of a kit piece: geometry in piece space (bounds start at 0,0,0). */
export interface KitPart {
  geometry: THREE.BufferGeometry;
  /** null = use the dressed box's own world material (the GLB material was named `world`). */
  material: THREE.Material | null;
}
export interface LoadedPiece { id: string; parts: KitPart[]; size: THREE.Vector3 }

const loaded = new Map<string, LoadedPiece>();

/** The loaded kit piece `id`, or null (no file: boxes it would dress stay boxes). */
export function kitPiece(id: string): LoadedPiece | null { return loaded.get(id) ?? null; }

/** Bake a GLB scene into parts grouped by material, moved so its bounds start at the origin. */
function bake(scene: THREE.Object3D, id: string): LoadedPiece | null {
  scene.updateMatrixWorld(true);
  const byMat = new Map<THREE.Material | null, THREE.BufferGeometry[]>();
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || (m as unknown as THREE.SkinnedMesh).isSkinnedMesh) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    const src = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    src.applyMatrix4(m.matrixWorld);
    if (!src.attributes.normal) src.computeVertexNormals();
    // a multi-material mesh: split by its groups
    const pieces = mats.length > 1 && src.groups.length
      ? src.groups.map((g) => ({ mat: mats[g.materialIndex ?? 0]!, geo: sliceGeometry(src, g.start, g.count) }))
      : [{ mat: mats[0]!, geo: src }];
    for (const { mat, geo } of pieces) {
      const key = mat.name.trim().toLowerCase() === 'world' ? null : mat;
      // keep only what every material path needs, so parts merge cleanly
      for (const a of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(a)) geo.deleteAttribute(a);
      let arr = byMat.get(key); if (!arr) byMat.set(key, arr = []); arr.push(geo);
    }
  });
  if (!byMat.size) return null;
  const box = new THREE.Box3();
  for (const geos of byMat.values()) for (const g of geos) { g.computeBoundingBox(); box.union(g.boundingBox!); }
  const size = box.getSize(new THREE.Vector3());
  if (size.x <= 0 || size.y <= 0 || size.z <= 0) return null;
  const parts: KitPart[] = [];
  for (const [mat, geos] of byMat) {
    const uvs = geos.every((g) => g.attributes.uv);
    if (!uvs) for (const g of geos) g.deleteAttribute('uv');
    const geometry = geos.length === 1 ? geos[0]! : mergeNonIndexed(geos);
    geometry.translate(-box.min.x, -box.min.y, -box.min.z);
    // world materials are vertex-coloured (per-box tint); a white colour attribute keeps them neutral
    const n = geometry.attributes.position!.count;
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
    geometry.computeBoundingSphere();
    parts.push({ geometry, material: mat });
  }
  return { id, parts, size };
}

function sliceGeometry(g: THREE.BufferGeometry, start: number, count: number): THREE.BufferGeometry {
  const out = new THREE.BufferGeometry();
  for (const [k, a] of Object.entries(g.attributes)) {
    const attr = a as THREE.BufferAttribute;
    out.setAttribute(k, new THREE.BufferAttribute((attr.array as Float32Array).slice(start * attr.itemSize, (start + count) * attr.itemSize), attr.itemSize));
  }
  return out;
}

function mergeNonIndexed(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const out = new THREE.BufferGeometry();
  for (const k of Object.keys(geos[0]!.attributes)) {
    const size = (geos[0]!.attributes[k] as THREE.BufferAttribute).itemSize;
    const total = geos.reduce((a, g) => a + g.attributes[k]!.count * size, 0);
    const arr = new Float32Array(total); let o = 0;
    for (const g of geos) { const src = g.attributes[k]!.array as Float32Array; arr.set(src, o); o += src.length; }
    out.setAttribute(k, new THREE.BufferAttribute(arr, size));
  }
  return out;
}

/**
 * At boot, load every kit piece present in public/assets/kit/. Missing files are the normal case
 * (one HEAD request each). `?kit=0` turns the kit off for comparison.
 */
export async function loadKit(): Promise<string[]> {
  if (new URLSearchParams(location.search).get('kit') === '0') return [];
  const loader = new GLTFLoader();
  const found: string[] = [];
  await Promise.all(KIT_PIECES.map(async (p) => {
    const url = `${DIR}${p.id}.glb`;
    try {
      const r = await fetch(url, { method: 'HEAD' });
      if (!r.ok || (r.headers.get('content-type') ?? '').includes('html')) return;
      const gltf = await loader.loadAsync(url);
      const piece = bake(gltf.scene, p.id);
      if (!piece) return;
      for (const part of piece.parts) {
        if (part.material && 'map' in part.material) {
          const m = part.material as THREE.MeshStandardMaterial;
          for (const t of [m.map, m.normalMap, m.roughnessMap, m.metalnessMap, m.aoMap]) if (t) t.anisotropy = 8;
        }
      }
      loaded.set(p.id, piece);
      found.push(p.id);
    } catch { /* stays a box */ }
  }));
  return found;
}
