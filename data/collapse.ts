/** Collapse events — GDD §4. Telegraph times are seconds. */
export type CollapseKind = 'fissure' | 'structure' | 'shelf' | 'debris' | 'aurora' | 'steam';

export interface CollapseDef {
  kind: CollapseKind;
  name: string;
  telegraph: number;
  telegraphCue: string;
  effect: string;
  damage?: number;
  radius?: number;
  duration?: number;
}

export const COLLAPSE: Record<CollapseKind, CollapseDef> = {
  fissure: { kind: 'fissure', name: 'Fissure split', telegraph: 2.0, telegraphCue: 'Rumble + violet crack line', effect: 'Splits ground; new gap or new path', damage: 0 },
  structure: { kind: 'structure', name: 'Structure collapse', telegraph: 2.5, telegraphCue: 'Groan + dust fall', effect: 'Blocks or opens a route permanently', damage: 80, radius: 4 },
  shelf: { kind: 'shelf', name: 'Shelf breakup', telegraph: 3.0, telegraphCue: 'Deep crack audio + tilt', effect: 'Ground tilts and slides; sprint or fall' },
  debris: { kind: 'debris', name: 'Debris strike', telegraph: 1.5, telegraphCue: 'Streak + whistle, ground marker', effect: '8 m blast, 60 dmg', damage: 60, radius: 8 },
  aurora: { kind: 'aurora', name: 'Aurora flare', telegraph: 1.0, telegraphCue: 'Sky brightens, HUD static', effect: 'Visor and enemy radios offline 10 s (also disables enemy alarms)', duration: 10 },
  steam: { kind: 'steam', name: 'Steam vent', telegraph: 1.2, telegraphCue: 'Hiss + frost plume', effect: 'Blocks vision; enemies cannot see through it', duration: 9, radius: 5 },
};

/** Mech-scale multipliers for collapse damage when Aegis is the target. */
export const MECH_COLLAPSE_DAMAGE_SCALE = 4;
