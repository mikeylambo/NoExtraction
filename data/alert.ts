import type { SightConfig } from '@slu/perception';

/** Alert ladder — GDD §3. */
export const ALERT = {
  suspicious: { fillClose: 0.6, fillFar: 1.4, investigate: 10 },
  hunted: { memory: 14 },
  lockdown: { huntedSeconds: 8, alarmPanelSeconds: 3, decaySeconds: 45, reinforcementSquads: 1 },
  gateHack: { seconds: 6, noiseRadius: 22, noiseInterval: 1.0 },
  radio: { delay: 0.8, range: 70 },
} as const;

export const HUMAN_SIGHT: SightConfig = { range: 26, fovDeg: 100, vHalfDeg: 55, closeRange: 5, fillClose: ALERT.suspicious.fillClose, fillFar: ALERT.suspicious.fillFar, eyeHeight: 1.65 };
