import type { LevelContext } from '../Level';
import type { MatKey } from '../Materials';
import { PALETTE } from '../../../data/palette';

/** Reusable set dressing built from boxes (collision is authoritative, look is final). */

/** Deterministic pseudo-random for layout scatter. */
export function prng(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

/** Wall run from (x0,z0) to (x1,z1) along an axis, with gaps [{at, width}]. */
export function wallLine(ctx: LevelContext, x0: number, z0: number, x1: number, z1: number, h: number, gaps: { at: number; width: number }[] = [], mat: MatKey = 'concrete', t = 0.6, y = 0): void {
  const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
  const a0 = alongX ? Math.min(x0, x1) : Math.min(z0, z1), a1 = alongX ? Math.max(x0, x1) : Math.max(z0, z1);
  const fixed = alongX ? z0 : x0;
  let cur = a0;
  for (const g of [...gaps].sort((p, q) => p.at - q.at)) {
    const s = g.at - g.width / 2;
    if (s > cur) seg(cur, s);
    cur = g.at + g.width / 2;
  }
  if (a1 > cur) seg(cur, a1);
  function seg(a: number, b: number) {
    const mid = (a + b) / 2, len = b - a;
    if (alongX) ctx.b.wall(mid, fixed, len, t, h, y, { mat }); else ctx.b.wall(fixed, mid, t, len, h, y, { mat });
    // cap trim
    if (alongX) ctx.b.at(mid, fixed, len, t + 0.3, 0.25, y + h, { mat: 'metalDark', kind: 'wall' }); else ctx.b.at(fixed, mid, t + 0.3, len, 0.25, y + h, { mat: 'metalDark', kind: 'wall' });
  }
}

export function crates(ctx: LevelContext, x: number, z: number, n: number, seed = 1): void {
  const r = prng(seed);
  for (let i = 0; i < n; i++) {
    const s = 1.1 + r() * 0.4; const h = r() < 0.4 ? s * 1.35 : s;
    ctx.b.crate(x + (i % 3) * 1.3 + r() * 0.2, z + Math.floor(i / 3) * 1.3 + r() * 0.2, s, h);
  }
}

export function truck(ctx: LevelContext, x: number, z: number, alongX = false): void {
  const [w, d] = alongX ? [7, 2.6] : [2.6, 7];
  ctx.b.at(x, z, w, d, 1.0, 0.5, { mat: 'metalDark', kind: 'cover-low' });
  ctx.b.at(x + (alongX ? 2.2 : 0), z + (alongX ? 0 : -2.2), alongX ? 2.4 : 2.4, alongX ? 2.4 : 2.4, 1.6, 1.5, { mat: 'sable', kind: 'cover-high' });
  ctx.b.at(x + (alongX ? -1 : 0), z + (alongX ? 0 : 1), alongX ? 4.4 : 2.4, alongX ? 2.4 : 4.4, 1.9, 1.5, { mat: 'canvas', kind: 'cover-high' });
}

export function tank(ctx: LevelContext, x: number, z: number, r = 2.5, h = 6): void {
  ctx.b.at(x, z, r * 2, r * 2, h, 0, { mat: 'metal', kind: 'wall' });
  ctx.b.at(x, z, r * 2.2, r * 2.2, 0.3, h, { mat: 'metalDark', kind: 'wall' });
}

/** Watchtower with stairs on one side; returns the top height. */
export function tower(ctx: LevelContext, x: number, z: number, h = 7, stairs: 'x+' | 'x-' | 'z+' | 'z-' = 'z+'): number {
  for (const [dx, dz] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) ctx.b.at(x + dx!, z + dz!, 0.4, 0.4, h, 0, { mat: 'metalDark', kind: 'wall' });
  ctx.b.at(x, z, 4, 4, 0.4, h - 0.4, { mat: 'grate', kind: 'floor', surface: 'metal', solid: { block: true } });
  ctx.b.at(x, z - 2, 4, 0.12, 1.0, h, { mat: 'metal', kind: 'cover-low' });
  ctx.b.at(x - 2, z, 0.12, 4, 1.0, h, { mat: 'metal', kind: 'cover-low' });
  ctx.b.at(x + 2, z, 0.12, 4, 1.0, h, { mat: 'metal', kind: 'cover-low' });
  const steps = Math.round(h / 0.4);
  const run = steps * 0.55;
  // stairs climb toward the tower from the named side
  const inv = { 'z+': 'z-', 'z-': 'z+', 'x+': 'x-', 'x-': 'x+' } as const;
  const sx = stairs === 'x+' ? x + 2 + run : stairs === 'x-' ? x - 2 - run : x;
  const sz = stairs === 'z+' ? z + 2 + run : stairs === 'z-' ? z - 2 - run : z;
  ctx.b.stairs(sx, sz, inv[stairs], 1.4, steps, 0.4, 0.55, 0, 'metalDark');
  return h;
}

export function lamp(ctx: LevelContext, x: number, z: number, h = 6, color: number = 0xdfe8ff): void {
  ctx.b.at(x, z, 0.25, 0.25, h, 0, { mat: 'metalDark', kind: 'prop', solid: { mech: false } });
  ctx.b.at(x, z, 0.8, 0.3, 0.2, h, { mat: 'glowWhite', decor: true });
  ctx.light([x, h - 0.4, z], color, 7, 16);
}

export function rocks(ctx: LevelContext, x0: number, z0: number, x1: number, z1: number, n: number, seed: number, hMin = 1.5, hMax = 6): void {
  const r = prng(seed);
  for (let i = 0; i < n; i++) {
    const x = x0 + r() * (x1 - x0), z = z0 + r() * (z1 - z0);
    const w = 2 + r() * 5, d = 2 + r() * 5, h = hMin + r() * (hMax - hMin);
    ctx.b.rock(x, z, w, d, h);
    if (r() < 0.6) ctx.b.rock(x + (r() - 0.5) * w, z + (r() - 0.5) * d, w * 0.6, d * 0.6, h * 0.6, h * 0.8);
  }
}

/** Pipe run (low cover / vault). */
export function pipes(ctx: LevelContext, x: number, z: number, len: number, alongX: boolean, y = 0, h = 0.9): void {
  if (alongX) ctx.b.at(x, z, len, 0.8, h, y, { mat: 'metal', kind: 'cover-low' }); else ctx.b.at(x, z, 0.8, len, h, y, { mat: 'metal', kind: 'cover-low' });
}

/** Fast-route signage (cyan) and long-route marker (white). */
export function routeSigns(ctx: LevelContext, fast: [number, number, number], fastYaw: number, long?: [number, number, number], longYaw = 0): void {
  ctx.sign(fast, fastYaw, PALETTE.cyan, 1.6, 0.25);
  if (long) ctx.sign(long, longYaw, 0xd0d6dc, 1.2, 0.2);
}
