import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseFountain, fountainDialogue } from '@slu/narrative';

const SAMPLE = `Title: TEST
Credit: Written by
    Someone

# Act One

= A synopsis.

INT. ROOM - NIGHT

A door opens. [[action note]]

PILOT (RADIO)
(quiet)
First line,
second line. [[c1.pilot.one]]

@McCLANE ^
Yippee. [[c1.mcclane.two]]

/* boneyard
GHOST
Never parsed.
*/

.FORCED SCENE

!ALL CAPS ACTION THAT IS NOT A CUE
Still action.

CUT TO:

>THE END<

===
`;

test('fountain: elements, title page, notes, boneyard', () => {
  const doc = parseFountain(SAMPLE);
  assert.equal(doc.title.title, 'TEST');
  assert.equal(doc.title.credit, 'Written by\nSomeone');
  const types = doc.elements.map((e) => e.type);
  assert.deepEqual(types, ['section', 'synopsis', 'scene', 'action', 'character', 'parenthetical', 'dialogue', 'character', 'dialogue', 'scene', 'action', 'transition', 'centered', 'pageBreak']);
  assert.equal(doc.elements[3]!.text, 'A door opens.');
  assert.deepEqual(doc.elements[3]!.notes, ['action note']);
  assert.equal(doc.elements[9]!.text, 'FORCED SCENE');
  assert.ok(!doc.elements.some((e) => e.text.includes('GHOST')));
});

test('fountain: dialogue blocks carry cue, extensions, parenthetical, joined text and ids', () => {
  const d = fountainDialogue(parseFountain(SAMPLE));
  assert.equal(d.length, 2);
  assert.deepEqual({ c: d[0]!.character, e: d[0]!.extensions, p: d[0]!.parenthetical, t: d[0]!.text, n: d[0]!.notes, s: d[0]!.scene, sec: d[0]!.sections },
    { c: 'PILOT', e: ['RADIO'], p: 'quiet', t: 'First line, second line.', n: ['c1.pilot.one'], s: 'INT. ROOM - NIGHT', sec: ['Act One'] });
  assert.equal(d[1]!.character, 'McCLANE');
  assert.equal(d[1]!.text, 'Yippee.');
});

test('fountain: the game script binds every block to a line id', () => {
  const blocks = fountainDialogue(parseFountain(fs.readFileSync('script/NoExtraction.fountain', 'utf8')));
  assert.ok(blocks.length >= 172);
  for (const b of blocks) assert.ok(b.notes.some((n) => /^(c\d|sable)\./.test(n)), `script line ${b.line} has no id`);
});
