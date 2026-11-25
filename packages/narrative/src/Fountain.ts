/**
 * Fountain screenplay parser (https://fountain.io). Game-agnostic: turns a .fountain script into typed
 * elements, plus the dialogue blocks a game binds to its voice lines through `[[line.id]]` notes.
 *
 * Covers the spec a dialogue pipeline needs: title page, scene headings (INT./EXT./EST./I/E, forced `.`),
 * sections `#`, synopses `=`, characters (forced `@`, extensions, dual `^`), parentheticals, dialogue,
 * transitions (`TO:`, forced `>`), centered `>text<`, page breaks `===`, forced action `!`, lyrics `~`,
 * notes `[[ ]]` and boneyard `/* *\/`.
 */

export type FountainElementType =
  | 'scene' | 'action' | 'character' | 'parenthetical' | 'dialogue' | 'transition'
  | 'centered' | 'section' | 'synopsis' | 'pageBreak' | 'lyric';

export interface FountainElement {
  type: FountainElementType;
  /** Text with notes removed. */
  text: string;
  /** 1-based source line. */
  line: number;
  /** Notes found inside this element, `[[...]]` contents trimmed. */
  notes: string[];
  /** Section depth (number of #). */
  depth?: number;
}

export interface FountainDialogue {
  /** Character cue with extensions and dual-dialogue caret removed, e.g. "THE CAPTAIN". */
  character: string;
  /** Extensions from the cue, e.g. ["RADIO"] for "PILOT (RADIO)". */
  extensions: string[];
  /** First parenthetical, brackets removed; '' when none. */
  parenthetical: string;
  /** Dialogue text, lines joined with a space, notes removed. */
  text: string;
  /** Every note inside the block (cue, parentheticals, dialogue). */
  notes: string[];
  /** 1-based line of the character cue. */
  line: number;
  /** Nearest scene heading above, '' before the first. */
  scene: string;
  /** Nearest section titles above, outermost first. */
  sections: string[];
}

export interface FountainDocument {
  title: Record<string, string>;
  elements: FountainElement[];
}

const SCENE = /^(INT|EXT|EST|INT\.?\/EXT|I\/E)[.\s]/i;
const NOTE = /\[\[([\s\S]*?)\]\]/g;

function stripNotes(s: string): { text: string; notes: string[] } {
  const notes: string[] = [];
  const text = s.replace(NOTE, (_, n: string) => { notes.push(n.trim()); return ''; }).replace(/[ \t]+$/, '').replace(/\s{2,}/g, ' ');
  return { text: text.trim(), notes };
}

const isCharacterCue = (raw: string): boolean => {
  const t = raw.trim();
  if (t.startsWith('@')) return true;
  if (t.startsWith('!')) return false;
  const name = t.replace(/\s*\^$/, '').replace(/\s*\(.*\)\s*$/, '').replace(NOTE, '').trim();
  return name.length > 0 && /[A-Z]/.test(name) && name === name.toUpperCase() && !SCENE.test(name) && !/TO:$/.test(name);
};

