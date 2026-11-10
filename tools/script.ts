// Fountain ⇄ game dialogue. The .fountain script is where the dialogue is written; data/story/*.ts is what
// the game plays. Each spoken block in the script carries its line id as a Fountain note: [[c1.wren.open1]].
//
//   npm run script:check            script and game data agree (run by check:fast)
//   npm run script:import           write script text + parentheticals into data/story/*.ts; new ids are appended
//   npm run script:export           append game lines the script doesn't place yet (creates the script if missing)
//
// Cue → speaker by label in data/story/lines.ts (BALLAST, AVA, AEGIS-07, …). The parenthetical is the line's
// performance note. Cue extensions are cosmetic, except (RECORDING) picks the recording priority for new lines.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { parseFountain, fountainDialogue, type FountainDialogue } from '../packages/narrative/src/Fountain';
import { SPEAKERS } from '../data/story/lines';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SCRIPT = path.join(ROOT, 'script', 'NoExtraction.fountain');
const STORY = path.join(ROOT, 'data', 'story');
const DATA_FILES = ['ch1', 'ch2', 'ch3', 'ch4', 'ch5', 'ch6', 'sable'].map((f) => path.join(STORY, `${f}.ts`));
const ID = /^(c[1-9]|sable)\.[a-z]+\.[A-Za-z0-9.]+$/;
const DEFAULT_PRIORITY: Record<string, string> = { ballast: 'P.reply', wren: 'P.story', halcyon: 'P.broadcast', marshal: 'P.marshal', aegis: 'P.aegis', sable: 'P.bark' };

const labelToSpeaker = new Map(SPEAKERS.map((s) => [s.label.toUpperCase(), s.id]));
const speakerToLabel = new Map(SPEAKERS.map((s) => [s.id, s.label]));

interface DataLine {
  id: string; speaker: string; text: string; note: string; file: string;
  /** Source spans of the text and note string literals (note: null when absent). */
  textSpan: [number, number]; noteSpan: [number, number] | null;
  /** Where a note argument would be inserted (after the priority / text arg) when there is none. */
  noteInsertAt: number; hasExtraAfterNote: boolean;
}

const quote = (s: string) => (!s.includes("'") ? `'${s}'` : !s.includes('"') ? `"${s}"` : JSON.stringify(s));

