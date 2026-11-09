/** Typed actions that sequences schedule and the story runner executes. */
export interface PoseSpec { p: [number, number, number]; t: [number, number, number]; fov?: number }
export interface ShotSpec { id: string; duration: number; from: PoseSpec | 'gameplay' | string; to?: PoseSpec | string; ease?: 'linear' | 'in' | 'out' | 'inOut'; blendIn?: number; shake?: number; letterbox?: number }

export type StoryAction =
  | { kind: 'line'; id: string; channel?: 'story' | 'recording' | 'bark' }
  | { kind: 'lines'; ids: string[]; channel?: 'story' | 'recording' }
  | { kind: 'shots'; shots: ShotSpec[]; blendOut?: number }
  | { kind: 'flag'; key: string; value?: boolean | number | string }
  | { kind: 'core'; pct: number }
  | { kind: 'collapse'; id: string }
  | { kind: 'objective'; text: string; at?: [number, number, number] }
  | { kind: 'beat'; id?: string }
  | { kind: 'checkpoint'; id: string }
  | { kind: 'zone'; id: string; op: 'start' | 'stop' | 'complete' }
  | { kind: 'music'; cue: string | null }
  | { kind: 'sfx'; id: string; at?: [number, number, number] }
  | { kind: 'call'; fn: string; arg?: unknown }
  | { kind: 'endChapter' }
  | { kind: 'control'; locked: boolean }
  | { kind: 'prompt'; text: string; seconds?: number }
  | { kind: 'shake'; amount: number }
  | { kind: 'caption'; text: string; seconds?: number }
  | { kind: 'fade'; to: number; seconds: number }
  | { kind: 'mix'; preset: 'normal' | 'silence' | 'duckAll' };
