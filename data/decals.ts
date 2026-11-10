import type { MatKey } from '../src/world/Materials';

/**
 * Decal placement. Each set scatters its kinds over the faces of level boxes whose material is in
 * `on`, deterministically (same level, same decals). Textures are assets/manifest.ts DECAL_TEXTURES;
 * a kind whose texture has no packed files is skipped, so sets can be written before the art exists.
 *
 *   face     'wall' = vertical faces of non-floor boxes, 'floor' = top faces of floors/platforms
 *   anchor   wall height: 'top' (hangs from the top edge: leaks, streaks), 'bottom' (sits on the
 *            ground line: drifts), 'middle' (signage height), 'any'
 *   density  decals per 100 m² of eligible face;  max: per face
 *   size     metres [w, h]; default the texture's physical size (packer json) split by atlas cells
 *   flip     allow mirrored copies (never for text/signage)
 *   tint     multiplies the texture (stencils and emblems are white paint)
 */
export type DecalFace = 'wall' | 'floor';
export type DecalAnchor = 'top' | 'bottom' | 'middle' | 'any';
export interface DecalKind { tex: string; cell?: number; size?: [number, number]; tint?: number; opacity?: number }
export interface DecalSet {
  id: string;
  kinds: DecalKind[];
  on: MatKey[];
  face: DecalFace;
  anchor?: DecalAnchor;
  density: number;
  max: number;
  scale?: [number, number];
  flip?: boolean;
  /** Smallest face (w, h in metres) the set will use. */
  minFace?: [number, number];
}

const CONCRETE_WALLS: MatKey[] = ['concrete'];
const METAL_WALLS: MatKey[] = ['metal', 'metalDark', 'sable', 'crate', 'hazard'];
const OUTDOOR_WALLS: MatKey[] = ['concrete', 'metal', 'metalDark', 'sable', 'halcyon', 'crate', 'rock'];
const PAINT = 0xd6dbe0; // stencil white, a little dirty
const g = (cell: number, size: [number, number], extra: Partial<DecalKind> = {}): DecalKind => ({ tex: 'grime', cell, size, ...extra });
const st = (cell: number, size = 0.42): DecalKind => ({ tex: 'stencils', cell, size: [size, size], tint: PAINT, opacity: 0.85 });

export const DECAL_SETS: DecalSet[] = [
  // concrete: cracks on walls and floors, leaks from the roof line, tyre marks
  {
    id: 'crack-wall', on: CONCRETE_WALLS, face: 'wall', anchor: 'any', density: 2.5, max: 2, scale: [0.7, 1.1], flip: true,
    kinds: ['crack_branch', 'crack_line_a', 'crack_line_b', 'crack_hook', 'crack_seam_a', 'crack_seam_b', 'crack_web', 'crack_h'].map((tex) => ({ tex })),
  },
  {
    id: 'crack-floor', on: ['concrete'], face: 'floor', density: 3, max: 4, scale: [0.8, 1.3], flip: true,
    kinds: ['asphalt_crack', 'road_crack', 'crack_patch', 'crack_web', 'crack_h'].map((tex) => ({ tex })),
  },
  {
    id: 'leaks', on: CONCRETE_WALLS, face: 'wall', anchor: 'top', density: 4, max: 3, scale: [0.9, 1.6], flip: true, minFace: [1, 1.5],
    kinds: ['leak_grime', 'leak_soot', 'leak_rust', 'leak_thin', 'leak_rust_wide', 'leak_run'].map((tex) => ({ tex })),
  },
  { id: 'tyres-concrete', on: ['concrete'], face: 'floor', density: 0.6, max: 2, scale: [1, 2], kinds: [{ tex: 'tyre_tracks' }] },
  // metal: rust streaks from the top edge, rust spots anywhere
  { id: 'rust-streaks', on: METAL_WALLS, face: 'wall', anchor: 'top', density: 3, max: 2, scale: [0.7, 1.2], flip: true, minFace: [0.8, 0.9], kinds: [g(0, [0.8, 1]), g(1, [1, 1.1]), g(12, [0.8, 1])] },
  { id: 'rust-spots', on: METAL_WALLS, face: 'wall', anchor: 'any', density: 4, max: 3, scale: [1.5, 3], flip: true, kinds: [{ tex: 'rust_spots' }] },
  // general wear
  { id: 'oil-floor', on: ['concrete', 'grate'], face: 'floor', density: 3, max: 3, scale: [0.8, 1.4], flip: true, kinds: [g(2, [1, 1]), g(3, [1.2, 0.8]), g(14, [0.9, 0.9])] },
  { id: 'scorch', on: ['concrete', 'metalDark', 'sable'], face: 'wall', anchor: 'any', density: 0.6, max: 1, scale: [0.9, 1.5], flip: true, kinds: [g(4, [1.2, 1.2]), g(5, [1.3, 0.9])] },
  { id: 'handprint', on: ['metal', 'halcyon', 'sable'], face: 'wall', anchor: 'middle', density: 0.4, max: 1, flip: true, kinds: [g(13, [0.45, 0.45])] },
  // cold: frost on walls, drifts banked against them, tracks in the snow
  { id: 'frost', on: OUTDOOR_WALLS, face: 'wall', anchor: 'top', density: 1.5, max: 1, scale: [0.7, 1.2], flip: true, kinds: [g(6, [0.9, 0.9]), g(7, [0.9, 0.9])] },
  { id: 'drifts', on: OUTDOOR_WALLS, face: 'wall', anchor: 'bottom', density: 2, max: 2, scale: [0.9, 1.6], flip: true, minFace: [1.2, 0.6], kinds: [g(15, [1.6, 0.7])] },
  { id: 'snow-tracks', on: ['snow', 'drift'], face: 'floor', density: 0.25, max: 30, scale: [0.9, 1.2], flip: true, kinds: [g(8, [0.6, 0.9]), g(9, [0.7, 0.8]), g(10, [0.6, 1.6]), g(11, [0.9, 1.2])] },
  // signage: stencils on containers and machinery, faction marks on their own structures
  { id: 'stencils-crate', on: ['crate'], face: 'wall', anchor: 'middle', density: 6, max: 1, kinds: [st(2), st(5), st(6), st(7), st(8), st(9), st(10), st(11), st(12), st(13), st(14), st(15)] },
  { id: 'stencils-metal', on: ['metal', 'metalDark', 'hazard'], face: 'wall', anchor: 'middle', density: 1.5, max: 1, kinds: [st(0, 0.5), st(1, 0.45), st(3, 0.45), st(4, 0.5)] },
  { id: 'chevrons-floor', on: ['grate'], face: 'floor', density: 1, max: 1, kinds: [st(0, 0.7), st(1, 0.6)] },
  { id: 'emblem-sable', on: ['sable'], face: 'wall', anchor: 'middle', density: 3, max: 1, scale: [0.9, 1.2], minFace: [1.8, 1.4], kinds: [{ tex: 'emblem_sable', size: [1.3, 1.3], tint: PAINT, opacity: 0.8 }] },
  { id: 'emblem-halcyon', on: ['halcyon'], face: 'wall', anchor: 'middle', density: 3, max: 1, scale: [0.9, 1.2], minFace: [1.8, 1.4], kinds: [{ tex: 'emblem_halcyon', size: [1.3, 1.3], tint: 0x3a434c, opacity: 0.85 }] },
];

/** Upper bound per level, whatever the densities say (draw cost is per texture, this caps overdraw). */
export const DECAL_LIMIT = 1600;
