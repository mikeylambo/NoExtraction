import type { StoryChapter, SequenceDef } from '@slu/narrative';
import type { StoryAction } from './Actions';
import type { World } from '../game/World';
import type { Session } from '../game/Session';

export interface ScriptContext {
  w: World;
  session: Session;
  /** Play a registered sequence. */
  play(id: string): void;
  /** Advance the story graph (optionally to a named beat). */
  beat(id?: string): void;
  objective(text: string, at?: [number, number, number]): void;
  checkpoint(id: string): void;
  say(...ids: string[]): void;
  once(flag: string): boolean;
  trigger(id: string, min: [number, number, number], max: [number, number, number], fn: () => void, when?: string): void;
}

/** A chapter's story: beats (StoryGraph), sequences, and the setup that wires triggers/listeners. */
export interface ChapterScript {
  chapter: StoryChapter;
  sequences: SequenceDef<StoryAction>[];
  /** Named hooks callable from sequences via { kind: 'call' }. */
  hooks?: Record<string, (ctx: ScriptContext, arg?: unknown) => void>;
  setup(ctx: ScriptContext): void;
  /** Sequence that opens the chapter on a fresh start (not on checkpoint restore). */
  intro?: string;
}
