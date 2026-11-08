import { evaluate, type Condition } from './Conditions';
import type { WorldState } from './WorldState';

export interface Speaker {
  id: string;
  /** Subtitle label. */
  label: string;
  /** Subtitle speaker colour (CSS). */
  color: string;
  /** Presentation hint: 'radio' lines get a radio filter / chirp. */
  channel?: 'live' | 'radio' | 'recording' | 'system' | 'pa';
}

export interface VoiceTake { file: string; when: Condition; text?: string }

export interface VoiceLine {
  id: string;
  speaker: string;
  text: string;
  /** Higher interrupts lower (see DialogueDirector). */
  priority: number;
  /** Asset path. Missing files fall back to subtitle-only timed playback. */
  file: string;
  /** Authored/measured duration; otherwise estimated from text. */
  durationMs?: number;
  /** Alternate takes, first matching condition wins. */
  alt?: VoiceTake[];
  /** Performance/context notes for the recording session. */
  note?: string;
  /** Caption description for deaf/HoH players, e.g. "[static]". */
  caption?: string;
}

export interface ResolvedLine extends VoiceLine { take: string; durationMs: number }

/** Reading-speed estimate used when no audio exists: ~2.7 words/s plus a lead-in, min 1.4 s. */
export function estimateDurationMs(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const pauses = (text.match(/[.,;:!?…—]/g) ?? []).length;
  return Math.max(1400, Math.round(450 + words * 370 + pauses * 120));
}

/** VO registry: speakers, lines, alternate takes and subtitle timing. */
export class VoiceTrack {
  private lines = new Map<string, VoiceLine>();
  private speakers = new Map<string, Speaker>();
  private measured = new Map<string, number>();

  constructor(private readonly world?: WorldState) {}

  addSpeakers(list: readonly Speaker[]): void { for (const s of list) this.speakers.set(s.id, { ...s }); }
  add(list: readonly VoiceLine[]): void {
    for (const l of list) {
      if (this.lines.has(l.id)) throw new Error(`Duplicate voice line ${l.id}`);
      if (!this.speakers.has(l.speaker)) throw new Error(`Line ${l.id} has unknown speaker ${l.speaker}`);
      this.lines.set(l.id, structuredClone(l));
    }
  }
  speaker(id: string): Speaker | undefined { return this.speakers.get(id); }
  get(id: string): VoiceLine | undefined { return this.lines.get(id); }
  has(id: string): boolean { return this.lines.has(id); }
  list(): VoiceLine[] { return [...this.lines.values()]; }
  /** Record a real audio duration once a file has decoded. */
  setMeasured(file: string, ms: number): void { this.measured.set(file, ms); }

  resolve(id: string): ResolvedLine {
    const l = this.lines.get(id);
    if (!l) throw new Error(`Unknown voice line ${id}`);
    let take = l.file; let text = l.text;
    if (l.alt && this.world) for (const a of l.alt) if (evaluate(a.when, this.world)) { take = a.file; text = a.text ?? l.text; break; }
    const durationMs = this.measured.get(take) ?? l.durationMs ?? estimateDurationMs(text);
    return { ...l, text, take, durationMs };
  }

  /** Lint: every line has id, speaker, text, priority, file. */
  validate(): string[] {
    const issues: string[] = [];
    for (const l of this.lines.values()) {
      if (!l.text.trim()) issues.push(`${l.id}: empty text`);
      if (!l.file) issues.push(`${l.id}: no file path`);
      if (!Number.isFinite(l.priority)) issues.push(`${l.id}: no priority`);
    }
    return issues;
  }
}