/** Parse a Fountain script. */
export function parseFountain(src: string): FountainDocument {
  // boneyard out, keeping line numbers
  const text = src.replace(/\r\n?/g, '\n').replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ''));
  const lines = text.split('\n');
  const title: Record<string, string> = {};
  let i = 0;

  // title page: `Key: value` lines at the very top, ended by a blank line
  if (/^[A-Za-z][A-Za-z ]*:/.test(lines[0] ?? '')) {
    let key = '';
    for (; i < lines.length && lines[i]!.trim() !== ''; i++) {
      const l = lines[i]!;
      const m = /^([A-Za-z][A-Za-z ]*):\s*(.*)$/.exec(l);
      if (m && !/^\s/.test(l)) { key = m[1]!.trim().toLowerCase(); title[key] = m[2]!.trim(); }
      else if (key) title[key] = (title[key] ? title[key] + '\n' : '') + l.trim();
    }
  }

  const elements: FountainElement[] = [];
  const push = (type: FountainElementType, raw: string, line: number, extra: Partial<FountainElement> = {}) => {
    const { text: t, notes } = stripNotes(raw);
    elements.push({ type, text: t, line, notes, ...extra });
  };
  const blank = (n: number) => n < 0 || n >= lines.length || lines[n]!.trim() === '';

  while (i < lines.length) {
    const raw = lines[i]!;
    const t = raw.trim();
    const ln = i + 1;
    if (t === '') { i++; continue; }
    // a note alone on its line(s) attaches to the previous element
    if (/^\[\[[\s\S]*\]\]$/.test(t)) {
      const prev = elements[elements.length - 1];
      if (prev) prev.notes.push(...stripNotes(t).notes);
      i++; continue;
    }
    if (/^={3,}$/.test(t)) { push('pageBreak', '', ln); i++; continue; }
    if (t.startsWith('#')) { const depth = /^#+/.exec(t)![0].length; push('section', t.slice(depth).trim(), ln, { depth }); i++; continue; }
    if (t.startsWith('=')) { push('synopsis', t.slice(1).trim(), ln); i++; continue; }
    if (t.startsWith('~')) { push('lyric', t.slice(1).trim(), ln); i++; continue; }
    if (/^>.*<$/.test(t)) { push('centered', t.slice(1, -1).trim(), ln); i++; continue; }
    if (blank(i - 1) && blank(i + 1) && ((t.startsWith('.') && !t.startsWith('..')) || SCENE.test(t))) {
      push('scene', t.startsWith('.') ? t.slice(1).trim() : t, ln); i++; continue;
    }
    if (t.startsWith('>') || (blank(i - 1) && blank(i + 1) && t === t.toUpperCase() && /TO:$/.test(t))) {
      push('transition', t.replace(/^>\s*/, ''), ln); i++; continue;
    }
    if (blank(i - 1) && !blank(i + 1) && isCharacterCue(t)) {
      push('character', t.replace(/^@/, ''), ln);
      i++;
      while (i < lines.length && lines[i]!.trim() !== '') {
        const d = lines[i]!.trim();
        if (/^\(.*\)$/.test(d)) push('parenthetical', d, i + 1);
        else {
          // consecutive dialogue lines merge into one element
          const prev = elements[elements.length - 1]!;
          const { text: dt, notes } = stripNotes(d);
          if (prev.type === 'dialogue') { prev.text = (prev.text + ' ' + dt).trim(); prev.notes.push(...notes); }
          else elements.push({ type: 'dialogue', text: dt, line: i + 1, notes });
        }
        i++;
      }
      continue;
    }
    // action: runs until a blank line
    const start = i; const buf: string[] = [];
    while (i < lines.length && lines[i]!.trim() !== '') { buf.push(lines[i]!.replace(/^!/, '')); i++; }
    push('action', buf.join('\n'), start + 1);
  }
  return { title, elements };
}

/** Dialogue blocks in script order, each with its cue, parenthetical, text and notes. */
export function fountainDialogue(doc: FountainDocument): FountainDialogue[] {
  const out: FountainDialogue[] = [];
  let scene = '';
  const sections: string[] = [];
  let cur: FountainDialogue | null = null;
  for (const e of doc.elements) {
    if (e.type === 'scene') scene = e.text;
    if (e.type === 'section') { sections.length = Math.max(0, (e.depth ?? 1) - 1); sections.push(e.text); }
    if (e.type === 'character') {
      const extensions = [...e.text.matchAll(/\(([^)]*)\)/g)].map((m) => m[1]!.trim());
      const character = e.text.replace(/\s*\^$/, '').replace(/\s*\(.*\)\s*$/, '').trim();
      cur = { character, extensions, parenthetical: '', text: '', notes: [...e.notes], line: e.line, scene, sections: [...sections] };
      out.push(cur);
      continue;
    }
    if (!cur) continue;
    if (e.type === 'parenthetical') { if (!cur.parenthetical) cur.parenthetical = e.text.replace(/^\(|\)$/g, '').trim(); cur.notes.push(...e.notes); continue; }
    if (e.type === 'dialogue') { cur.text = (cur.text ? cur.text + ' ' : '') + e.text; cur.notes.push(...e.notes); continue; }
    cur = null;
  }
  return out;
}
