import type { Speaker, VoiceLine } from '@slu/narrative';
import { CSS } from '../palette';

export const SPEAKERS: Speaker[] = [
  { id: 'ballast', label: 'BALLAST', color: CSS.cyan, channel: 'live' },
  { id: 'wren', label: 'AVA', color: CSS.amber, channel: 'radio' },
  { id: 'halcyon', label: 'HALCYON SYSTEMS', color: '#c8d3dc', channel: 'pa' },
  { id: 'sable', label: 'SABLE', color: CSS.red, channel: 'live' },
  { id: 'marshal', label: 'THE MARSHAL', color: CSS.red, channel: 'radio' },
  { id: 'aegis', label: 'AEGIS-07', color: CSS.signal, channel: 'system' },
];

/** Priority bands. */
export const P = { bark: 10, recording: 40, reply: 45, story: 50, marshal: 55, aegis: 58, broadcast: 60, critical: 80 } as const;

/** Line helper: id, speaker, text, priority, performance note. File path follows the delivery doc. */
export function L(id: string, speaker: string, text: string, priority: number, note?: string, extra: Partial<VoiceLine> = {}): VoiceLine {
  return { id, speaker, text, priority, file: `assets/vo/${speaker}/${id}.ogg`, note, ...extra };
}
