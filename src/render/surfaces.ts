import * as THREE from 'three';
import { snowSet, packedSnowSet, concreteSet, paintedMetalSet, rockSet, iceSet, grateSet, type PbrSet } from './textures';
import { tierSettings } from './quality';
import type { SurfaceSlot } from '../../assets/manifest';

/**
 * Surface library: the one place world materials get their texture detail from.
 *
 * Every surface is a tileable PBR set (albedo, normal, ORM) plus how many metres one tile covers.
 * By default the sets are generated in code (src/render/textures.ts). A scanned set (Megascans etc.)
 * packed into public/surfaces/ replaces the generated one at boot (src/render/scans.ts, slots in
 * assets/manifest.ts SURFACES). Albedo is used as detail around each material's own colour (divided
 * by `lum`), so a scan's absolute colour does not have to match the palette.
 */
export type SurfaceId = SurfaceSlot;

/** `green`: +1 for the generated sets, −1 for image scans (OpenGL normals under this projection). */
export interface Surface { set: PbrSet; tile: number; normal: number; albedo: number; green: number }

const TILE: Record<SurfaceId, { tile: number; normal: number; albedo: number }> = {
  snow: { tile: 7, normal: 0.9, albedo: 0.6 },
  packedSnow: { tile: 4, normal: 0.8, albedo: 0.7 },
  concrete: { tile: 4, normal: 0.8, albedo: 0.9 },
  paint: { tile: 2.5, normal: 0.6, albedo: 0.85 },
  rock: { tile: 5, normal: 1.2, albedo: 0.9 },
  ice: { tile: 6, normal: 0.5, albedo: 0.6 },
  grate: { tile: 2, normal: 1.0, albedo: 1 },
  corrugated: { tile: 2.5, normal: 0.6, albedo: 0.85 },
  rust: { tile: 2.5, normal: 0.6, albedo: 0.85 },
};

const cache = new Map<SurfaceId, Surface>();

/** Slots that only exist for scans; without one they share another surface's generated set. */
const SHARES: Partial<Record<SurfaceId, SurfaceId>> = { corrugated: 'paint', rust: 'paint' };

function make(id: Exclude<SurfaceId, 'corrugated' | 'rust'>, size: number): PbrSet {
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
  const shared = SHARES[id];
  if (!s && shared) { s = surface(shared); cache.set(id, s); }
  if (!s) {
    const set = make(id as Exclude<SurfaceId, 'corrugated' | 'rust'>, tierSettings().textureSize);
    for (const t of [set.map, set.normalMap, set.orm]) t.repeat.set(1, 1);
    s = { set, ...TILE[id], green: 1 };
    cache.set(id, s);
  }
  return s;
}

/**
 * Use a scanned set for `id` instead of the generated one. Call before any world material is
 * created (App boot does, before the first level). Unset tuning falls back to the generated defaults.
 */
export function useScan(id: SurfaceId, set: PbrSet, tune: { tile?: number; normal?: number; albedo?: number } = {}): void {
  const d = TILE[id];
  cache.set(id, { set, tile: tune.tile ?? d.tile, normal: tune.normal ?? d.normal, albedo: tune.albedo ?? d.albedo, green: -1 });
}

/** Placeholder 1×1 texture for materials without detail. */
let blank: THREE.Texture | null = null;
export function blankTexture(): THREE.Texture {
  if (!blank) { blank = new THREE.DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1); blank.needsUpdate = true; }
  return blank;
}
