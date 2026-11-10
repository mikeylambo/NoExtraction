import type { MatKey } from '../src/world/Materials';
import type { SolidKind } from '../src/world/Collision';

/**
 * Which level boxes get dressed with which kit piece (assets/manifest.ts KIT_PIECES). The first
 * rule a box matches wins; a rule whose pieces have no files is skipped, so the box stays a box.
 *
 *   len / thick   the box's long and short horizontal sides (metres); h = its height
 *   mode          'fit': one piece fills the box · 'tile': pieces repeat along `len` (and up, when
 *                 `module` has a height), each scaled a little to fill evenly · 'stack': pieces of
 *                 the box's footprint stacked up its height
 *   turn          pick a random 90° turn per box (rocks, crates) for variety
 *   decals        whether data/decals.ts may still place decals on the dressed box
 */
export interface KitRule {
  id: string;
  pieces: string[];
  mats: MatKey[];
  kinds: SolidKind[];
  len?: [number, number];
  thick?: [number, number];
  h?: [number, number];
  /** Footprint must be near square (long/short side ratio at most this). */
  square?: number;
  /** Box must be tall: height at least this many times its long side. */
  tall?: number;
  mode: 'fit' | 'tile' | 'stack';
  /** Tile size in metres: [along, up?]. */
  module?: [number, number?];
  turn?: boolean;
  decals: boolean;
}

const ANY = 1e9;

export const KIT_RULES: KitRule[] = [
  { id: 'cliffs', pieces: ['cliff_a', 'cliff_b'], mats: ['rock'], kinds: ['wall'], tall: 2, mode: 'fit', turn: true, decals: false },
  { id: 'rocks', pieces: ['rock_a', 'rock_b', 'rock_c'], mats: ['rock'], kinds: ['wall'], mode: 'fit', turn: true, decals: false },
  { id: 'crates', pieces: ['crate'], mats: ['crate'], kinds: ['crate'], len: [0.6, 2.5], mode: 'stack', turn: true, decals: true },
  { id: 'wall-caps', pieces: ['wall_cap'], mats: ['metalDark'], kinds: ['wall'], len: [2, ANY], thick: [0.3, 1.8], h: [0.1, 0.5], mode: 'tile', module: [4], decals: false },
  { id: 'walls', pieces: ['wall_panel'], mats: ['concrete', 'halcyon'], kinds: ['wall'], len: [1.5, ANY], thick: [0.2, 1.6], h: [2, ANY], mode: 'tile', module: [4, 2.5], decals: true },
  { id: 'tanks', pieces: ['tank'], mats: ['metal'], kinds: ['wall'], len: [2.5, 7], h: [3, 10], square: 1.3, mode: 'fit', decals: true },
  { id: 'poles', pieces: ['pole'], mats: ['metalDark'], kinds: ['prop', 'wall'], len: [0.1, 0.6], h: [3, ANY], mode: 'fit', decals: false },
  { id: 'pipes', pieces: ['pipe_run'], mats: ['metal'], kinds: ['cover-low'], len: [2, ANY], thick: [0.5, 1.2], mode: 'tile', module: [4], decals: false },
  { id: 'barriers', pieces: ['blast_barrier'], mats: ['metalDark'], kinds: ['cover-high'], len: [1, ANY], thick: [0.5, 1.4], mode: 'tile', module: [1], decals: true },
];
