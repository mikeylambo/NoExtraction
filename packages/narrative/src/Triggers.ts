import { evaluate, type Condition } from './Conditions';
import type { WorldState } from './WorldState';
import type { Vec3 } from './Emitter';

export type TriggerShape =
  | { kind: 'box'; min: Vec3; max: Vec3 }
  | { kind: 'sphere'; center: Vec3; radius: number };

export interface TriggerDef {
  id: string;
  shape: TriggerShape;
  /** Only armed while this holds. */
  when?: Condition;
  /** Fires once (default) or every entry. */
  once?: boolean;
  onEnter?: () => void;
  onExit?: () => void;
}

export function inside(shape: TriggerShape, p: Vec3): boolean {
  if (shape.kind === 'sphere') return Math.hypot(p.x - shape.center.x, p.y - shape.center.y, p.z - shape.center.z) <= shape.radius;
  return p.x >= shape.min.x && p.x <= shape.max.x && p.y >= shape.min.y && p.y <= shape.max.y && p.z >= shape.min.z && p.z <= shape.max.z;
}

/** Volumes + conditions that fire story sequences. Fired state is checkpointed. */
export class TriggerSystem {
  private defs = new Map<string, TriggerDef>();
  private insideSet = new Set<string>();
  private fired = new Set<string>();

  constructor(private readonly world: WorldState) {}

  add(def: TriggerDef): void { this.defs.set(def.id, def); }
  remove(id: string): void { this.defs.delete(id); this.insideSet.delete(id); }
  clear(): void { this.defs.clear(); this.insideSet.clear(); this.fired.clear(); }
  list(): TriggerDef[] { return [...this.defs.values()]; }
  hasFired(id: string): boolean { return this.fired.has(id); }
  /** Fire a trigger by id regardless of position (dev tools, bot). */
  force(id: string): boolean { const d = this.defs.get(id); if (!d) return false; this.fired.add(id); d.onEnter?.(); return true; }

  update(p: Vec3): void {
    for (const d of this.defs.values()) {
      const once = d.once !== false;
      if (once && this.fired.has(d.id)) continue;
      const armed = evaluate(d.when, this.world);
      const isIn = armed && inside(d.shape, p);
      const was = this.insideSet.has(d.id);
      if (isIn && !was) { this.insideSet.add(d.id); this.fired.add(d.id); d.onEnter?.(); }
      else if (!isIn && was) { this.insideSet.delete(d.id); d.onExit?.(); }
    }
  }

  snapshot(): string[] { return [...this.fired]; }
  hydrate(fired: readonly string[]): void { this.fired = new Set(fired); this.insideSet.clear(); }
}
