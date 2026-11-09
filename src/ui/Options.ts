import type { GameOptions } from '../../data/options';
import type { CoreSettings } from '@slu/web-shell';
import type { UIChoice } from '@slu/web-shell';

export type AllSettings = CoreSettings & GameOptions;

interface OptDef { id: keyof AllSettings; label: string; kind: 'cycle' | 'slider' | 'bool'; values?: readonly (string | number)[]; min?: number; max?: number; step?: number; fmt?: (v: unknown) => string; page: 'gameplay' | 'controls' | 'accessibility' | 'audio' | 'video' }

const pct = (v: unknown) => `${Math.round(Number(v) * 100)}%`;
/** Every option from GDD §15. Each visibly changes something (see DECISIONS.md, options audit). */
export const OPTION_DEFS: OptDef[] = [
  { id: 'difficulty', label: 'Difficulty', kind: 'cycle', values: ['story', 'normal', 'hard'], page: 'gameplay', fmt: (v) => String(v).replace(/^./, (c) => c.toUpperCase()) },
  { id: 'timedZoneAssist', label: 'Timed Zone assist (+50% time)', kind: 'bool', page: 'gameplay' },
  { id: 'aimAssist', label: 'Aim assist', kind: 'slider', min: 0, max: 1, step: 0.25, page: 'gameplay', fmt: pct },
  { id: 'sprintMode', label: 'Sprint', kind: 'cycle', values: ['hold', 'toggle'], page: 'controls' },
  { id: 'aimMode', label: 'Aim', kind: 'cycle', values: ['hold', 'toggle'], page: 'controls' },
  { id: 'crouchMode', label: 'Crouch', kind: 'cycle', values: ['hold', 'toggle'], page: 'controls' },
  { id: 'mouseSensitivity', label: 'Mouse sensitivity', kind: 'slider', min: 0.25, max: 3, step: 0.25, page: 'controls', fmt: (v) => `${Number(v).toFixed(2)}×` },
  { id: 'padSensitivity', label: 'Stick sensitivity', kind: 'slider', min: 0.25, max: 3, step: 0.25, page: 'controls', fmt: (v) => `${Number(v).toFixed(2)}×` },
  { id: 'invertY', label: 'Invert Y', kind: 'bool', page: 'controls' },
  { id: 'subtitles', label: 'Subtitles', kind: 'bool', page: 'accessibility' },
  { id: 'subtitleSize', label: 'Subtitle size', kind: 'cycle', values: ['small', 'medium', 'large', 'xl'], page: 'accessibility' },
  { id: 'subtitleBackground', label: 'Subtitle background', kind: 'slider', min: 0, max: 1, step: 0.25, page: 'accessibility', fmt: pct },
  { id: 'speakerColors', label: 'Speaker colours', kind: 'bool', page: 'accessibility' },
  { id: 'captions', label: 'Caption descriptions', kind: 'bool', page: 'accessibility' },
  { id: 'colorblind', label: 'Colourblind mode', kind: 'cycle', values: ['off', 'protan', 'deutan', 'tritan'], page: 'accessibility' },
  { id: 'reduceShake', label: 'Screen shake', kind: 'slider', min: 0, max: 1, step: 0.25, page: 'accessibility', fmt: pct },
  { id: 'reduceBlur', label: 'Reduce blur', kind: 'bool', page: 'accessibility' },
  { id: 'reduceFlashes', label: 'Reduce flashes', kind: 'bool', page: 'accessibility' },
  { id: 'masterVolume', label: 'Master', kind: 'slider', min: 0, max: 1, step: 0.1, page: 'audio', fmt: pct },
  { id: 'musicVolume', label: 'Music', kind: 'slider', min: 0, max: 1, step: 0.1, page: 'audio', fmt: pct },
  { id: 'sfxVolume', label: 'SFX', kind: 'slider', min: 0, max: 1, step: 0.1, page: 'audio', fmt: pct },
  { id: 'voVolume', label: 'Voice', kind: 'slider', min: 0, max: 1, step: 0.1, page: 'audio', fmt: pct },
  { id: 'fov', label: 'Field of view', kind: 'slider', min: 60, max: 100, step: 5, page: 'video', fmt: (v) => `${v}°` },
  { id: 'fullscreen', label: 'Fullscreen', kind: 'bool', page: 'video' },
];

export function optionChoices(page: OptDef['page'], s: AllSettings): UIChoice[] {
  return OPTION_DEFS.filter((d) => d.page === page).map((d) => {
    const v = s[d.id];
    const shown = d.kind === 'bool' ? (v ? 'On' : 'Off') : d.fmt ? d.fmt(v) : String(v);
    return { id: `opt:${String(d.id)}`, label: `${d.label}`, description: `◀  ${shown}  ▶` };
  });
}

/** Step an option by ±1 (accept = +1). Returns the patch. */
export function stepOption(id: string, dir: number, s: AllSettings): Partial<AllSettings> | null {
  const d = OPTION_DEFS.find((x) => `opt:${String(x.id)}` === id); if (!d) return null;
  const v = s[d.id];
  if (d.kind === 'bool') return { [d.id]: !v } as Partial<AllSettings>;
  if (d.kind === 'cycle') { const vals = d.values!; const i = vals.indexOf(v as never); return { [d.id]: vals[(i + dir + vals.length) % vals.length] } as Partial<AllSettings>; }
  const n = Math.min(d.max!, Math.max(d.min!, Math.round((Number(v) + dir * d.step!) / d.step!) * d.step!));
  return { [d.id]: +n.toFixed(3) } as Partial<AllSettings>;
}
