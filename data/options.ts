import type { ColorblindMode } from './palette';
import type { DifficultyId } from './enemies';
import type { SubtitleSize } from '@slu/narrative';

/** Options defaults — GDD §15. Stored through the shell SettingsStore alongside CoreSettings. */
export interface GameOptions {
  difficulty: DifficultyId;
  sprintMode: 'hold' | 'toggle';
  aimMode: 'hold' | 'toggle';
  crouchMode: 'hold' | 'toggle';
  aimAssist: number;
  mouseSensitivity: number;
  padSensitivity: number;
  invertY: boolean;
  fov: number;
  subtitles: boolean;
  subtitleSize: SubtitleSize;
  subtitleBackground: number;
  speakerColors: boolean;
  captions: boolean;
  colorblind: ColorblindMode;
  reduceShake: number;
  reduceBlur: boolean;
  reduceFlashes: boolean;
  timedZoneAssist: boolean;
  voVolume: number;
  ambienceVolume: number;
  bindings: Record<string, { keys: string[]; mouse: number[]; pad: number[] }>;
}

export const DEFAULT_OPTIONS: GameOptions = {
  difficulty: 'normal',
  sprintMode: 'hold',
  aimMode: 'hold',
  crouchMode: 'toggle',
  aimAssist: 0.5,
  mouseSensitivity: 1,
  padSensitivity: 1,
  invertY: false,
  fov: 70,
  subtitles: true,
  subtitleSize: 'medium',
  subtitleBackground: 0.55,
  speakerColors: true,
  captions: true,
  colorblind: 'off',
  reduceShake: 1,
  reduceBlur: false,
  reduceFlashes: false,
  timedZoneAssist: false,
  voVolume: 1,
  ambienceVolume: 0.8,
  bindings: {},
};
