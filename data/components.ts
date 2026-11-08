/** AEGIS components — GDD §6. */
export type ComponentId = 'flightGovernor' | 'missileRack' | 'arcBlade';
export interface ComponentDef { id: ComponentId; name: string; chapter: string; found: string; without: string; with: string }
export const COMPONENTS: Record<ComponentId, ComponentDef> = {
  flightGovernor: { id: 'flightGovernor', name: 'Flight Governor', chapter: 'ch3', found: 'Ch3 Freight Lift cargo bay', without: 'Jump jets only: hops up to 12 m', with: 'Full sustained flight and air boosting' },
  missileRack: { id: 'missileRack', name: 'Missile Rack', chapter: 'ch2', found: 'Ch2 armory (optional route)', without: 'Shoulder slot empty', with: '8-missile volley, lock-on, 14 s cooldown' },
  arcBlade: { id: 'arcBlade', name: 'Arc Blade', chapter: 'ch4', found: 'Ch4 maintenance bay (optional)', without: 'Melee is a shove (low damage)', with: 'Full blade combo, boost-lunge' },
};
export const COMPONENT_IDS: ComponentId[] = ['flightGovernor', 'missileRack', 'arcBlade'];
/** All 8 combinations, for acceptance runs. */
export const COMPONENT_COMBOS: ComponentId[][] = [0, 1, 2, 3, 4, 5, 6, 7].map((m) => COMPONENT_IDS.filter((_, i) => m & (1 << i)));
