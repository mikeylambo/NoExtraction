import * as THREE from 'three';
import { PALETTE } from '../../data/palette';
import { surface, type SurfaceId } from '../render/surfaces';

/** Uniforms shared by every world material (visor scan wave, snow cover, core glow, darkness). */
export const WORLD_UNIFORMS = {
  uScanOrigin: { value: new THREE.Vector3() },
  uScanRadius: { value: -100 },
  uScanStrength: { value: 0 },
  uScanColor: { value: new THREE.Color(PALETTE.cyan) },
  uSnowAmount: { value: 0.75 },
  uSnowColor: { value: new THREE.Color(PALETTE.snow) },
  uCoreGlow: { value: 0 },
  uCoreColor: { value: new THREE.Color(PALETTE.violetDeep) },
  uTime: { value: 0 },
};

export type MatKey =
  | 'snow' | 'drift' | 'ice' | 'rock' | 'concrete' | 'metal' | 'metalDark' | 'sable' | 'halcyon' | 'crate' | 'iceWall'
  | 'water' | 'grate' | 'glowCyan' | 'glowAmber' | 'glowRed' | 'glowViolet' | 'glowWhite' | 'black' | 'canvas' | 'hazard';

interface MatSpec { color: number; rough: number; metal: number; snow: number; emissive?: number; emissiveIntensity?: number; transparent?: boolean; opacity?: number; core?: number; surface?: SurfaceId; sparkle?: number }

const SPECS: Record<MatKey, MatSpec> = {
  snow: { color: 0xdfe7ee, rough: 0.92, metal: 0, snow: 0, surface: 'snow', sparkle: 1 },
  drift: { color: 0xf2f6fa, rough: 0.98, metal: 0, snow: 0, surface: 'snow', sparkle: 1 },
  ice: { color: 0x9fb8cc, rough: 0.25, metal: 0.05, snow: 0.3, core: 1, surface: 'ice' },
  rock: { color: 0x4a5560, rough: 0.95, metal: 0, snow: 1, surface: 'rock' },
  concrete: { color: 0x7d868e, rough: 0.9, metal: 0, snow: 1, surface: 'concrete' },
  metal: { color: 0x8a949d, rough: 0.5, metal: 0.6, snow: 0.8, surface: 'paint' },
  metalDark: { color: 0x2c333a, rough: 0.55, metal: 0.55, snow: 0.8, surface: 'rust' },
  sable: { color: 0x3b4148, rough: 0.6, metal: 0.4, snow: 0.9, surface: 'paint' },
  halcyon: { color: 0xc9d1d8, rough: 0.45, metal: 0.3, snow: 0.9, surface: 'paint' },
  crate: { color: 0x59626b, rough: 0.8, metal: 0.2, snow: 1, surface: 'corrugated' },
  iceWall: { color: 0xa9d4ee, rough: 0.1, metal: 0, snow: 0.2, transparent: true, opacity: 0.38, core: 1, surface: 'ice' },
  water: { color: 0x0d2a3a, rough: 0.08, metal: 0.2, snow: 0, transparent: true, opacity: 0.82, core: 1.5 },
  grate: { color: 0x555d65, rough: 0.6, metal: 0.7, snow: 0.3, surface: 'grate' },
  glowCyan: { color: 0x0a2a33, rough: 0.4, metal: 0, snow: 0, emissive: PALETTE.cyan, emissiveIntensity: 2.2 },
  glowAmber: { color: 0x2a1a00, rough: 0.4, metal: 0, snow: 0, emissive: PALETTE.amber, emissiveIntensity: 2.4 },
  glowRed: { color: 0x2a0004, rough: 0.4, metal: 0, snow: 0, emissive: PALETTE.red, emissiveIntensity: 2.4 },
  glowViolet: { color: 0x150a2a, rough: 0.4, metal: 0, snow: 0, emissive: PALETTE.violet, emissiveIntensity: 2.0 },
  glowWhite: { color: 0x222428, rough: 0.4, metal: 0, snow: 0, emissive: 0xeef4ff, emissiveIntensity: 1.6 },
  black: { color: 0x07090b, rough: 0.9, metal: 0, snow: 0 },
  canvas: { color: 0x6f6a5e, rough: 0.95, metal: 0, snow: 1, surface: 'concrete' },
  hazard: { color: 0x6b6e70, rough: 0.7, metal: 0.3, snow: 0.6, surface: 'paint' },
};

