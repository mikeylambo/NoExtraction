export type WeaponId = 'sidearm' | 'carbine' | 'shotgun';
export type ThrowableId = 'flash' | 'decoy';

export interface WeaponDef {
  id: WeaponId;
  name: string;
  mag: number;
  reserveMax: number;
  damage: number;
  pellets: number;
  headshotKill: boolean;
  headMult: number;
  interval: number;
  reload: number;
  spreadHip: number;
  spreadAim: number;
  range: number;
  /** Noise radius, metres. */
  noise: number;
  /** Loud weapons put anyone who hears them straight into Hunted. */
  loud: boolean;
  auto: boolean;
  /** Opens weakened doors. */
  breach: boolean;
  recoil: number;
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  sidearm: { id: 'sidearm', name: 'Suppressed sidearm', mag: 12, reserveMax: 48, damage: 34, pellets: 1, headshotKill: true, headMult: 1, interval: 0.22, reload: 1.4, spreadHip: 0.022, spreadAim: 0.004, range: 70, noise: 6, loud: false, auto: false, breach: false, recoil: 0.018 },
  carbine: { id: 'carbine', name: 'Sable carbine', mag: 30, reserveMax: 150, damage: 22, pellets: 1, headshotKill: false, headMult: 2, interval: 0.1, reload: 2.1, spreadHip: 0.03, spreadAim: 0.009, range: 110, noise: 40, loud: true, auto: true, breach: false, recoil: 0.012 },
  shotgun: { id: 'shotgun', name: 'Breacher shotgun', mag: 6, reserveMax: 36, damage: 9, pellets: 12, headshotKill: false, headMult: 1.5, interval: 0.75, reload: 2.6, spreadHip: 0.075, spreadAim: 0.06, range: 26, noise: 40, loud: true, auto: false, breach: true, recoil: 0.06 },
};

export interface ThrowableDef { id: ThrowableId; name: string; carry: number; radius: number; stun?: number; pull?: number; fuse: number; speed: number }
export const THROWABLES: Record<ThrowableId, ThrowableDef> = {
  flash: { id: 'flash', name: 'Flash charge', carry: 3, radius: 6, stun: 3, fuse: 0.9, speed: 16 },
  decoy: { id: 'decoy', name: 'Noise decoy', carry: 3, radius: 15, pull: 15, fuse: 1.2, speed: 15 },
};

export const STIM = { heal: 100 } as const;
