import { Emitter } from './Emitter';

export type FlagValue = boolean | number | string;
export interface WorldStateSnapshot {
  flags: Record<string, FlagValue>;
  changes: string[];
  collapsePhase: number;
  coreStability: number;
}

/**
 * Persistent world facts: story flags, permanent world changes (a collapsed bridge stays collapsed),
 * the collapse phase and the planetary Core Stability value. Everything here is serialisable.
 */
export class WorldState {
  readonly events = new Emitter<{
    flag: { key: string; value: FlagValue | undefined };
    change: { id: string };
    core: { value: number };
    phase: { value: number };
  }>();
  private flags = new Map<string, FlagValue>();
  private changes = new Set<string>();
  private _phase = 0;
  private _core = 100;

  get(key: string): FlagValue | undefined { return this.flags.get(key); }
  has(key: string): boolean { const v = this.flags.get(key); return v !== undefined && v !== false && v !== 0 && v !== ''; }
  num(key: string, fallback = 0): number { const v = this.flags.get(key); return typeof v === 'number' ? v : fallback; }
  set(key: string, value: FlagValue = true): void {
    if (this.flags.get(key) === value) return;
    this.flags.set(key, value);
    this.events.emit('flag', { key, value });
  }
  add(key: string, amount = 1): number { const v = this.num(key) + amount; this.set(key, v); return v; }
  unset(key: string): void { if (this.flags.delete(key)) this.events.emit('flag', { key, value: undefined }); }

  /** Record a permanent world change (idempotent). Returns false if it had already happened. */
  apply(changeId: string): boolean {
    if (this.changes.has(changeId)) return false;
    this.changes.add(changeId);
    this.events.emit('change', { id: changeId });
    return true;
  }
  applied(changeId: string): boolean { return this.changes.has(changeId); }
  appliedList(): string[] { return [...this.changes]; }

  get collapsePhase(): number { return this._phase; }
  set collapsePhase(v: number) { if (v !== this._phase) { this._phase = v; this.events.emit('phase', { value: v }); } }
  get coreStability(): number { return this._core; }
  set coreStability(v: number) { const c = Math.max(0, Math.min(100, v)); if (c !== this._core) { this._core = c; this.events.emit('core', { value: c }); } }

  snapshot(): WorldStateSnapshot {
    return { flags: Object.fromEntries(this.flags), changes: [...this.changes], collapsePhase: this._phase, coreStability: this._core };
  }
  hydrate(s: WorldStateSnapshot): void {
    this.flags = new Map(Object.entries(s.flags));
    this.changes = new Set(s.changes);
    this._phase = s.collapsePhase;
    this._core = s.coreStability;
  }
  reset(): void { this.flags.clear(); this.changes.clear(); this._phase = 0; this._core = 100; }
}
