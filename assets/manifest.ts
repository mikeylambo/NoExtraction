/**
 * Every art and audio asset. Hero assets are procedural stand-ins; dropping a GLB/PNG at the
 * listed path overrides the stand-in at boot with no code change (see src/world/ModelOverrides.ts).
 * Audio (SFX, music, VO) is listed in data/audio.ts and data/story/* — files at those paths
 * override the synth fallback / subtitle-only playback the same way.
 */
export interface ModelEntry { id: string; path: string; standIn: string; scale?: number; note: string }

export const MODELS: ModelEntry[] = [
  { id: 'ballast', path: 'assets/models/ballast.glb', standIn: 'buildHumanoid("ballast")', note: 'Frank, callsign Ballast (the player): winter camo, goggles. Rigged GLB present (Meshy multi-view, 36k tris, hero budget)' },
  { id: 'trooper', path: 'assets/models/sable_trooper.glb', standIn: 'buildHumanoid("trooper")', note: 'Sable trooper, red visor slit (threat colour). Rigged GLB present (Meshy; built by tools/build-character.mjs); its skeleton (1.79 m) is the height reference for every Sable model' },
  { id: 'spotter', path: 'assets/models/sable_spotter.glb', standIn: 'buildHumanoid("spotter")', note: 'Sable spotter: hooded long coat, radio pack with antenna. Rigged GLB present (Meshy multi-view, 20.9k tris)' },
  { id: 'heavy', path: 'assets/models/sable_heavy.glb', standIn: 'buildHumanoid("heavy")', note: 'Sable heavy: chest slab, respirator; ~2.05 m via the heavy style scale. Rigged GLB present (Meshy multi-view, 20.9k tris)' },
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
  { id: 'snow', tile: 4, usedBy: 'snow floors, drifts/berms, snow cover on every top face', search: 'wind-blown or rippled snow; fresh powder snow' },
  { id: 'packedSnow', tile: 2, usedBy: '(paths; not assigned to a material yet)', search: 'trampled or dirty snow' },
  { id: 'concrete', tile: 3, usedBy: 'concrete walls, bunkers, stairs, canvas', search: 'cast concrete with formwork seams; cracked, stained concrete floor' },
  { id: 'paint', tile: 2, usedBy: 'metal, sable, halcyon, hazard (tinted per material)', search: 'chipped painted steel, neutral grey' },
  { id: 'corrugated', tile: 2, usedBy: 'crates and containers (falls back to paint)', search: 'corrugated sheet metal, painted or weathered' },
  { id: 'rust', tile: 2, usedBy: 'metalDark: high cover, machinery (falls back to paint)', search: 'rusted or oxidised steel' },
  { id: 'rock', tile: 2, usedBy: 'rock walls and boulders', search: 'dark basalt or granite rock face' },
  { id: 'ice', tile: 2, usedBy: 'ice floors, ice walls (Ch4)', search: 'blue glacier ice with cracks' },
  { id: 'grate', tile: 1, usedBy: 'interior floors, catwalks (Ch5)', search: 'steel tread plate or floor grating' },
];

/**
 * Decal textures. Packed files live in public/decals/ (built by `python3 tools/pack_decal.py --id <id>`
 * from a download in assets/decals/<id>/):
 *   <id>_color.webp  (sRGB colour with opacity in alpha, required)
 *   <id>_normal.webp (OpenGL / +Y, optional)
 *   <id>.json        (written by the packer: physical size in metres, mean roughness)
 * `atlas`: a sheet of cols × rows cells, each used as its own decal (data/decals.ts picks cells).
 * What goes where (and how often) is data/decals.ts; with no files a decal simply never appears.
 */
export interface DecalTexture { id: string; atlas?: [number, number]; source: string }

