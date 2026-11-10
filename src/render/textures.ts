import * as THREE from 'three';

/**
 * Procedural PBR texture sets, shared by the lookdev scene and the game's world materials. Everything is tileable and generated at boot
 * (no texture downloads): albedo (sRGB), normal (from a height field), and ORM (R = AO, G = rough,
 * B = metal — the glTF packing, so authored assets drop into the same slots).
 */

// ---- tileable value noise -------------------------------------------------------------------
function hash(x: number, y: number, s: number): number {
  let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function vnoise(x: number, y: number, period: number, seed: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const w = (a: number) => ((a % period) + period) % period;
  const a = hash(w(xi), w(yi), seed), b = hash(w(xi + 1), w(yi), seed);
  const c = hash(w(xi), w(yi + 1), seed), d = hash(w(xi + 1), w(yi + 1), seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
/** fbm in [0,1], tileable over the unit square. */
export function fbm(u: number, v: number, base: number, oct: number, seed: number, gain = 0.5): number {
  let sum = 0, amp = 1, norm = 0, f = base;
  for (let o = 0; o < oct; o++) { sum += vnoise(u * f, v * f, f, seed + o * 17) * amp; norm += amp; amp *= gain; f *= 2; }
  return sum / norm;
}

/** `lum` and `rough` are the set's mean albedo luminance and roughness, so world materials can use it as detail around their own values. */
export interface PbrSet { map: THREE.Texture; normalMap: THREE.Texture; orm: THREE.Texture; lum: number; rough: number }

type Gen = (u: number, v: number) => { h: number; r: number; g: number; b: number; ao: number; rough: number; metal: number };

function build(size: number, gen: Gen, normalStrength: number, repeat: number): PbrSet {
  const n = size * size;
  const h = new Float32Array(n);
  const alb = new Uint8Array(n * 4), orm = new Uint8Array(n * 4), nor = new Uint8Array(n * 4);
  let lum = 0, rough = 0;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x; const s = gen(x / size, y / size);
    h[i] = s.h; lum += 0.2126 * s.r + 0.7152 * s.g + 0.0722 * s.b; rough += s.rough;
    alb[i * 4] = clamp255(s.r); alb[i * 4 + 1] = clamp255(s.g); alb[i * 4 + 2] = clamp255(s.b); alb[i * 4 + 3] = 255;
    orm[i * 4] = clamp255(s.ao); orm[i * 4 + 1] = clamp255(s.rough); orm[i * 4 + 2] = clamp255(s.metal); orm[i * 4 + 3] = 255;
  }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const at = (xx: number, yy: number) => h[((yy + size) % size) * size + ((xx + size) % size)];
    const dx = (at(x + 1, y) - at(x - 1, y)) * normalStrength, dy = (at(x, y + 1) - at(x, y - 1)) * normalStrength;
    const l = Math.hypot(dx, dy, 1); const i = (y * size + x) * 4;
    nor[i] = ((-dx / l) * 0.5 + 0.5) * 255; nor[i + 1] = ((dy / l) * 0.5 + 0.5) * 255; nor[i + 2] = ((1 / l) * 0.5 + 0.5) * 255; nor[i + 3] = 255;
  }
  const tex = (d: Uint8Array, srgb: boolean) => {
    const t = new THREE.DataTexture(d, size, size, THREE.RGBAFormat);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat);
    t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
    t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return t;
  };
  return { map: tex(alb, true), normalMap: tex(nor, false), orm: tex(orm, false), lum: lum / n, rough: rough / n };
}
const clamp255 = (v: number) => Math.max(0, Math.min(255, v * 255));
const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Wind-packed snow: sastrugi ripples, crust breaks, fine grain. */
export function snowSet(repeat: number, size = 512): PbrSet {
  return build(size, (u, v) => {
    const ripple = Math.sin((u * 9 + fbm(u, v, 3, 3, 4) * 2.2) * Math.PI * 2) * 0.5 + 0.5;
    const crust = fbm(u, v, 6, 4, 9);
    const grain = fbm(u, v, 64, 2, 21);
    const h = ripple * 0.35 + crust * 0.5 + grain * 0.15;
    const tint = 0.86 + crust * 0.1 + grain * 0.04;
    return { h, r: tint * 0.92, g: tint * 0.95, b: tint, ao: 0.75 + h * 0.25, rough: 0.72 + grain * 0.2 - ripple * 0.1, metal: 0 };
  }, 3.2, repeat);
}