const cache = new Map<string, THREE.Material>();

/**
 * Patch a standard material with world-space varyings for the scan wave, snow cover and core glow,
 * plus surface detail from the surface library (src/render/surfaces.ts). Level geometry is
 * axis-aligned boxes without UVs, so detail is projected along the face's dominant world axis
 * (exact for boxes, one texture fetch per map).
 */
export function patchWorld(m: THREE.MeshStandardMaterial, snow: number, core: number, surf?: SurfaceId, sparkle = 0): void {
  const det = surf ? surface(surf) : null;
  const cover = surface('snow');
  const detail = det ? {
    uDetMap: { value: det.set.map }, uDetNor: { value: det.set.normalMap }, uDetOrm: { value: det.set.orm },
    uDetTile: { value: det.tile }, uDetGreen: { value: det.green }, uDetLum: { value: det.set.lum }, uDetRough: { value: det.set.rough }, uDetNormalK: { value: det.normal }, uDetAlbK: { value: det.albedo },
    uCoverMap: { value: cover.set.map }, uCoverLum: { value: cover.set.lum }, uCoverTile: { value: cover.tile },
  } : {};
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, WORLD_UNIFORMS, { uMatSnow: { value: snow }, uMatCore: { value: core }, uMatSparkle: { value: sparkle } }, detail);
    if (det) shader.defines = { ...shader.defines, USE_DETAIL: '' };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos; varying vec3 vWNorm;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz; vWNorm = normalize(mat3(modelMatrix) * objectNormal);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vWPos; varying vec3 vWNorm;
