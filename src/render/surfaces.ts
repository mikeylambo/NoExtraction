import * as THREE from 'three';
import { snowSet, packedSnowSet, concreteSet, paintedMetalSet, rockSet, iceSet, grateSet, type PbrSet } from './textures';
import { tierSettings } from './quality';

/**
 * Surface library: the one place world materials get their texture detail from.
 *
 * Every surface is a tileable PBR set (albedo, normal, ORM) plus how many metres one tile covers.
 * Today the sets are generated in code (src/render/textures.ts). To swap in a scanned material
 * (Megascans etc.), load its maps into a PbrSet and return it from `surface()` for that id; nothing
 * else changes. Albedo is used as detail around each material's own colour (divided by `lum`), so
 * a scan's absolute colour does not have to match the palette.
 */
export type SurfaceId = 'snow' | 'packedSnow' | 'concrete' | 'paint' | 'rock' | 'ice' | 'grate';

export interface Surface { set: PbrSet; tile: number; normal: number; albedo: number }

const TILE: Record<SurfaceId, { tile: number; normal: number; albedo: number }> = {
  snow: { tile: 7, normal: 0.9, albedo: 0.6 },
  packedSnow: { tile: 4, normal: 0.8, albedo: 0.7 },
  concrete: { tile: 4, normal: 0.8, albedo: 0.9 },
  paint: { tile: 2.5, normal: 0.6, albedo: 0.85 },
  rock: { tile: 5, normal: 1.2, albedo: 0.9 },
  ice: { tile: 6, normal: 0.5, albedo: 0.6 },
  grate: { tile: 2, normal: 1.0, albedo: 1 },
};

const cache = new Map<SurfaceId, Surface>();

function make(id: SurfaceId, size: number): PbrSet {
  switch (id) {
    case 'snow': return snowSet(1, size);
    case 'packedSnow': return packedSnowSet(1);
    case 'concrete': return concreteSet(1, size);
    case 'paint': return paintedMetalSet([0.42, 0.43, 0.44], 1, 5, size);
    case 'rock': return rockSet(1, size);
    case 'ice': return iceSet(1, size);
    case 'grate': return grateSet(1);
  }
}

export function surface(id: SurfaceId): Surface {
  let s = cache.get(id);
  if (!s) {
    const set = make(id, tierSettings().textureSize);
    for (const t of [set.map, set.normalMap, set.orm]) t.repeat.set(1, 1);
    s = { set, ...TILE[id] };
    cache.set(id, s);
  }
  return s;
}

/** Placeholder 1×1 texture for materials without detail. */
let blank: THREE.Texture | null = null;
export function blankTexture(): THREE.Texture {
  if (!blank) { blank = new THREE.DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1); blank.needsUpdate = true; }
  return blank;
}
