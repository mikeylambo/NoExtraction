import type { PerceiverConfig } from '@slu/perception';
import { ALERT, HUMAN_SIGHT } from './alert';

/** Enemies — GDD §9. */
export type ArchetypeId = 'trooper' | 'spotter' | 'heavy' | 'drone' | 'hound' | 'warden';

export interface ArchetypeDef {
  id: ArchetypeId;
  name: string;
  hp: number;
  /** Damage multiplier on hits to the front (Heavy armour). */
  frontArmor: number;
  walk: number;
  run: number;
  perception: PerceiverConfig;
  weapon: { damage: number; burst: number; interval: number; burstGap: number; range: number; accuracy: number; telegraph: number };
  takedown: 'any' | 'rear' | 'none';
  canAlarm: boolean;
  lesson: string;
}

const human = (over: Partial<PerceiverConfig> = {}): PerceiverConfig => ({
  sight: { ...HUMAN_SIGHT }, hearing: { multiplier: 1 }, investigateTime: ALERT.suspicious.investigate, huntMemory: ALERT.hunted.memory, radioRange: ALERT.radio.range, ...over,
});

export const ARCHETYPES: Record<ArchetypeId, ArchetypeDef> = {
  trooper: { id: 'trooper', name: 'Trooper', hp: 80, frontArmor: 1, walk: 1.7, run: 4.6, perception: human(), weapon: { damage: 7, burst: 3, interval: 0.11, burstGap: 1.4, range: 45, accuracy: 0.55, telegraph: 0.5 }, takedown: 'any', canAlarm: true, lesson: 'The basic stealth puzzle' },
  spotter: { id: 'spotter', name: 'Spotter', hp: 60, frontArmor: 1, walk: 0, run: 0, perception: human({ sight: { ...HUMAN_SIGHT, range: 40, fovDeg: 56, closeRange: 8, eyeHeight: 1.6 } }), weapon: { damage: 22, burst: 1, interval: 1, burstGap: 2.6, range: 60, accuracy: 0.7, telegraph: 0.9 }, takedown: 'any', canAlarm: false, lesson: 'Kill or avoid sightlines first' },
  heavy: { id: 'heavy', name: 'Heavy', hp: 260, frontArmor: 0.25, walk: 1.1, run: 2.4, perception: human({ sight: { ...HUMAN_SIGHT, range: 22, fovDeg: 90 } }), weapon: { damage: 5, burst: 12, interval: 0.08, burstGap: 1.8, range: 38, accuracy: 0.4, telegraph: 0.7 }, takedown: 'rear', canAlarm: true, lesson: "Flank, don't trade" },
  drone: { id: 'drone', name: 'Seeker Drone', hp: 40, frontArmor: 1, walk: 3.2, run: 3.2, perception: { sight: { range: 14, fovDeg: 34, pitchDeg: 62, closeRange: 4, fillClose: 0.35, fillFar: 0.6, eyeHeight: 0, maxAwareness: 'suspicious' }, hearing: null, investigateTime: 6, huntMemory: 6, radioRange: 90 }, weapon: { damage: 0, burst: 0, interval: 1, burstGap: 1, range: 0, accuracy: 0, telegraph: 0 }, takedown: 'none', canAlarm: false, lesson: 'Time your movement; shoot it only if quiet is gone' },
  hound: { id: 'hound', name: 'Hound', hp: 120, frontArmor: 1, walk: 2.6, run: 9.5, perception: { sight: { range: 5, fovDeg: 120, closeRange: 2, fillClose: 0.5, fillFar: 0.7, eyeHeight: 0.6 }, hearing: { multiplier: 2.2, quietMax: 'hunted' }, investigateTime: 12, huntMemory: 10, radioRange: 40 }, weapon: { damage: 18, burst: 1, interval: 1, burstGap: 1.1, range: 2.2, accuracy: 1, telegraph: 0.35 }, takedown: 'rear', canAlarm: false, lesson: "Don't sprint; use decoys" },
  warden: { id: 'warden', name: 'Warden Frame', hp: 1400, frontArmor: 1, walk: 40, run: 120, perception: { sight: { range: 900, fovDeg: 360, closeRange: 100, fillClose: 0.1, fillFar: 0.3, eyeHeight: 8 }, hearing: { multiplier: 1 }, investigateTime: 5, huntMemory: 30, radioRange: 2000 }, weapon: { damage: 12, burst: 4, interval: 0.14, burstGap: 2.0, range: 700, accuracy: 0.35, telegraph: 0.5 }, takedown: 'none', canAlarm: false, lesson: 'The mech-scale threat you hid from on foot — now prey' },
};

/** Warden rockets (mech scale). */
export const WARDEN_ROCKETS = { damage: 45, count: 2, cooldown: 9, telegraph: 1.0, speed: 120 };

/** Difficulty scales information and execution first (telegraph, accuracy), damage last. */
export const DIFFICULTY = {
  story: { id: 'story', label: 'Story', enemyDamage: 0.35, enemyAccuracy: 0.6, fillTime: 1.6, telegraph: 1.35, playerDamage: 1.6, bossArmor: 0.6, regenCap: 100 },
  normal: { id: 'normal', label: 'Normal', enemyDamage: 1, enemyAccuracy: 1, fillTime: 1, telegraph: 1, playerDamage: 1, bossArmor: 1, regenCap: 60 },
  hard: { id: 'hard', label: 'Hard', enemyDamage: 1.35, enemyAccuracy: 1.2, fillTime: 0.8, telegraph: 0.85, playerDamage: 1, bossArmor: 1.15, regenCap: 60 },
} as const;
export type DifficultyId = keyof typeof DIFFICULTY;
