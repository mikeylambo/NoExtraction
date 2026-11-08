import { Emitter } from './Emitter';

export interface SequenceStep<A> {
  /** Seconds from sequence start. */
  at: number;
  action: A;
  /** Essential steps (flags, world changes, spawns) still run when the sequence is skipped. */
  essential?: boolean;
}

export interface SequenceDef<A> {
  id: string;
  steps: SequenceStep<A>[];
  /** Total length; defaults to the last step time. */
  duration?: number;
  skippable?: boolean;
  /** Cinematic sequences take camera/control; non-cinematic ones run alongside play. */
  cinematic?: boolean;
  /** Listed in a replay gallery (chapter select). */
  replayable?: boolean;
  title?: string;
}

export interface RunningSequence<A> { def: SequenceDef<A>; t: number; index: number; replay: boolean }

/**
 * Timelines that drive gameplay events, VO, camera, collapse events and transitions. The director
 * only schedules; the game executes typed actions through `onAction`. Several non-cinematic
 * sequences may run at once; at most one cinematic.
 */
export class SequenceDirector<A> {
  readonly events = new Emitter<{
    start: { id: string; replay: boolean };
    end: { id: string; skipped: boolean; replay: boolean };
  }>();
  private defs = new Map<string, SequenceDef<A>>();
  private running: RunningSequence<A>[] = [];
  private handler: ((action: A, ctx: { sequenceId: string; skipping: boolean; replay: boolean }) => void) | null = null;
  private paused = false;

  register(defs: readonly SequenceDef<A>[]): void {
    for (const d of defs) {
      const steps = [...d.steps].sort((a, b) => a.at - b.at);
      this.defs.set(d.id, { ...d, steps });
    }
  }
  get(id: string): SequenceDef<A> | undefined { return this.defs.get(id); }
  list(): SequenceDef<A>[] { return [...this.defs.values()]; }
  onAction(fn: (action: A, ctx: { sequenceId: string; skipping: boolean; replay: boolean }) => void): void { this.handler = fn; }

  get cinematic(): RunningSequence<A> | null { return this.running.find((r) => r.def.cinematic) ?? null; }
  isRunning(id: string): boolean { return this.running.some((r) => r.def.id === id); }
  get active(): readonly RunningSequence<A>[] { return this.running; }

  play(id: string, opts: { replay?: boolean } = {}): void {
    const def = this.defs.get(id);
    if (!def) throw new Error(`Unknown sequence ${id}`);
    if (this.isRunning(id)) return;
    if (def.cinematic && this.cinematic) this.skip(this.cinematic.def.id);
    const r: RunningSequence<A> = { def, t: 0, index: 0, replay: !!opts.replay };
    this.running.push(r);
    this.events.emit('start', { id, replay: r.replay });
    this.advance(r, 0);
  }

  /** Skip: run every remaining essential step immediately, then end. */
  skip(id?: string): boolean {
    const r = id ? this.running.find((x) => x.def.id === id) : this.cinematic;
    if (!r || r.def.skippable === false) return false;
    while (r.index < r.def.steps.length) {
      const s = r.def.steps[r.index++]!;
      if (s.essential) this.handler?.(s.action, { sequenceId: r.def.id, skipping: true, replay: r.replay });
    }
    this.end(r, true);
    return true;
  }

  stopAll(): void { for (const r of [...this.running]) this.end(r, true); }

  pause(): void { this.paused = true; }
  resume(): void { this.paused = false; }
  get isPaused(): boolean { return this.paused; }

  update(dt: number): void {
    if (this.paused) return;
    for (const r of [...this.running]) this.advance(r, dt);
  }

  private advance(r: RunningSequence<A>, dt: number): void {
    r.t += dt;
    while (r.index < r.def.steps.length && r.def.steps[r.index]!.at <= r.t) {
      const s = r.def.steps[r.index++]!;
      this.handler?.(s.action, { sequenceId: r.def.id, skipping: false, replay: r.replay });
      if (!this.running.includes(r)) return; // an action ended it
    }
    const dur = r.def.duration ?? r.def.steps.at(-1)?.at ?? 0;
    if (r.index >= r.def.steps.length && r.t >= dur) this.end(r, false);
  }

  private end(r: RunningSequence<A>, skipped: boolean): void {
    const i = this.running.indexOf(r);
    if (i < 0) return;
    this.running.splice(i, 1);
    this.events.emit('end', { id: r.def.id, skipped, replay: r.replay });
  }
}

/** "Hold to skip": progress 0..1 while held; fires once at `holdS`. */
export class SkipGate {
  progress = 0;
  constructor(readonly holdS = 1) {}
  update(held: boolean, dt: number): boolean {
    if (!held) { this.progress = 0; return false; }
    const before = this.progress;
    this.progress = Math.min(1, this.progress + dt / this.holdS);
    return before < 1 && this.progress >= 1;
  }
  reset(): void { this.progress = 0; }
}
