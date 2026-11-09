import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WorldState, StoryGraph, VoiceTrack, DialogueDirector, SequenceDirector, CinematicCamera, TriggerSystem, StoryCheckpoint, evaluate } from '@slu/narrative';

const voice = () => {
  const v = new VoiceTrack(new WorldState());
  v.addSpeakers([{ id: 'a', label: 'A', color: '#fff' }, { id: 'b', label: 'B', color: '#fff' }]);
  v.add([
    { id: 'story.low', speaker: 'a', text: 'low', priority: 10, file: 'x', durationMs: 1000 },
    { id: 'story.high', speaker: 'a', text: 'high', priority: 80, file: 'x', durationMs: 1000 },
    { id: 'rec.1', speaker: 'b', text: 'one', priority: 40, file: 'x', durationMs: 1000 },
    { id: 'rec.2', speaker: 'b', text: 'two', priority: 40, file: 'x', durationMs: 1000 },
    { id: 'bark', speaker: 'a', text: 'bark', priority: 5, file: 'x', durationMs: 500 },
  ]);
  return v;
};

test('StoryGraph: ordered beats, requirements, flags, snapshot', () => {
  const w = new WorldState(); const g = new StoryGraph(w);
  g.register([{ id: 'c', title: 'C', beats: [{ id: 'a' }, { id: 'b', requires: 'gate', sets: { entered: true } }] }]);
  g.startChapter('c');
  assert.equal(g.beatId, 'a');
  assert.equal(g.advance(), false, 'requirement blocks');
  w.set('gate');
  assert.equal(g.advance(), true);
  assert.equal(g.beatId, 'b');
  assert.equal(w.has('entered'), true);
  const snap = g.snapshot(); const g2 = new StoryGraph(w); g2.register([{ id: 'c', title: 'C', beats: [{ id: 'a' }, { id: 'b' }] }]); g2.hydrate(snap);
  assert.equal(g2.beatId, 'b');
});

test('Conditions: all/any/not/eq/gte/change', () => {
  const w = new WorldState(); w.set('n', 3); w.apply('bridge.down');
  assert.ok(evaluate({ all: [{ flag: 'n', gte: 2 }, { change: 'bridge.down' }] }, w));
  assert.ok(evaluate({ any: ['nope', { not: 'nope' }] }, w));
  assert.ok(!evaluate({ flag: 'n', eq: 4 }, w));
});

test('DialogueDirector: higher priority interrupts story VO', () => {
  const d = new DialogueDirector(voice());
  d.say('story.low'); d.say('story.high');
  assert.equal(d.primary?.line.id, 'story.high');
});

test('DialogueDirector: a recording finishes before the next recording', () => {
  const d = new DialogueDirector(voice());
  d.say('rec.1', { channel: 'recording' }); d.say('rec.2', { channel: 'recording' });
  assert.equal(d.primary?.line.id, 'rec.1');
  d.tick(0.5); assert.equal(d.primary?.line.id, 'rec.1');
  d.tick(0.6); assert.equal(d.primary?.line.id, 'rec.2');
});

test('DialogueDirector: barks duck −12 dB under recordings and respect the 90 s cooldown', () => {
  const d = new DialogueDirector(voice());
  const ducks: number[] = []; d.events.on('duck', (e) => ducks.push(e.db));
  d.say('rec.1', { channel: 'recording' });
  assert.ok(d.say('bark', { channel: 'bark' }) !== null);
  assert.equal(d.bark?.ducked, true);
  assert.deepEqual(ducks, [-12]);
  d.tick(1.2);
  assert.equal(d.say('bark', { channel: 'bark' }), null, 'cooldown');
  d.tick(90);
  assert.ok(d.say('bark', { channel: 'bark' }) !== null, 'after 90 s');
});

test('SequenceDirector: skip runs essential steps only', () => {
  const s = new SequenceDirector<string>(); const ran: string[] = [];
  s.onAction((a, c) => ran.push(`${a}${c.skipping ? '*' : ''}`));
  s.register([{ id: 'q', cinematic: true, steps: [{ at: 0, action: 'a' }, { at: 1, action: 'b', essential: true }, { at: 2, action: 'c' }] }]);
  s.play('q'); s.update(0.5); s.skip();
  assert.deepEqual(ran, ['a', 'b*']);
  assert.equal(s.cinematic, null);
});

test('CinematicCamera: control returns on the same update the blend completes', () => {
  const c = new CinematicCamera(); let handoffs = 0;
  const pose = { position: { x: 0, y: 0, z: 0 }, target: { x: 0, y: 0, z: -1 }, fov: 50 };
  c.play([{ id: 's', duration: 1, from: pose }], { blendOut: 0.5, onHandoff: () => handoffs++ });
  c.update(0.5, pose); assert.equal(c.controlLocked, true);
  c.update(0.6, pose); assert.equal(c.controlLocked, true, 'blending');
  const r = c.update(0.5, pose);
  assert.equal(r, null); assert.equal(c.controlLocked, false); assert.equal(handoffs, 1);
});

test('Triggers + StoryCheckpoint: fire once, restore flags and world changes', () => {
  const w = new WorldState(); const g = new StoryGraph(w); g.register([{ id: 'c', title: 'C', beats: [{ id: 'a' }] }]); g.startChapter('c');
  const t = new TriggerSystem(w); let n = 0;
  t.add({ id: 't', shape: { kind: 'sphere', center: { x: 0, y: 0, z: 0 }, radius: 1 }, onEnter: () => n++ });
  t.update({ x: 0, y: 0, z: 0 }); t.update({ x: 5, y: 0, z: 0 }); t.update({ x: 0, y: 0, z: 0 });
  assert.equal(n, 1);
  w.set('k', 7); w.apply('wall.fell'); w.coreStability = 41;
  const cp = new StoryCheckpoint(g, w, t); const p = cp.capture('x', { ammo: 3 }, { at: 1 });
  w.reset(); t.clear();
  const r = cp.restore(p);
  assert.equal(w.num('k'), 7); assert.ok(w.applied('wall.fell')); assert.equal(w.coreStability, 41); assert.ok(t.hasFired('t'));
  assert.deepEqual(r.inventory, { ammo: 3 });
});
