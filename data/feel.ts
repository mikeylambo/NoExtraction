/** Game feel — GDD §13. */
export const FEEL = {
  hitstop: { takedown: 70, chainTakedown: 50, mechRifleKill: 25, cannonHit: 90 },
  blur: { cannonRadial: 0.08 },
  shakeCap: { foot: 0.35, mech: 0.6 },
  shake: { takedown: 0.12, sidearm: 0.03, carbine: 0.05, shotgun: 0.16, hurt: 0.14, land: 0.08, collapse: 0.35, mechRifle: 0.04, mechCannon: 0.4, mechHit: 0.22, mechHeavyHit: 0.5, jettison: 0.6 },
  death: { slowmo: 0.8, scale: 0.25 },
  cameraPush: { takedown: 0.06 },
} as const;