/** Trodden snow along the patrol path: compacted, greyer, boot-scuffed. */
export function packedSnowSet(repeat: number): PbrSet {
  return build(256, (u, v) => {
    const scuff = fbm(u, v, 8, 4, 33); const grain = fbm(u, v, 32, 2, 41);
    const h = scuff * 0.7 + grain * 0.3; const t = 0.62 + scuff * 0.18;
    return { h, r: t * 0.9, g: t * 0.93, b: t * 0.98, ao: 0.7 + h * 0.3, rough: 0.5 + grain * 0.3, metal: 0 };
  }, 4, repeat);
}

/** Cast concrete: formwork panel seams, tie holes, rain streaks, grime pooling low. */
export function concreteSet(repeat: number, size = 512): PbrSet {
  return build(size, (u, v) => {
    const base = fbm(u, v, 4, 5, 51); const pits = fbm(u, v, 48, 2, 57);
    const seamU = Math.min((u * 2) % 1, 1 - ((u * 2) % 1)), seamV = Math.min((v * 4) % 1, 1 - ((v * 4) % 1));
    const seam = 1 - smooth(0, 0.012, Math.min(seamU, seamV));
    const tu = (u * 4) % 1 - 0.5, tv = (v * 8) % 1 - 0.5; const tie = 1 - smooth(0.02, 0.035, Math.hypot(tu * 0.5, tv));
    const streak = fbm(u * 0.15, v * 0.0 + u * 7, 6, 3, 61) * fbm(u, v, 2, 2, 63); // vertical rain streaks
    const grime = smooth(0.55, 1, v) * 0.6 + streak * 0.5;
    const h = base * 0.4 + pits * 0.3 - seam * 0.4 - tie * 0.5;
    const c = 0.5 + base * 0.18 - grime * 0.22 - seam * 0.12 - tie * 0.2 + pits * 0.05;
    return { h, r: c * 0.97, g: c * 0.98, b: c, ao: 1 - seam * 0.5 - tie * 0.6 - grime * 0.2, rough: 0.82 + pits * 0.15 - streak * 0.15, metal: 0 };
  }, 2.4, repeat);
}

/** Painted steel with chipped paint over bare/rusted metal and scratches. `paint` is linear-ish RGB. */
export function paintedMetalSet(paint: [number, number, number], repeat: number, seed = 0, size = 512): PbrSet {
  return build(size, (u, v) => {
    const chipN = fbm(u, v, 8, 6, 71 + seed); const edge = fbm(u, v, 20, 3, 79 + seed);
    const chip = smooth(0.66, 0.7, chipN + edge * 0.12);
    const scratch = Math.max(0, 1 - Math.abs(Math.sin((u * 1.7 + v * 0.3 + fbm(u, v, 3, 2, 83 + seed) * 0.4) * 160)) * 25) * smooth(0.5, 0.8, fbm(u, v, 3, 2, 89 + seed));
    const rust = fbm(u, v, 16, 4, 97 + seed); const dirt = smooth(0.6, 1, v) * 0.4 + fbm(u, v, 3, 3, 101 + seed) * 0.2;
    const bare = Math.max(chip, scratch * 0.8);
    const pr = paint[0] * (1 - dirt * 0.5), pg = paint[1] * (1 - dirt * 0.5), pb = paint[2] * (1 - dirt * 0.5);
    const mr = 0.32 + rust * 0.18, mg = 0.24 + rust * 0.08, mb = 0.2;
    return {
      h: (1 - chip) * 0.3 + edge * 0.05, r: pr + (mr - pr) * bare, g: pg + (mg - pg) * bare, b: pb + (mb - pb) * bare,
      ao: 1 - dirt * 0.3, rough: 0.55 + dirt * 0.3 - bare * 0.15 + rust * bare * 0.3, metal: bare * 0.85,
    };
  }, 3, repeat);
}

