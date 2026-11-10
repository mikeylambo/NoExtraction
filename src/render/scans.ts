import * as THREE from 'three';
import { SURFACES } from '../../assets/manifest';
import { useScan } from './surfaces';
import type { PbrSet } from './textures';
import type { QualityTier } from './quality';

const DIR = `${import.meta.env?.BASE_URL ?? "/"}surfaces/`;

/** Fetch an image as an ImageBitmap (optionally at half size); null when missing. */
export async function fetchImage(url: string, half: boolean): Promise<ImageBitmap | null> {
  try {
    const r = await fetch(url);
    if (!r.ok || (r.headers.get('content-type') ?? '').includes('html')) return null;
    const blob = await r.blob();
    // Upright under the world projection (texture v runs down the wall), so no flip.
    const full = await createImageBitmap(blob, { imageOrientation: 'from-image', colorSpaceConversion: 'none' });
    if (!half) return full;
    const small = await createImageBitmap(full, { resizeWidth: Math.max(1, full.width >> 1), resizeHeight: Math.max(1, full.height >> 1), resizeQuality: 'high' });
    full.close();
    return small;
  } catch { return null; }
}

function setup<T extends THREE.Texture>(t: T, srgb: boolean): T {
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.flipY = false;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8; // clamped to the GPU's maximum by the renderer
  t.needsUpdate = true;
  return t;
}
/** Repeat-wrapped, mipmapped, unflipped texture from a bitmap. */
export const texture = (img: ImageBitmap, srgb: boolean) => {
  const t = setup(new THREE.Texture(img), srgb);
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
};

/** Flat 1×1 map: a neutral normal, or an ORM with AO 1, roughness 0.5, metal 0. */
const solid = (r: number, g: number, b: number) => setup(new THREE.DataTexture(new Uint8Array([r, g, b, 255]), 1, 1), false);

/** Mean of a channel expression over a 32×32 downsample (PbrSet.lum / .rough are means). */
export function mean(img: ImageBitmap, f: (r: number, g: number, b: number) => number): number {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(img, 0, 0, 32, 32);
  const d = g.getImageData(0, 0, 32, 32).data;
  let sum = 0;
  for (let i = 0; i < d.length; i += 4) sum += f(d[i]! / 255, d[i + 1]! / 255, d[i + 2]! / 255);
  return sum / (d.length / 4);
}

/**
 * At boot, look for packed scans in public/surfaces/ for each manifest slot and hand them to the
 * surface library. Missing files are the normal case (the slot stays procedural); each costs one
 * request. The low tier loads scans at half size. Must run before the first level is built.
 */
export async function loadSurfaceScans(tier: QualityTier): Promise<string[]> {
  if (new URLSearchParams(location.search).get('scans') === '0') return []; // A/B: procedural only
  const half = tier === 'low';
  const found: string[] = [];
  await Promise.all(SURFACES.map(async (s) => {
    const base = await fetchImage(`${DIR}${s.id}_basecolor.webp`, half);
    if (!base) return;
    const [nor, orm] = await Promise.all([
      fetchImage(`${DIR}${s.id}_normal.webp`, half),
      fetchImage(`${DIR}${s.id}_orm.webp`, half),
    ]);
    const rough = orm ? mean(orm, (_r, g) => g) : 128 / 255;
    const set: PbrSet = {
      map: texture(base, true),
      normalMap: nor ? texture(nor, false) : solid(128, 128, 255),
      orm: orm ? texture(orm, false) : solid(255, 128, 0),
      lum: mean(base, (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b),
      rough,
    };
    useScan(s.id, set, { tile: s.tile, normal: s.normal, albedo: s.albedo });
    found.push(`${s.id}${nor ? '+n' : ''}${orm ? '+orm' : ''}`);
  }));
  return found;
}
