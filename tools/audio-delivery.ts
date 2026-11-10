// Generates AUDIO_DELIVERY.md from the VO/SFX/music tables. Run: npx tsx tools/audio-delivery.ts
import fs from 'node:fs';
import { LINES_BY_CHAPTER, SPEAKERS } from '../data/story';
import { SFX, MUSIC } from '../data/audio';
import { estimateDurationMs } from '../packages/narrative/src/VoiceTrack';

const order = ['ballast', 'wren', 'aegis', 'marshal', 'halcyon', 'sable'];
const chapters: [string, string][] = [['ch1', 'Chapter 1 — The Job'], ['ch2', 'Chapter 2 — Left Behind'], ['ch3', 'Chapter 3 — Dead Colony'], ['ch4', 'Chapter 4 — Under the Ice'], ['ch5', 'Chapter 5 — Flamingo'], ['ch6', 'Chapter 6 — Ascent'], ['sable', 'Sable barks (all chapters)']];
const esc = (s: string) => s.replace(/\|/g, '\\|');
let md = `# NO EXTRACTION — Audio Delivery\n\nEverything to record or produce. Generated from \`data/story/*.ts\` and \`data/audio.ts\` by \`npx tsx tools/audio-delivery.ts\` — edit the data, not this file.\n\n`;
md += `**Formats:** mono 48 kHz WAV masters; deliver OGG (q6) at the listed path. A file at a listed path replaces the fallback with no code change (missing VO plays as timed subtitles; missing SFX/music use the synth stand-ins).\n\n**Target length** for VO is the reading-time estimate the game currently uses; matching it within ±30% keeps subtitle timing natural (the game re-times to the real file automatically).\n\n`;
const allLines = Object.entries(LINES_BY_CHAPTER).flatMap(([ch, ls]) => ls.map((l) => ({ ...l, ch })));
md += `**Totals:** ${allLines.length} VO lines · ${SFX.length} SFX · ${MUSIC.length} music cues.\n\n`;
md += `## Voice — by speaker, then chapter\n\n`;
for (const sp of order) {
  const s = SPEAKERS.find((x) => x.id === sp)!;
  const mine = allLines.filter((l) => l.speaker === sp);
  md += `### ${s.label} (${mine.length} lines)\n\n`;
  if (sp === 'ballast') md += `Michael. Dry, professional, then furious, then focused. Helmeted throughout: slight helmet resonance is fine; no radio filter on his own lines.\n\n`;
  if (sp === 'wren') md += `Live radio in Chapter 1 only (band-limited radio). Every cache line is a recording made before she lifted off — steady, rehearsed, fragile underneath. Last line of the game is live again.\n\n`;
  if (sp === 'halcyon') md += `Automated evacuation broadcast. Calm, polite, corporate. Bleakly funny because it is played straight.\n\n`;
  if (sp === 'sable') md += `Designed voices. Barks are about their own evacuation — never comic, occasionally human. 2–3 performers; any line may be used by any trooper.\n\n`;
  for (const [ch, title] of chapters) {
    const ls = mine.filter((l) => l.ch === ch); if (!ls.length) continue;
    md += `#### ${title}\n\n| ID | Line | Context / performance | Target | File |\n|---|---|---|---|---|\n`;
    for (const l of ls) {
      md += `| \`${l.id}\` | ${esc(l.text)} | ${esc(l.note ?? '')} | ${(estimateDurationMs(l.text) / 1000).toFixed(1)} s | \`${l.file}\` |\n`;
      for (const a of l.alt ?? []) md += `| \`${l.id}\` (alt) | ${esc(a.text ?? l.text)} | Alternate warmer take, used when ${typeof a.when === 'string' ? a.when : 'condition'} | ${(estimateDurationMs(l.text) / 1000).toFixed(1)} s | \`${a.file}\` |\n`;
    }
    md += `\n`;
  }
}
md += `## SFX\n\n| ID | Category | Description | Length | Bus | File |\n|---|---|---|---|---|---|\n`;
for (const s of SFX) md += `| \`${s.id}\` | ${s.category} | ${esc(s.note)} | ${s.lengthS} s | ${s.bus} | \`${s.file}\` |\n`;
md += `\n## Music cues\n\n| ID | Use | Length | Loop | File |\n|---|---|---|---|---|\n`;
for (const m of MUSIC) md += `| \`${m.id}\` | ${esc(m.use)} | ${m.lengthS} s | ${m.loop ? 'yes' : 'no'} | \`${m.file}\` |\n`;
md += `\n### Adaptive stems\n\nThe infiltration bed carries three additive stems driven by the alert ladder: **suspicion** (tension), **hunted** (full percussion), **lockdown** (siren-synced rhythm). Deliver \`infiltration\`, \`suspicion\`, \`hunted\` and \`lockdown\` as separate loops of identical length and tempo (paths above); the engine starts them on the same clock and fades the stems with the alert level. The Timed Zone cue accelerates at 30 s and 10 s (the engine raises playback tempo; deliver at 128 BPM). The Marshal theme has three intensity stages (\`marshal1..3\`). The Ascent cue must be cut to silence at the atmosphere break (the mix drops to −60 dB over 0.4 s; only \`cockpit.breath\` and \`reactor.tick\` remain).\n`;
fs.writeFileSync('AUDIO_DELIVERY.md', md);
console.log(`AUDIO_DELIVERY.md: ${allLines.length} lines, ${SFX.length} sfx, ${MUSIC.length} cues`);
