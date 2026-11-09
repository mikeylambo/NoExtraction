import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PLAYER } from '../data/player';
import { WEAPONS } from '../data/weapons';
import { CACHES } from '../data/caches';
import { COMPONENT_COMBOS } from '../data/components';
import { ALL_LINES } from '../data/story';
import { CHAPTERS, gradeChapter } from '../data/chapters';
import { TIMED_ZONES } from '../data/timedZones';
import { lookFor } from '../data/core';

test('GDD numbers', () => {
  assert.equal(PLAYER.move.walk, 3.2); assert.equal(PLAYER.move.sprint, 7.5); assert.equal(PLAYER.takedown.range, 1.8); assert.equal(PLAYER.takedown.chainMax, 3);
  assert.equal(PLAYER.visor.cooldown, 12); assert.equal(PLAYER.health.regenCap, 60);
  assert.equal(WEAPONS.sidearm.mag, 12); assert.equal(WEAPONS.carbine.noise, 40); assert.equal(WEAPONS.shotgun.pellets, 12);
  assert.equal(TIMED_ZONES.pad!.seconds, 90); assert.equal(TIMED_ZONES.freightLift!.seconds, 180); assert.equal(TIMED_ZONES.conduitFlood!.seconds, 150); assert.equal(TIMED_ZONES.shelfRun!.seconds, 90);
});
test('caches: 4 story + 4 personal, every line exists', () => {
  assert.equal(CACHES.filter((c) => c.kind === 'story').length, 4); assert.equal(CACHES.filter((c) => c.kind === 'personal').length, 4);
  const ids = new Set(ALL_LINES.map((l) => l.id));
  for (const c of CACHES) for (const l of c.lines) assert.ok(ids.has(l), l);
});
test('VO lines: ids unique, files and priorities present, GDD-mandated lines exist', () => {
  const ids = ALL_LINES.map((l) => l.id); assert.equal(new Set(ids).size, ids.length);
  for (const l of ALL_LINES) { assert.ok(l.file.startsWith('assets/vo/')); assert.ok(Number.isFinite(l.priority)); }
  const text = ALL_LINES.map((l) => l.text).join('\n');
  for (const s of ['Clean. Like always.', 'Sorry, big guy.', 'You’re late.', 'Personnel losses are within acceptable parameters']) assert.ok(text.includes(s), s);
});
test('8 component combinations; grading bands', () => {
  assert.equal(COMPONENT_COMBOS.length, 8);
  const s = gradeChapter(CHAPTERS[0]!, { seconds: 400, lockdowns: 0, takedowns: 8, cachesFound: 0, cachesTotal: 0, componentsSecured: 0, componentsAvailable: 0, deaths: 0 });
  assert.equal(s.grade, 'S');
  const c = gradeChapter(CHAPTERS[0]!, { seconds: 1200, lockdowns: 3, takedowns: 0, cachesFound: 0, cachesTotal: 0, componentsSecured: 0, componentsAvailable: 0, deaths: 4 });
  assert.equal(c.grade, 'C');
});
test('Core Stability look interpolates 72 → 0', () => {
  assert.ok(lookFor(72).snow < lookFor(41).snow); assert.equal(lookFor(0).aurora, 0); assert.ok(lookFor(24).coreGlow > 0.5);
});
