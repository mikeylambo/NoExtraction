import * as THREE from 'three';

/**
 * Render quality tier. `low` targets integrated GPUs (Intel UHD/Iris, e.g. a 2019 16" MacBook Pro
 * running on its UHD 630): 1× pixel ratio, 70% post resolution, no GTAO, 1024 shadows, half-size
 * surface textures. `high` is the lookdev target.
 *
 * Chosen once at boot: `?q=low|high` wins, then the saved option, then the GPU string.
 */
export type QualityTier = 'low' | 'high';
export type QualityChoice = 'auto' | QualityTier;

let tier: QualityTier = 'high';
let gpu = 'unknown';

/** The GPU the browser actually gave WebGL (on dual-GPU Macs this shows which one is in use). */
export function detectGpu(renderer: THREE.WebGLRenderer): string {
  const gl = renderer.getContext();
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  gpu = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
  return gpu;
}

export function autoTier(gpuName: string): QualityTier {
  const g = gpuName.toLowerCase();
  if (/swiftshader|llvmpipe|software/.test(g)) return 'low';
  // integrated Intel parts (UHD 6xx, Iris, HD) and low-end mobile GPUs
  if (/intel|mali|adreno [1-6]\d\d\b|powervr/.test(g) && !/arc/.test(g)) return 'low';
  return 'high';
}

export function resolveTier(choice: QualityChoice, renderer: THREE.WebGLRenderer): QualityTier {
  const q = new URLSearchParams(location.search).get('q');
  if (q === 'low' || q === 'high') return (tier = q);
  if (choice !== 'auto') return (tier = choice);
  return (tier = autoTier(detectGpu(renderer)));
}

export function quality(): QualityTier { return tier; }
export function gpuName(): string { return gpu; }

/** Settings that follow the tier. */
export function tierSettings(t: QualityTier = tier) {
  return t === 'high'
    ? { maxPixelRatio: 1.5, post: 'high' as const, gtao: true, shadowMap: 2048, textureSize: 512 }
    : { maxPixelRatio: 1, post: 'low' as const, gtao: false, shadowMap: 1024, textureSize: 256 };
}
