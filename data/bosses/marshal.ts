/** THE MARSHAL / SOVEREIGN — GDD §10. Telegraph times in seconds. */
export const MARSHAL = {
  armor: 9000,
  ttkTargetMinutes: [4, 6] as const,
  speed: 70,
  boostSpeed: 160,
  phases: [
    { id: 1, name: 'Duel', from: 1.0, to: 0.65 },
    { id: 2, name: 'Platform breaks', from: 0.65, to: 0.3 },
    { id: 3, name: 'Desperate', from: 0.3, to: 0 },
  ],
  attacks: {
    rifleBurst: { telegraph: 0.5, cue: 'red muzzle glint', damage: 24, shots: 6, interval: 0.1, cooldown: 3.2 },
    bladeLunge: { telegraph: 0.7, cue: 'blade ignite + audio sting', damage: 210, reach: 30, lungeSpeed: 190, cooldown: 7 },
    missileSalvo: { telegraph: 1.0, cue: 'lock tone', damage: 55, count: 6, cooldown: 11 },
    gantryCrush: { telegraph: 1.5, cue: 'shadow + creak', damage: 320, radius: 26, cooldown: 9 },
    overcharge: { telegraph: 1.8, cue: 'screen-wide charge glow', damage: 520, width: 22, cooldown: 14 },
  },
  phase2: { arenaShrink: 1 / 3, supportWardens: 2 },
  phase3: { telegraphScale: 0.8, speedScale: 1.25, cooldownScale: 0.75 },
  arenaRadius: 360,
} as const;
