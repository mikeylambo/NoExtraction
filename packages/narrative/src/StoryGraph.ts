import { Emitter } from './Emitter';
import { evaluate, type Condition } from './Conditions';
import type { WorldState } from './WorldState';

export interface StoryBeat {
  id: string;
  /** Beat may only be entered when this holds. */
  requires?: Condition;
  /** Entering this beat creates a checkpoint. */
  checkpoint?: boolean;
  /** Flags set on entering the beat. */
  sets?: Record<string, boolean | number | string>;
  /** Free data for the game (objective text, spawn points...). */
  data?: Record<string, unknown>;
}
export interface StoryChapter { id: string; title: string; beats: StoryBeat[] }
export interface StoryGraphSnapshot { chapterId: string | null; beatId: string | null; completed: string[] }

/**
 * Chapters → ordered beats → flags & conditions. The graph owns "where are we in the story"; it does
 * not own gameplay. Beats advance forward (or jump, for dev tools and chapter select).
 */
export class StoryGraph {
  readonly events = new Emitter<{
    'beat:enter': { chapterId: string; beat: StoryBeat; index: number };
    'beat:exit': { chapterId: string; beat: StoryBeat };
    'chapter:enter': { chapter: StoryChapter };
    'chapter:complete': { chapter: StoryChapter };
  }>();
  private chapters = new Map<string, StoryChapter>();
  private order: string[] = [];
  private chapterId: string | null = null;
  private beatIndex = -1;
  private completed = new Set<string>();

  constructor(private readonly world: WorldState) {}

  register(chapters: readonly StoryChapter[]): void {
    for (const c of chapters) {
      if (this.chapters.has(c.id)) throw new Error(`Duplicate chapter ${c.id}`);
      const ids = new Set<string>();
      for (const b of c.beats) { if (ids.has(b.id)) throw new Error(`Duplicate beat ${c.id}/${b.id}`); ids.add(b.id); }
      this.chapters.set(c.id, structuredClone(c));
      this.order.push(c.id);
    }
  }

  get chapter(): StoryChapter | null { return this.chapterId ? this.chapters.get(this.chapterId) ?? null : null; }
  get beat(): StoryBeat | null { return this.chapter?.beats[this.beatIndex] ?? null; }
  get beatId(): string | null { return this.beat?.id ?? null; }
  chapterList(): StoryChapter[] { return this.order.map((id) => this.chapters.get(id)!); }
  isComplete(key: string): boolean { return this.completed.has(key); }

  startChapter(id: string, beatId?: string): void {
    const c = this.chapters.get(id);
    if (!c) throw new Error(`Unknown chapter ${id}`);
    this.chapterId = id;
    this.beatIndex = -1;
    this.events.emit('chapter:enter', { chapter: c });
    this.goto(beatId ?? c.beats[0]!.id, true);
  }

  /** Advance to the next beat (or a named later beat). Returns false if the requirement fails. */
  advance(toBeatId?: string): boolean {
    const c = this.chapter; if (!c) return false;
    const target = toBeatId ?? c.beats[this.beatIndex + 1]?.id;
    if (!target) { this.completeChapter(); return true; }
    return this.goto(target, false);
  }

  /** Jump (dev / chapter select / checkpoint restore). Skips requirement checks when forced. */
  goto(beatId: string, force: boolean): boolean {
    const c = this.chapter; if (!c) return false;
    const i = c.beats.findIndex((b) => b.id === beatId);
    if (i < 0) throw new Error(`Unknown beat ${c.id}/${beatId}`);
    const b = c.beats[i]!;
    if (!force && !evaluate(b.requires, this.world)) return false;
    const prev = this.beat;
    if (prev) { this.completed.add(`${c.id}/${prev.id}`); this.events.emit('beat:exit', { chapterId: c.id, beat: prev }); }
    this.beatIndex = i;
    for (const [k, v] of Object.entries(b.sets ?? {})) this.world.set(k, v);
    this.events.emit('beat:enter', { chapterId: c.id, beat: b, index: i });
    return true;
  }

  completeChapter(): void {
    const c = this.chapter; if (!c) return;
    const b = this.beat; if (b) this.completed.add(`${c.id}/${b.id}`);
    this.completed.add(c.id);
    this.events.emit('chapter:complete', { chapter: c });
  }

  next(chapterId: string): string | null { const i = this.order.indexOf(chapterId); return this.order[i + 1] ?? null; }

  snapshot(): StoryGraphSnapshot { return { chapterId: this.chapterId, beatId: this.beatId, completed: [...this.completed] }; }
  /** Restore without emitting enter events (the game re-applies world state itself). */
  hydrate(s: StoryGraphSnapshot): void {
    this.chapterId = s.chapterId;
    this.completed = new Set(s.completed);
    const c = this.chapter;
    this.beatIndex = c && s.beatId ? c.beats.findIndex((b) => b.id === s.beatId) : -1;
  }
}
