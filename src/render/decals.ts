import * as THREE from 'three';
import { DECAL_TEXTURES } from '../../assets/manifest';
import { patchWorld } from '../world/Materials';
import { fetchImage, texture } from './scans';
import type { QualityTier } from './quality';

const DIR = `${import.meta.env.BASE_URL}decals/`;

/** A loaded decal texture: one material (one draw call per level) plus its sheet layout. */
export interface DecalTex {
  id: string;
  material: THREE.MeshStandardMaterial;
  /** Physical size of the whole texture in metres (packer json), or 1 × 1. */
  size: [number, number];
  atlas: [number, number];
}

const loaded = new Map<string, DecalTex>();

/** The loaded decal texture `id`, or null (no files: decals using it are skipped). */
export function decalTex(id: string): DecalTex | null { return loaded.get(id) ?? null; }

async function meta(id: string): Promise<{ size?: [number, number]; roughness?: number }> {
  try {
    const r = await fetch(`${DIR}${id}.json`);
    if (!r.ok || !(r.headers.get('content-type') ?? '').includes('json')) return {};
    return await r.json();
  } catch { return {}; }
}

/**
 * At boot, load every decal texture packed in public/decals/. Missing files are the normal case
 * (one request each). The low tier loads them at half size. `?decals=0` turns decals off.
 */
export async function loadDecals(tier: QualityTier): Promise<string[]> {
  if (new URLSearchParams(location.search).get('decals') === '0') return [];
  const half = tier === 'low';
  const found: string[] = [];
  await Promise.all(DECAL_TEXTURES.map(async (d) => {
    const color = await fetchImage(`${DIR}${d.id}_color.webp`, half);
    if (!color) return;
    const [nor, info] = await Promise.all([fetchImage(`${DIR}${d.id}_normal.webp`, half), meta(d.id)]);
    const map = texture(color, true);
    map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping;
    const m = new THREE.MeshStandardMaterial({
      map, roughness: info.roughness ?? 0.8, metalness: 0,
      transparent: true, depthWrite: false, alphaTest: 0.02,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4,
      vertexColors: true, // rgba: per-decal tint and opacity
    });
    if (nor) {
      m.normalMap = texture(nor, false); m.normalMap.wrapS = m.normalMap.wrapT = THREE.ClampToEdgeWrapping;
      m.normalScale.set(1, -1); // decal v runs down the image, so an OpenGL (+Y up) map's green is inverted
    }
    m.name = `decal:${d.id}`;
    // snow cover, visor scan and core glow like the surface under it; snow amount per vertex
    patchWorld(m, 1, 0, undefined, 0, true);
    loaded.set(d.id, { id: d.id, material: m, size: info.size ?? [1, 1], atlas: d.atlas ?? [1, 1] });
    found.push(d.id);
  }));
  return found;
}