/** Rough frost-covered rock. */
export function rockSet(repeat: number, size = 512): PbrSet {
  return build(size, (u, v) => {
    const r = fbm(u, v, 4, 6, 111, 0.55); const crack = 1 - smooth(0, 0.04, Math.abs(fbm(u, v, 3, 4, 117) - 0.5));
    const frost = smooth(0.55, 0.75, fbm(u, v, 8, 3, 121));
    const c = 0.2 + r * 0.16 - crack * 0.1;
    const fc = 0.75;
    return { h: r - crack * 0.4, r: c + (fc - c) * frost, g: c + (fc * 1.02 - c) * frost, b: c * 1.06 + (fc * 1.06 - c) * frost, ao: 1 - crack * 0.6, rough: 0.9 - frost * 0.2, metal: 0 };
  }, 4, repeat);
}

/** Shelf ice: smooth, glassy, with long pressure cracks and trapped bubbles. */
export function iceSet(repeat: number, size = 512): PbrSet {
  return build(size, (u, v) => {
    const body = fbm(u, v, 3, 4, 131); const crack = 1 - smooth(0, 0.025, Math.abs(fbm(u, v, 2, 5, 137) - 0.5));
    const bub = smooth(0.78, 0.85, fbm(u, v, 40, 2, 141)); const frost = smooth(0.6, 0.85, fbm(u, v, 6, 3, 149));
    const c = 0.55 + body * 0.15 + bub * 0.15 + frost * 0.2 + crack * 0.12;
    return { h: body * 0.3 - crack * 0.5 + frost * 0.2, r: c * 0.86, g: c * 0.95, b: c, ao: 1 - crack * 0.3, rough: 0.12 + frost * 0.5 + crack * 0.2, metal: 0 };
  }, 2, repeat);
}

/** Steel floor grating: a square bar grid over darkness. */
export function grateSet(repeat: number, size = 256): PbrSet {
  return build(size, (u, v) => {
    const gu = Math.abs(((u * 16) % 1) - 0.5), gv = Math.abs(((v * 16) % 1) - 0.5);
    const bar = Math.max(smooth(0.36, 0.42, gu), smooth(0.36, 0.42, gv)); const wear = fbm(u, v, 8, 3, 151);
    const c = 0.08 + bar * (0.38 + wear * 0.12);
    return { h: bar, r: c, g: c * 1.01, b: c * 1.03, ao: 0.4 + bar * 0.6, rough: 0.5 + wear * 0.3 - bar * 0.1, metal: bar * 0.8 };
  }, 4, repeat);
}

/** Chain-link fence alpha (diamond mesh). */
export function chainLinkTexture(): THREE.Texture {
  const s = 128; const d = new Uint8Array(s * s * 4);
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const u = x / s, v = y / s;
    const a = Math.abs(((u + v) * 2) % 1 - 0.5), b = Math.abs(((u - v + 2) * 2) % 1 - 0.5);
    const wire = Math.max(1 - smooth(0.02, 0.05, a), 1 - smooth(0.02, 0.05, b));
    const i = (y * s + x) * 4; d[i] = d[i + 1] = d[i + 2] = 160; d[i + 3] = wire * 255;
  }
  const t = new THREE.DataTexture(d, s, s); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return t;
}

/** Soft radial sprite for halos and flakes. */
export function radialSprite(size = 64): THREE.Texture {
  const d = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const r = Math.hypot(x / size - 0.5, y / size - 0.5) * 2; const a = Math.max(0, 1 - r); const i = (y * size + x) * 4;
    d[i] = d[i + 1] = d[i + 2] = 255; d[i + 3] = a * a * 255;
  }
  const t = new THREE.DataTexture(d, size, size); t.needsUpdate = true; return t;
}

export function pbrMaterial(set: PbrSet, opts: { color?: number; normalScale?: number; envIntensity?: number; roughnessMul?: number } = {}): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({
    map: set.map, normalMap: set.normalMap, aoMap: set.orm, roughnessMap: set.orm, metalnessMap: set.orm,
    roughness: opts.roughnessMul ?? 1, metalness: 1, color: opts.color ?? 0xffffff,
    normalScale: new THREE.Vector2(opts.normalScale ?? 1, opts.normalScale ?? 1), envMapIntensity: opts.envIntensity ?? 1,
  });
  m.aoMapIntensity = 1;
  return m;
}