function readData(): DataLine[] {
  const out: DataLine[] = [];
  for (const file of DATA_FILES) {
    const src = fs.readFileSync(file, 'utf8');
    const sf = ts.createSourceFile(file, src, ts.ScriptTarget.ES2022, true);
    const visit = (n: ts.Node) => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && (n.expression.text === 'L' || n.expression.text === 'b')) {
        const a = n.arguments;
        const str = (x: ts.Expression | undefined) => (x && (ts.isStringLiteral(x) || ts.isNoSubstitutionTemplateLiteral(x)) ? x : null);
        const idLit = str(a[0]);
        if (idLit) {
          const isL = n.expression.text === 'L';
          const textArg = str(isL ? a[2] : a[1]);
          const noteArg = isL ? a[4] : a[2];
          const noteLit = str(noteArg);
          const prevArg = isL ? a[3]! : a[1]!;
          if (textArg) out.push({
            id: idLit.text, speaker: isL ? str(a[1])!.text : 'sable', text: textArg.text, note: noteLit?.text ?? '', file,
            textSpan: [textArg.getStart(sf), textArg.getEnd()],
            noteSpan: noteArg ? [noteArg.getStart(sf), noteArg.getEnd()] : null,
            noteInsertAt: prevArg.getEnd(), hasExtraAfterNote: isL && a.length > 5,
          });
        }
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  return out;
}

interface ScriptLine { id: string; speaker: string | undefined; block: FountainDialogue }

function readScript(): { lines: ScriptLine[]; problems: string[] } {
  const doc = parseFountain(fs.readFileSync(SCRIPT, 'utf8'));
  const lines: ScriptLine[] = []; const problems: string[] = [];
  for (const block of fountainDialogue(doc)) {
    const ids = block.notes.filter((n) => ID.test(n));
    if (ids.length === 0) { problems.push(`script:${block.line} ${block.character} has no [[line.id]] note — the game will not see it`); continue; }
    if (ids.length > 1) problems.push(`script:${block.line} more than one line id (${ids.join(', ')})`);
    lines.push({ id: ids[0]!, speaker: labelToSpeaker.get(block.character.toUpperCase()), block });
  }
  return { lines, problems };
}

/** Script lines grouped by id; the same id may appear twice (a reused line) but must read the same. */
function byId(lines: ScriptLine[], problems: string[]): Map<string, ScriptLine> {
  const m = new Map<string, ScriptLine>();
  for (const l of lines) {
    const prev = m.get(l.id);
    if (!prev) { m.set(l.id, l); continue; }
    if (prev.block.text !== l.block.text || prev.block.parenthetical !== l.block.parenthetical)
      problems.push(`script:${l.block.line} ${l.id} differs from its earlier use at script:${prev.block.line}`);
  }
  return m;
}

function check(): number {
  const data = readData();
  const { lines, problems } = readScript();
  const script = byId(lines, problems);
  const ids = new Set(data.map((d) => d.id));
  for (const l of lines) if (!l.speaker) problems.push(`script:${l.block.line} unknown character ${l.block.character} (known: ${[...labelToSpeaker.keys()].join(', ')})`);
  for (const [id, l] of script) {
    if (!ids.has(id)) { problems.push(`script:${l.block.line} ${id} is not in the game yet — run npm run script:import`); continue; }
    const d = data.find((x) => x.id === id)!;
    if (l.speaker && l.speaker !== d.speaker) problems.push(`script:${l.block.line} ${id} is ${speakerToLabel.get(d.speaker)} in the game, ${l.block.character} in the script`);
    if (l.block.text !== d.text) problems.push(`script:${l.block.line} ${id} text differs — script: "${l.block.text}" · game: "${d.text}"`);
    if (l.block.parenthetical !== d.note) problems.push(`script:${l.block.line} ${id} parenthetical differs — script: "${l.block.parenthetical}" · game: "${d.note}"`);
  }
  const missing = data.filter((d) => !script.has(d.id));
  for (const d of missing) problems.push(`${path.relative(ROOT, d.file)} ${d.id} is in the game but not placed in the script — run npm run script:export`);
  if (problems.length) { console.error(problems.join('\n')); console.error(`script: ${problems.length} problem(s)`); return 1; }
  console.log(`script: ok (${script.size} lines in sync with ${path.relative(ROOT, SCRIPT)})`);
  return 0;
}

function importScript(): number {
  const data = readData();
  const { lines, problems } = readScript();
  const script = byId(lines, problems);
  const edits = new Map<string, { at: number; end: number; text: string }[]>();
  const edit = (file: string, at: number, end: number, text: string) => { if (!edits.has(file)) edits.set(file, []); edits.get(file)!.push({ at, end, text }); };
  const appended: string[] = []; let changed = 0;
  for (const [id, l] of script) {
    if (!l.speaker) { problems.push(`script:${l.block.line} unknown character ${l.block.character}`); continue; }
    const d = data.find((x) => x.id === id);
    if (!d) {
      const prefix = id.split('.')[0]!;
      const file = path.join(STORY, `${prefix === 'sable' ? 'sable' : 'ch' + prefix.slice(1)}.ts`);
      if (!fs.existsSync(file)) { problems.push(`script:${l.block.line} ${id}: no data file ${path.relative(ROOT, file)}`); continue; }
      const note = l.block.parenthetical ? `, ${quote(l.block.parenthetical)}` : '';
      const pr = l.speaker === 'wren' && l.block.extensions.some((e) => /RECORD/i.test(e)) ? 'P.recording' : DEFAULT_PRIORITY[l.speaker] ?? 'P.story';
      const call = l.speaker === 'sable' ? `  b('${id}', ${quote(l.block.text)}${note}),\n` : `  L('${id}', '${l.speaker}', ${quote(l.block.text)}, ${pr}${note}),\n`;
      const src = fs.readFileSync(file, 'utf8'); const close = src.lastIndexOf('];');
      edit(file, close, close, call); appended.push(`${id} → ${path.relative(ROOT, file)}`);
      continue;
    }
    if (d.speaker !== l.speaker) { problems.push(`script:${l.block.line} ${id} speaker change (${d.speaker} → ${l.speaker}) — change it in the data by hand`); continue; }
    if (d.text !== l.block.text) { edit(d.file, d.textSpan[0], d.textSpan[1], quote(l.block.text)); changed++; }
    if (d.note !== l.block.parenthetical) {
      const p = l.block.parenthetical;
      if (d.noteSpan) edit(d.file, d.noteSpan[0], d.noteSpan[1], p ? quote(p) : d.hasExtraAfterNote ? 'undefined' : '');
      else if (p) edit(d.file, d.noteInsertAt, d.noteInsertAt, `, ${quote(p)}`);
      changed++;
    }
  }
  if (problems.length) { console.error(problems.join('\n')); console.error(`script: ${problems.length} problem(s), nothing written`); return 1; }
  for (const [file, es] of edits) {
    let src = fs.readFileSync(file, 'utf8');
    for (const e of es.sort((a, b) => b.at - a.at)) {
      // removing a note argument also removes the comma before it
      if (e.text === '' && src.slice(0, e.at).trimEnd().endsWith(',')) e.at = src.slice(0, e.at).trimEnd().length - 1;
      src = src.slice(0, e.at) + e.text + src.slice(e.end);
    }
    fs.writeFileSync(file, src);
  }
  console.log(`script: imported ${changed} change(s)${appended.length ? `, ${appended.length} new line(s):\n  ${appended.join('\n  ')}\nNew lines play only once a chapter script in src/story says them.` : ''}`);
  console.log('Run npm run audio-delivery to refresh the recording sheet.');
  return 0;
}

function block(d: DataLine, ext = ''): string {
  const cue = `${(speakerToLabel.get(d.speaker) ?? d.speaker).toUpperCase()}${ext ? ` (${ext})` : ''}`;
  return `${cue}\n${d.note ? `(${d.note})\n` : ''}${d.text} [[${d.id}]]\n`;
}

function exportScript(): number {
  const data = readData();
  if (!fs.existsSync(SCRIPT)) {
    fs.mkdirSync(path.dirname(SCRIPT), { recursive: true });
    let out = 'Title: NO EXTRACTION\nCredit: Dialogue script\n\n';
    for (const file of DATA_FILES) {
      out += `# ${path.basename(file, '.ts')}\n\n`;
      for (const d of data.filter((x) => x.file === file)) out += `${block(d)}\n`;
    }
    fs.writeFileSync(SCRIPT, out);
    console.log(`script: wrote ${data.length} lines to ${path.relative(ROOT, SCRIPT)}`);
    return 0;
  }
  const { lines } = readScript();
  const placed = new Set(lines.map((l) => l.id));
  const missing = data.filter((d) => !placed.has(d.id));
  if (!missing.length) { console.log('script: every game line is already in the script'); return 0; }
  let out = `\n# Unplaced lines\n\n= In the game data but not yet placed in the script. Move each block where it plays.\n\n`;
  for (const d of missing) out += `${block(d)}\n`;
  fs.appendFileSync(SCRIPT, out);
  console.log(`script: appended ${missing.length} unplaced line(s) to the end of ${path.relative(ROOT, SCRIPT)}`);
  return 0;
}

const cmd = process.argv[2];
const run = { check, import: importScript, export: exportScript }[cmd ?? ''];
if (!run) { console.error('usage: tsx tools/script.ts check|import|export'); process.exit(2); }
process.exit(run());
