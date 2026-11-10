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

/**
 * Scanned tiling surfaces (Megascans / Fab or any PBR set) for the world materials. Each slot is a
 * surface in src/render/surfaces.ts; with no files it stays procedural. Packed files live in
 * public/surfaces/ so they ship with the build:
 *   <id>_basecolor.webp (sRGB, required: its presence switches the slot on)
 *   <id>_normal.webp    (OpenGL / +Y, optional)
 *   <id>_orm.webp       (R = AO, G = roughness, B = metal, optional)
 * `python3 tools/pack_surface.py --id <id>` builds them from a download in assets/surfaces/<id>/.
 * `tile`: metres one repeat covers (the Fab listing gives the scan's real size; usually 2 m).
 * `normal` / `albedo`: detail strength (unset = the procedural default for that slot).
 * Albedo is applied as detail around each material's own colour, so neutral scans work best.
 */
export type SurfaceSlot = 'snow' | 'packedSnow' | 'concrete' | 'paint' | 'corrugated' | 'rust' | 'rock' | 'ice' | 'grate';
export interface SurfaceEntry { id: SurfaceSlot; tile: number; normal?: number; albedo?: number; usedBy: string; search: string }

export const SURFACES: SurfaceEntry[] = [
  { id: 'snow', tile: 2, usedBy: 'snow floors, drifts/berms, snow cover on every top face', search: 'wind-blown or rippled snow; fresh powder snow' },
  { id: 'packedSnow', tile: 2, usedBy: '(paths; not assigned to a material yet)', search: 'trampled or dirty snow' },
  { id: 'concrete', tile: 2, usedBy: 'concrete walls, bunkers, stairs, canvas', search: 'cast concrete with formwork seams; cracked, stained concrete floor' },
  { id: 'paint', tile: 2, usedBy: 'metal, sable, halcyon, hazard (tinted per material)', search: 'chipped painted steel, neutral grey' },
  { id: 'corrugated', tile: 2, usedBy: 'crates and containers (falls back to paint)', search: 'corrugated sheet metal, painted or weathered' },
  { id: 'rust', tile: 2, usedBy: 'metalDark: high cover, machinery (falls back to paint)', search: 'rusted or oxidised steel' },
  { id: 'rock', tile: 2, usedBy: 'rock walls and boulders', search: 'dark basalt or granite rock face' },
  { id: 'ice', tile: 2, usedBy: 'ice floors, ice walls (Ch4)', search: 'blue glacier ice with cracks' },
  { id: 'grate', tile: 1, usedBy: 'interior floors, catwalks (Ch5)', search: 'steel tread plate or floor grating' },
];

export const TEXTURES: { id: string; path: string; note: string }[] = [
  { id: 'lut', path: 'assets/textures/grade_lut.png', note: 'Optional 256×16 colour-grade LUT for the post stack' },
];