export const DECAL_TEXTURES: DecalTexture[] = [
  // Megascans (Fab), 2K texture sets
  { id: 'crack_branch', source: 'Megascans concrete_crack_sezrfcg' },
  { id: 'crack_line_a', source: 'Megascans concrete_crack_sfdo1xg' },
  { id: 'crack_line_b', source: 'Megascans concrete_crack_sfilvlg' },
  { id: 'crack_h', source: 'Megascans concrete_crack_sfiqk0g' },
  { id: 'crack_hook', source: 'Megascans concrete_crack_sfcsmqg' },
  { id: 'crack_seam_a', source: 'Megascans concrete_crack_sfelnxg' },
  { id: 'crack_seam_b', source: 'Megascans concrete_crack_sfio1qg' },
  { id: 'crack_web', source: 'Megascans concrete_crack_seznlkg' },
  { id: 'crack_patch', source: 'Megascans concrete_crack_sdokhyi' },
  { id: 'asphalt_crack', source: 'Megascans asphalt_crack_umegahkcw' },
  { id: 'road_crack', source: 'Megascans road_crack_sfisjpg' },
  { id: 'leak_grime', source: 'Megascans industrial_decal_leak_02_tdlodebc' },
  { id: 'leak_soot', source: 'Megascans leakage_skphbg3c' },
  { id: 'leak_rust', source: 'Megascans leakage_tculfhnc' },
  { id: 'leak_thin', source: 'Megascans leakage_tcumebvc' },
  { id: 'leak_rust_wide', source: 'Megascans leakage_tdcafitc' },
  { id: 'leak_run', source: 'Megascans tileable_leakage_tc1fdi2c' },
  { id: 'rust_spots', source: 'Megascans military_trenches_decal_metal_rust_02_ydzmaf2' },
  { id: 'tyre_tracks', source: 'Megascans tire_tracks_on_concrete_sfhqelg' },
  // Generated (GPT_PROMPTS.md §5), transparent PNG sheets
  { id: 'grime', atlas: [4, 4], source: 'GPT grime and wear atlas' },
  { id: 'stencils', atlas: [4, 4], source: 'GPT stencil sheet' },
  { id: 'emblem_sable', source: 'GPT Sable emblem' },
  { id: 'emblem_halcyon', source: 'GPT Halcyon emblem' },
];

/**
 * Environment kit: modular meshes laid over the level's collision boxes (rules: data/kit.ts).
 * Collision stays the boxes; a piece is only the look. Files: public/assets/kit/<id>.glb.
 * Every piece is authored at its `size` (metres, x = length, y = height, z = depth), standing on
 * y = 0, front facing +Z; the game fits its bounding box to each box (or to each tile of one), so
 * the visible mesh should fill its bounds. A mesh whose material is named `world` takes the box's
 * own world material (scanned surface + snow); any other material is used as authored.
 * `npm run kit-templates` writes code-built stand-ins for every piece (exact bounds) into
 * public/assets/kit; an artist's GLB at the same path replaces its stand-in.
 */
export interface KitPiece { id: string; size: [number, number, number]; tris: number; note: string }

export const KIT_PIECES: KitPiece[] = [
  { id: 'wall_panel', size: [4, 2.5, 0.6], tris: 3000, note: 'Cast-concrete wall module, both faces finished; tiles along and up long concrete/halcyon walls' },
  { id: 'wall_cap', size: [4, 0.3, 0.9], tris: 800, note: 'Steel coping along wall tops; tiles along' },
  { id: 'crate', size: [1.2, 1.2, 1.2], tris: 1000, note: 'Supply crate, framed; stacked two high on tall crate boxes' },
  { id: 'rock_a', size: [4, 3, 4], tris: 1500, note: 'Large rock; rocks are picked per box and turned in 90° steps' },
  { id: 'rock_b', size: [4, 3, 4], tris: 1500, note: 'Large rock, second shape' },
  { id: 'rock_c', size: [4, 3, 4], tris: 1500, note: 'Large rock, third shape' },
  { id: 'cliff_a', size: [4, 10, 4], tris: 2500, note: 'Rock spire / cliff column for tall rock boxes (height over twice the footprint)' },
  { id: 'cliff_b', size: [4, 10, 4], tris: 2500, note: 'Cliff column, second shape' },
  { id: 'pipe_run', size: [4, 1, 0.8], tris: 1500, note: 'Pipe bundle on saddles (low cover); tiles along' },
  { id: 'tank', size: [4, 5, 4], tris: 2500, note: 'Fuel/water tank on a plinth' },
  { id: 'pole', size: [0.3, 6, 0.3], tris: 300, note: 'Steel pole: lamp posts, tower legs' },
  { id: 'blast_barrier', size: [1, 1.5, 1], tris: 400, note: 'Concrete T-wall section (high cover); tiles along' },
];

export const TEXTURES: { id: string; path: string; note: string }[] = [
  { id: 'lut', path: 'assets/textures/grade_lut.png', note: 'Optional 256×16 colour-grade LUT for the post stack' },
];
