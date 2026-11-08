/** Wren's caches — GDD §5. Slice: 4 story + 4 personal. */
export type CacheKind = 'story' | 'personal';
export interface CacheContents { stims?: number; ammo?: number; flash?: number; decoy?: number; routeMarker?: string }
export interface CacheDef {
  id: string;
  chapter: string;
  kind: CacheKind;
  /** Wren recording, then Ballast's reply (played as radio audio while you move). */
  lines: string[];
  contents: CacheContents;
  hint?: string;
}

export const CACHES: CacheDef[] = [
  { id: 'sc1', chapter: 'ch2', kind: 'story', lines: ['c2.wren.cache1a', 'c2.wren.cache1b', 'c2.wren.cache1c', 'c2.ballast.cache1reply'], contents: { stims: 1, ammo: 24, flash: 1 } },
  { id: 'sc2', chapter: 'ch3', kind: 'story', lines: ['c3.wren.cache2a', 'c3.wren.cache2b', 'c3.ballast.cache2reply'], contents: { stims: 1, ammo: 24, decoy: 1, routeMarker: 'ch3.fast.mast' } },
  { id: 'sc3', chapter: 'ch4', kind: 'story', lines: ['c4.wren.cache3a', 'c4.wren.cache3b', 'c4.ballast.cache3reply'], contents: { stims: 1, ammo: 18, flash: 1 } },
  { id: 'sc4', chapter: 'ch5', kind: 'story', lines: ['c5.wren.cache4a', 'c5.wren.cache4b', 'c5.ballast.cache4reply'], contents: {} },
  { id: 'pc1', chapter: 'ch3', kind: 'personal', lines: ['c3.wren.pc1a', 'c3.wren.pc1b', 'c3.ballast.pc1reply'], contents: { stims: 1, decoy: 1 }, hint: 'flightGovernor' },
  { id: 'pc2', chapter: 'ch3', kind: 'personal', lines: ['c3.wren.pc2a', 'c3.wren.pc2b', 'c3.ballast.pc2reply'], contents: { stims: 1, ammo: 12 } },
  { id: 'pc3', chapter: 'ch4', kind: 'personal', lines: ['c4.wren.pc3a', 'c4.wren.pc3b', 'c4.ballast.pc3reply'], contents: { stims: 1, flash: 1 }, hint: 'arcBlade' },
  { id: 'pc4', chapter: 'ch4', kind: 'personal', lines: ['c4.wren.pc4a', 'c4.wren.pc4b', 'c4.wren.pc4c', 'c4.ballast.pc4reply'], contents: { stims: 1 } },
];
export const PERSONAL_CACHE_IDS = CACHES.filter((c) => c.kind === 'personal').map((c) => c.id);
