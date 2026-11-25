/**
 * Flamingo-07 — GDD §7. Movement, energy and camera feel come from the @slu/mech-frame baseline
 * (AlphaMech); the GDD's energy numbers are recorded as targets in DECISIONS.md. Combat economy
 * (armor, weapons) uses the GDD numbers below.
 */
export const AEGIS = {
  armor: 2400,
  repairStation: 800,
  rifle: { mag: 40, damage: 48, interval: 0.12, reload: 2.0, range: 900, spread: 0.008, impact: 26 },
  rifleRightMount: { intervalScale: 2 },
  cannon: { shells: 2, damage: 420, reload: 6, windup: 0.4, impact: 420, speed: 420, splash: 14 },
  missiles: { count: 8, damage: 90, cooldown: 14, spacing: 0.07, speed: 160, turn: 2.8, life: 5 },
  blade: { hits: [160, 160, 260], range: 18, comboWindow: 0.7, lungeDistance: 25, lungeSpeed: 140, cooldown: 0.28 },
  shove: { damage: 40, range: 14, cooldown: 0.9, impact: 120 },
  lock: { range: 700, assist: 0.6, stormAssistScale: 0.5 },
  /** Mech camera pull-back relative to on-foot framing (GDD §11). */
  cameraPullBack: 1.6,
  fov: 78,
  assaultHoldSeconds: 0.3,
} as const;

export type AegisSystem = 'hardLock' | 'leftArm' | 'shoulderCannon' | 'booster' | 'armor' | 'weapons' | 'shoulders';

/** Systems loss — authored, not random (GDD §7). */
export const SYSTEMS_LOSS = [
  { beat: 'magneticStorm', lost: 'hardLock' as const, seconds: 60, replacement: 'Manual aim; aim-assist halved' },
  { beat: 'wardenAmbush', lost: 'leftArm' as const, seconds: Infinity, replacement: 'Rifle swaps to right-arm mount: half fire rate' },
  { beat: 'marshalPhase3', lost: 'shoulderCannon' as const, seconds: Infinity, replacement: 'Gone for the rest of the game' },
];

/** Ascent (GDD §4.9 brief): jettison order and climb. */
export const ASCENT = {
  targetAltitude: 100_000,
  baseClimb: 520,
  jettisonBurst: 380,
  burstDecay: 1.6,
  steerSpeed: 34,
  steerBounds: 60,
  jettisons: [
    { at: 0.18, part: 'weapons', line: 'c6.aegis.jettisonWeapon' },
    { at: 0.38, part: 'shoulders', line: 'c6.aegis.jettisonShoulder' },
    { at: 0.6, part: 'armor', line: 'c6.aegis.jettisonArmor' },
    { at: 0.82, part: 'booster', line: 'c6.aegis.jettisonBooster' },
  ],
  debrisDamage: 6,
  aaDamage: 4,
  hull: 100,
} as const;
