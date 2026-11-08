/**
 * Mech frame baseline — copied verbatim from AlphaMech (BLINKFALL) `src/core/Tuning.ts`
 * (commit 25d615e). These are the proven feel values; consumers copy and override, never edit here.
 */
export const MECH_BASELINE = {
  // movement (AlphaMech GDD §5.1)
  speed: 62,
  accel: 16,
  thrust: 92,
  gravity: 50,
  quickSpeed: 200,
  quickDur: 0.22,
  quickCost: 20,
  quickCooldown: 0.34,
  assaultSpeed: 200,
  assaultDrain: 6,
  assaultAccel: 12,
  energyMax: 100,
  hoverCost: 14,
  regenGround: 43,
  regenAir: 16,
  regenDelay: 0.5,
  descentSpeed: 130,
  ceiling: 240,
  // vitals (AlphaMech GDD §5.2)
  impactDecay: 150,
  staggerDmgMult: 1.9,
  impactHoldAfterHit: 1.8,
  exposedMult: 2.4,
  // camera (AlphaMech, donor ASHFALL)
  camDist: 30,
  camHeight: 6.4,
  camLag: 13,
  camFov: 62,
  camFovBoost: 76,
  mouseSens: 0.0023,
  padLookSens: 2.9,
  padDeadzone: 0.16,
  pitchMin: -0.85,
  pitchMax: 1.0,
  /** Height above a machine's feet that the camera frames (AlphaMech FOCUS_H). */
  focusHeight: 7,
};

export type MechTuning = { -readonly [K in keyof typeof MECH_BASELINE]: number };
export const cloneBaseline = (): MechTuning => ({ ...MECH_BASELINE });
