/**
 * The readability law (GDD §2, §13). Every colour with gameplay meaning comes from here; the lint
 * step fails if these hex values appear anywhere else in src/.
 *   red   — Sable threat only      amber — Wren only      cyan — Ballast's information only
 *   violet-white — the failing core       signal white → red — Aegis HUD as systems fail
 */
export const PALETTE = {
  snow: 0xe8eef3,
  ice: 0xb9c9d6,
  steel: 0x6b7680,
  slate: 0x3a434c,
  night: 0x0b1118,
  cyan: 0x3ee6ff,
  cyanDeep: 0x0fa6c8,
  red: 0xff2a3a,
  redDeep: 0x8a0f18,
  amber: 0xffb02e,
  amberDeep: 0xb86a00,
  violet: 0xd7c7ff,
  violetDeep: 0x7a55ff,
  signal: 0xf4f7ff,
} as const;

export const CSS = {
  cyan: '#3ee6ff',
  red: '#ff2a3a',
  amber: '#ffb02e',
  violet: '#d7c7ff',
  signal: '#f4f7ff',
  snow: '#e8eef3',
  ice: '#b9c9d6',
} as const;

export type ColorblindMode = 'off' | 'protan' | 'deutan' | 'tritan';

/**
 * Colourblind remaps keep the law's three categories distinct; shape + icon carry meaning too
 * (threat = triangle/eye, Wren = diamond, Ballast info = circle/chevron).
 */
export const COLORBLIND: Record<ColorblindMode, { red: string; amber: string; cyan: string }> = {
  off: { red: CSS.red, amber: CSS.amber, cyan: CSS.cyan },
  protan: { red: '#ff8f1f', amber: '#ffe74a', cyan: '#4aa8ff' },
  deutan: { red: '#ff7a1a', amber: '#fff04d', cyan: '#5b9dff' },
  tritan: { red: '#ff3b6b', amber: '#ffc8d8', cyan: '#2fe0c0' },
};
