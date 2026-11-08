import { Emitter } from './Emitter';
import type { ResolvedLine, VoiceTrack } from './VoiceTrack';

export type DialogueChannel = 'story' | 'recording' | 'bark';

export interface PlayingLine {
  readonly handle: number;
  readonly line: ResolvedLine;
  readonly channel: DialogueChannel;
  elapsedMs: number;
  durationMs: number;
  /** Bark currently ducked under a primary line. */
  ducked: boolean;
  onEnd?: (completed: boolean) => void;
}

export interface SayOptions {
  channel?: DialogueChannel;
  /** May a higher-priority line cut this one off? Recordings are never interrupted by recordings. */
  interruptible?: boolean;
  /** Bark cooldown key (defaults to the line id). */
  cooldownKey?: string;
  onEnd?: (completed: boolean) => void;
}

export interface DialogueRules {
  /** Seconds before the same bark key may repeat. */
  barkCooldownS: number;
  /** dB applied to barks while a recording plays. */
  recordingDuckDb: number;
  /** dB applied to barks while any story VO plays. */
  storyDuckDb: number;
  /** Max queued primary lines (oldest lowest-priority dropped beyond this). */
  maxQueue: number;
}

export const DEFAULT_DIALOGUE_RULES: DialogueRules = { barkCooldownS: 90, recordingDuckDb: -12, storyDuckDb: -12, maxQueue: 24 };

interface Queued { line: ResolvedLine; channel: DialogueChannel; opts: SayOptions; order: number }

/**
 * Priority, interruption, queuing, ducking and bark cooldowns.
 *
 * Rules:
 * - One primary voice at a time (story VO and recordings). Barks play on their own slot.
 * - A new primary line with higher priority interrupts an interruptible current line; otherwise it
 *   queues (priority first, then arrival order). A recording is never interrupted by another
 *   recording: the current one finishes first.
 * - Barks never play over primary VO: while primary VO plays they are ducked (dB from rules).
 *   A bark is dropped if the bark slot is busy or its cooldown key fired within `barkCooldownS`.
 * - The director only keeps time. Audio playback subscribes to `start`/`stop` events.
 */
export class DialogueDirector {
  readonly events = new Emitter<{
    start: PlayingLine;
    stop: { line: PlayingLine; completed: boolean };
    duck: { db: number };
    dropped: { lineId: string; reason: 'cooldown' | 'busy' | 'queue-full' };
  }>();
  primary: PlayingLine | null = null;
  bark: PlayingLine | null = null;
  private queue: Queued[] = [];
  private cooldowns = new Map<string, number>();
  private clockS = 0;
  private handles = 1;
  private order = 0;
  private paused = false;
  private duckDb = 0;

  constructor(private readonly voice: VoiceTrack, readonly rules: DialogueRules = DEFAULT_DIALOGUE_RULES) {}

  get time(): number { return this.clockS; }
  get busy(): boolean { return !!this.primary || this.queue.length > 0; }
  get queued(): readonly string[] { return this.queue.map((q) => q.line.id); }

  say(lineId: string, opts: SayOptions = {}): number | null {
    const line = this.voice.resolve(lineId);
    const channel = opts.channel ?? 'story';
    if (channel === 'bark') return this.playBark(line, opts);
    const cur = this.primary;
    if (!cur) return this.start(line, channel, opts).handle;
    const curInterruptible = cur.channel === 'recording' ? channel !== 'recording' && line.priority > cur.line.priority : (curOpts(cur) ?? true);
    if (line.priority > cur.line.priority && curInterruptible) {
      this.finish(cur, false);
      return this.start(line, channel, opts).handle;
    }
    if (this.queue.length >= this.rules.maxQueue) {
      this.queue.sort(byPriority);
      const drop = this.queue.pop()!;
      this.events.emit('dropped', { lineId: drop.line.id, reason: 'queue-full' });
    }
    this.queue.push({ line, channel, opts, order: this.order++ });
    this.queue.sort(byPriority);
    return null;
  }

