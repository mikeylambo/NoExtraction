/**
 * Every art and audio asset. Hero assets are procedural stand-ins; dropping a GLB/PNG at the
 * listed path overrides the stand-in at boot with no code change (see src/world/ModelOverrides.ts).
 * Audio (SFX, music, VO) is listed in data/audio.ts and data/story/* — files at those paths
 * override the synth fallback / subtitle-only playback the same way.
 */
export interface ModelEntry { id: string; path: string; standIn: string; scale?: number; note: string }

export const MODELS: ModelEntry[] = [
  { id: 'ballast', path: 'assets/models/ballast.glb', standIn: 'buildHumanoid("ballast")', note: 'Helmeted operative, ~1.8 m, origin at feet, facing −Z' },
  { id: 'trooper', path: 'assets/models/sable_trooper.glb', standIn: 'buildHumanoid("trooper")', note: 'Sable trooper, red visor slit (threat colour). Rigged GLB present (Meshy; built by tools/build-character.mjs); spotter and heavy borrow it until theirs exist' },
  { id: 'spotter', path: 'assets/models/sable_spotter.glb', standIn: 'buildHumanoid("spotter")', note: 'Sable spotter with scoped rifle' },
  { id: 'heavy', path: 'assets/models/sable_heavy.glb', standIn: 'buildHumanoid("heavy")', note: 'Armoured front, LMG; ~2.05 m' },
  { id: 'aegis', path: 'assets/models/aegis07.glb', standIn: 'buildPlayerMech(AEGIS_PALETTE)', note: 'FLAMINGO-07, ~10 m, signal white; rig pivots are procedural, GLB is visual only' },
  { id: 'warden', path: 'assets/models/warden_frame.glb', standIn: 'buildStandardMech(SABLE_FRAME_PALETTE)', note: 'Sable Warden frame' },
  { id: 'sovereign', path: 'assets/models/sovereign.glb', standIn: 'buildHeavyMech(SOVEREIGN_PALETTE)', note: "The Marshal's frame" },
  { id: 'wrenShip', path: 'assets/models/wren_ship.glb', standIn: 'buildWrenShip()', note: 'Halcyon extraction ship, amber running lights' },
];

export const TEXTURES: { id: string; path: string; note: string }[] = [
  { id: 'lut', path: 'assets/textures/grade_lut.png', note: 'Optional 256×16 colour-grade LUT for the post stack' },
];
