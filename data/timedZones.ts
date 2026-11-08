/** Timed Zones (Slice) — GDD §4. */
export interface TimedZoneDef { id: string; chapter: string; name: string; seconds: number; pressure: string; kind: 'time' | 'altitude' }
export const TIMED_ZONES: Record<string, TimedZoneDef> = {
  pad: { id: 'pad', chapter: 'ch2', name: 'The Pad', seconds: 90, pressure: 'Reach the pad before the bridge collapses', kind: 'time' },
  freightLift: { id: 'freightLift', chapter: 'ch3', name: 'Freight Lift', seconds: 180, pressure: 'Retrieve the flight governor before the lift shaft floods', kind: 'time' },
  conduitFlood: { id: 'conduitFlood', chapter: 'ch4', name: 'Conduit Flood', seconds: 150, pressure: 'Outrun rising water through the core conduits', kind: 'time' },
  shelfRun: { id: 'shelfRun', chapter: 'ch5', name: 'Shelf Run', seconds: 90, pressure: 'Assault-boost across the breaking shelf', kind: 'time' },
  ascent: { id: 'ascent', chapter: 'ch6', name: 'Ascent', seconds: 0, pressure: 'Climb before the booster fails', kind: 'altitude' },
};
/** Timed Zone assist: +50% time. */
export const TIMED_ZONE_ASSIST = 1.5;
/** Score accelerates at these remaining seconds. */
export const TIMED_ZONE_ACCEL_AT = [30, 10];
