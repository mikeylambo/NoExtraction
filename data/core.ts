/** Core Stability by chapter — GDD §4. Values are percentages. */
export interface WorldLook {
  sky: [number, number];
  fog: number;
  fogNear: number;
  fogFar: number;
  aurora: number;
  snow: number;
  /** Seconds between ambient tremors (0 = none). */
  tremorEvery: number;
  tremorStrength: number;
  debrisStreaks: number;
  coreGlow: number;
  sun: number;
  ambient: number;
  wind: number;
  flicker: number;
}

export interface CoreState { pct: number; label: string; look: WorldLook }

export const CORE_STATES: CoreState[] = [
  { pct: 72, label: 'Clear night, light aurora, distant tremors', look: { sky: [0x0a1626, 0x24405e], fog: 0x1a2a3c, fogNear: 60, fogFar: 340, aurora: 0.45, snow: 0.15, tremorEvery: 55, tremorStrength: 0.05, debrisStreaks: 0, coreGlow: 0, sun: 0.9, ambient: 0.55, wind: 0.2, flicker: 0 } },
  { pct: 58, label: 'First major quake, fissures, sky flicker', look: { sky: [0x0c1424, 0x31385a], fog: 0x1e2838, fogNear: 50, fogFar: 300, aurora: 0.6, snow: 0.3, tremorEvery: 32, tremorStrength: 0.1, debrisStreaks: 0.1, coreGlow: 0.05, sun: 0.8, ambient: 0.5, wind: 0.35, flicker: 0.35 } },
  { pct: 41, label: 'Snowstorm bands, collapsing structures, orbital debris streaks', look: { sky: [0x111821, 0x3c4656], fog: 0x37414e, fogNear: 22, fogFar: 170, aurora: 0.35, snow: 1, tremorEvery: 24, tremorStrength: 0.14, debrisStreaks: 0.6, coreGlow: 0.12, sun: 0.55, ambient: 0.5, wind: 0.9, flicker: 0.2 } },
  { pct: 24, label: 'Subsurface water surging, violet core glow through the ice', look: { sky: [0x06060e, 0x1a1530], fog: 0x0a0a16, fogNear: 10, fogFar: 90, aurora: 0, snow: 0.05, tremorEvery: 18, tremorStrength: 0.16, debrisStreaks: 0, coreGlow: 0.85, sun: 0.08, ambient: 0.12, wind: 0.1, flicker: 0.15 } },
  { pct: 11, label: 'Ice shelf breakup, cryovolcanic plumes, magnetic storms', look: { sky: [0x140c1c, 0x5a3a66], fog: 0x2a2234, fogNear: 120, fogFar: 1500, aurora: 1, snow: 0.45, tremorEvery: 14, tremorStrength: 0.22, debrisStreaks: 0.8, coreGlow: 0.5, sun: 0.6, ambient: 0.5, wind: 0.7, flicker: 0.5 } },
  { pct: 2, label: 'The planet breaks', look: { sky: [0x0c0814, 0x3a2452], fog: 0x3a2030, fogNear: 200, fogFar: 3000, aurora: 1, snow: 0.2, tremorEvery: 6, tremorStrength: 0.35, debrisStreaks: 1, coreGlow: 1, sun: 0.7, ambient: 0.6, wind: 1, flicker: 0.8 } },
  { pct: 0, label: 'The planet breaks', look: { sky: [0x000000, 0x0a0a14], fog: 0x000000, fogNear: 400, fogFar: 9000, aurora: 0, snow: 0, tremorEvery: 0, tremorStrength: 0, debrisStreaks: 0, coreGlow: 1, sun: 1, ambient: 0.3, wind: 0, flicker: 0 } },
];

export const CHAPTER_CORE: Record<string, number> = { ch1: 72, ch2: 58, ch3: 41, ch4: 24, ch5: 11, ch6: 2 };

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpHex = (a: number, b: number, t: number) => {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255, br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (Math.round(lerp(ar, br, t)) << 16) | (Math.round(lerp(ag, bg, t)) << 8) | Math.round(lerp(ab, bb, t));
};

/** World look for any stability value (dev scrub 72 → 0 interpolates between authored states). */
export function lookFor(pct: number): WorldLook {
  const s = CORE_STATES;
  if (pct >= s[0]!.pct) return s[0]!.look;
  for (let i = 0; i < s.length - 1; i++) {
    const a = s[i]!, b = s[i + 1]!;
    if (pct <= a.pct && pct >= b.pct) {
      const t = (a.pct - pct) / Math.max(1e-6, a.pct - b.pct);
      const A = a.look, B = b.look;
      return {
        sky: [lerpHex(A.sky[0], B.sky[0], t), lerpHex(A.sky[1], B.sky[1], t)], fog: lerpHex(A.fog, B.fog, t),
        fogNear: lerp(A.fogNear, B.fogNear, t), fogFar: lerp(A.fogFar, B.fogFar, t), aurora: lerp(A.aurora, B.aurora, t), snow: lerp(A.snow, B.snow, t),
        tremorEvery: lerp(A.tremorEvery || 60, B.tremorEvery || 60, t), tremorStrength: lerp(A.tremorStrength, B.tremorStrength, t), debrisStreaks: lerp(A.debrisStreaks, B.debrisStreaks, t),
        coreGlow: lerp(A.coreGlow, B.coreGlow, t), sun: lerp(A.sun, B.sun, t), ambient: lerp(A.ambient, B.ambient, t), wind: lerp(A.wind, B.wind, t), flicker: lerp(A.flicker, B.flicker, t),
      };
    }
  }
  return s[s.length - 1]!.look;
}
