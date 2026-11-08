import type { WorldState, FlagValue } from './WorldState';

/** A flag name (truthy test), a comparison, or a boolean combination. */
export type Condition =
  | string
  | { flag: string; eq?: FlagValue; gte?: number; lte?: number }
  | { change: string }
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition };

export function evaluate(c: Condition | undefined, w: WorldState): boolean {
  if (c === undefined) return true;
  if (typeof c === 'string') return w.has(c);
  if ('all' in c) return c.all.every((x) => evaluate(x, w));
  if ('any' in c) return c.any.some((x) => evaluate(x, w));
  if ('not' in c) return !evaluate(c.not, w);
  if ('change' in c) return w.applied(c.change);
  const v = w.get(c.flag);
  if (c.eq !== undefined) return v === c.eq;
  if (c.gte !== undefined) return typeof v === 'number' && v >= c.gte;
  if (c.lte !== undefined) return typeof v === 'number' && v <= c.lte;
  return w.has(c.flag);
}