  /** Queue several lines in order (a conversation). */
  sayAll(lineIds: readonly string[], opts: SayOptions = {}): void {
    for (const id of lineIds) {
      const line = this.voice.resolve(id);
      if (!this.primary && this.queue.length === 0) this.start(line, opts.channel ?? 'story', opts);
      else this.queue.push({ line, channel: opts.channel ?? 'story', opts, order: this.order++ });
    }
    this.queue.sort(byPriority);
  }

  private playBark(line: ResolvedLine, opts: SayOptions): number | null {
    const key = opts.cooldownKey ?? line.id;
    const last = this.cooldowns.get(key);
    if (last !== undefined && this.clockS - last < this.rules.barkCooldownS) { this.events.emit('dropped', { lineId: line.id, reason: 'cooldown' }); return null; }
    if (this.bark) { this.events.emit('dropped', { lineId: line.id, reason: 'busy' }); return null; }
    this.cooldowns.set(key, this.clockS);
    const p: PlayingLine = { handle: this.handles++, line, channel: 'bark', elapsedMs: 0, durationMs: line.durationMs, ducked: !!this.primary, onEnd: opts.onEnd };
    this.bark = p;
    this.events.emit('start', p);
    return p.handle;
  }

  /** Is a bark key cooling down? */
  coolingDown(key: string): boolean { const t = this.cooldowns.get(key); return t !== undefined && this.clockS - t < this.rules.barkCooldownS; }

  private start(line: ResolvedLine, channel: DialogueChannel, opts: SayOptions): PlayingLine {
    const p: PlayingLine & { interruptible?: boolean } = { handle: this.handles++, line, channel, elapsedMs: 0, durationMs: line.durationMs, ducked: false, onEnd: opts.onEnd };
    p.interruptible = opts.interruptible ?? channel === 'story';
    this.primary = p;
    if (this.bark) this.bark.ducked = true;
    this.events.emit('start', p);
    this.syncDuck();
    return p;
  }

  private finish(p: PlayingLine, completed: boolean): void {
    if (this.primary === p) this.primary = null;
    if (this.bark === p) this.bark = null;
    this.events.emit('stop', { line: p, completed });
    p.onEnd?.(completed);
    this.syncDuck();
  }

  private syncDuck(): void {
    const db = this.primary ? (this.primary.channel === 'recording' ? this.rules.recordingDuckDb : this.rules.storyDuckDb) : 0;
    if (this.bark) this.bark.ducked = db !== 0;
    if (db !== this.duckDb) { this.duckDb = db; this.events.emit('duck', { db }); }
  }

  /** Current bark duck, dB. */
  get barkDuckDb(): number { return this.duckDb; }

  /** Override a playing line's length once real audio is known. */
  setDuration(handle: number, ms: number): void {
    for (const p of [this.primary, this.bark]) if (p && p.handle === handle) p.durationMs = ms;
  }

  stopAll(): void {
    this.queue = [];
    if (this.primary) this.finish(this.primary, false);
    if (this.bark) this.finish(this.bark, false);
  }
  /** Drop queued lines matching a predicate (e.g. on chapter exit). */
  flush(pred: (lineId: string) => boolean = () => true): void { this.queue = this.queue.filter((q) => !pred(q.line.id)); }
  stop(handle: number): void { for (const p of [this.primary, this.bark]) if (p && p.handle === handle) this.finish(p, false); }

  pause(): void { this.paused = true; }
  resume(): void { this.paused = false; }
  get isPaused(): boolean { return this.paused; }

  tick(dtS: number): void {
    if (this.paused || dtS <= 0) return;
    this.clockS += dtS;
    const ms = dtS * 1000;
    if (this.bark) { this.bark.elapsedMs += ms; if (this.bark.elapsedMs >= this.bark.durationMs) this.finish(this.bark, true); }
    if (this.primary) { this.primary.elapsedMs += ms; if (this.primary.elapsedMs >= this.primary.durationMs) this.finish(this.primary, true); }
    if (!this.primary && this.queue.length) { const q = this.queue.shift()!; this.start(q.line, q.channel, q.opts); }
  }
}

function curOpts(p: PlayingLine): boolean | undefined { return (p as PlayingLine & { interruptible?: boolean }).interruptible; }
function byPriority(a: Queued, b: Queued): number { return b.line.priority - a.line.priority || a.order - b.order; }