uniform vec3 uScanOrigin; uniform float uScanRadius; uniform float uScanStrength; uniform vec3 uScanColor;
uniform float uSnowAmount; uniform vec3 uSnowColor; uniform float uCoreGlow; uniform vec3 uCoreColor; uniform float uTime;
uniform float uMatSnow; uniform float uMatCore; uniform float uMatSparkle;
#ifdef USE_DETAIL
uniform sampler2D uDetMap; uniform sampler2D uDetNor; uniform sampler2D uDetOrm; uniform sampler2D uCoverMap;
uniform float uDetTile; uniform float uDetGreen; uniform float uDetLum; uniform float uDetRough; uniform float uDetNormalK; uniform float uDetAlbK; uniform float uCoverLum; uniform float uCoverTile;
#endif`)
      .replace('#include <color_fragment>', `#include <color_fragment>
float snowK = smoothstep(0.55, 0.9, vWNorm.y) * uSnowAmount * uMatSnow;
#ifdef USE_DETAIL
vec3 an = abs(vWNorm); vec2 dUv; vec3 dT; vec3 dB;
if (an.y >= an.x && an.y >= an.z) { dUv = vWPos.xz; dT = vec3(1.0, 0.0, 0.0); dB = vec3(0.0, 0.0, 1.0); }
else if (an.x >= an.z) { dUv = vec2(vWPos.z, -vWPos.y); dT = vec3(0.0, 0.0, 1.0); dB = vec3(0.0, -1.0, 0.0); }
else { dUv = vec2(vWPos.x, -vWPos.y); dT = vec3(1.0, 0.0, 0.0); dB = vec3(0.0, -1.0, 0.0); }
dUv /= uDetTile;
vec4 dAlb = texture2D(uDetMap, dUv); vec4 dOrm = texture2D(uDetOrm, dUv);
diffuseColor.rgb *= mix(vec3(1.0), dAlb.rgb / max(uDetLum, 0.02), uDetAlbK) * mix(1.0, dOrm.r, 0.45);
vec3 coverAlb = texture2D(uCoverMap, vWPos.xz / uCoverTile).rgb / max(uCoverLum, 0.02);
diffuseColor.rgb = mix(diffuseColor.rgb, uSnowColor * coverAlb, snowK);
#else
diffuseColor.rgb = mix(diffuseColor.rgb, uSnowColor, snowK);
#endif`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
#ifdef USE_DETAIL
roughnessFactor = mix(clamp(roughnessFactor + dOrm.g - uDetRough, 0.04, 1.0), 0.85, snowK);
#endif`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
#ifdef USE_DETAIL
metalnessFactor = max(metalnessFactor, dOrm.b) * (1.0 - snowK);
#endif`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
#ifdef USE_DETAIL
{
  vec3 dn = texture2D(uDetNor, dUv).xyz * 2.0 - 1.0; dn.y *= uDetGreen;
  vec3 wN = normalize(normalize(vWNorm) + (dT * dn.x + dB * dn.y) * uDetNormalK * (1.0 - snowK * 0.6));
  normal = normalize((viewMatrix * vec4(wN, 0.0)).xyz);
}
#endif`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
float sd = distance(vWPos, uScanOrigin);
float band = exp(-pow((sd - uScanRadius) / 1.4, 2.0)) * uScanStrength;
float trail = smoothstep(uScanRadius, uScanRadius - 9.0, sd) * step(sd, uScanRadius) * uScanStrength * 0.18;
vec3 fw = fwidth(vWPos);
float grid = (1.0 - smoothstep(0.0, 0.06, min(min(abs(fract(vWPos.x * 0.5) - 0.5), abs(fract(vWPos.z * 0.5) - 0.5)), abs(fract(vWPos.y * 0.5) - 0.5)))) * trail;
totalEmissiveRadiance += uScanColor * (band * 0.9 + grid * 1.2);
float coreK = uCoreGlow * uMatCore * (0.55 + 0.45 * sin(uTime * 0.7 + vWPos.x * 0.05 + vWPos.z * 0.04));
totalEmissiveRadiance += uCoreColor * coreK * 0.6;`)
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
{
  // snow glints: view-dependent cells, only near the camera
  float glintK = max(uMatSparkle, snowK);
  if (glintK > 0.01) {
    vec3 vd = normalize(cameraPosition - vWPos);
    vec3 cell = floor(vWPos * 28.0) + floor(vd * 14.0);
    float hs = fract(sin(dot(cell, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
    float glint = step(0.9975, hs) * (1.0 - smoothstep(4.0, 30.0, length(vWPos - cameraPosition))) * glintK;
    gl_FragColor.rgb += vec3(0.9, 0.95, 1.0) * glint * 1.6 * (0.3 + dot(gl_FragColor.rgb, vec3(0.33)) * 2.0);
  }
}`);
  };
  m.customProgramCacheKey = () => `world-${det ? 'detail' : 'flat'}`;
}

export function worldMat(key: MatKey): THREE.Material {
  const hit = cache.get(key); if (hit) return hit;
  const s = SPECS[key];
  const m = new THREE.MeshStandardMaterial({
    color: s.color, roughness: s.rough, metalness: s.metal,
    emissive: s.emissive ?? 0x000000, emissiveIntensity: s.emissiveIntensity ?? 1,
    transparent: !!s.transparent, opacity: s.opacity ?? 1, depthWrite: !s.transparent,
    vertexColors: true,
  });
  if (!s.emissive) patchWorld(m, s.snow, s.core ?? 0, s.surface, s.sparkle ?? 0);
  cache.set(key, m);
  return m;
}

export function isTransparent(key: MatKey): boolean { return !!SPECS[key].transparent; }

/** Additive glow sprite texture (radial). */
let glowTex: THREE.Texture | null = null;
export function glowTexture(): THREE.Texture {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.25, 'rgba(255,255,255,0.55)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}

export function glowSprite(color: number, size: number, opacity = 0.8): THREE.Sprite {
  const m = new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: true });
  const s = new THREE.Sprite(m); s.scale.setScalar(size); return s;
}
