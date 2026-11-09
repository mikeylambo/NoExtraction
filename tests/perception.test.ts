import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PerceptionSystem, createPerceiver, type PerceiverConfig } from '@slu/perception';

const cfg = (): PerceiverConfig => ({ sight: { range: 26, fovDeg: 100, closeRange: 5, fillClose: 0.6, fillFar: 1.4, eyeHeight: 1.6 }, hearing: { multiplier: 1 }, investigateTime: 10, huntMemory: 14, radioRange: 70 });
const run = (p: PerceptionSystem, s: number) => { for (let t = 0; t < s; t += 1 / 60) p.update(1 / 60); };
const setup = (blocked = false) => {
  const sys = new PerceptionSystem({ occluded: () => blocked }, { radioDelay: 0.8 });
  const a = sys.add(createPerceiver('g', cfg(), { x: 0, y: 0, z: 0 }, 0)); // looks down -Z
  return { sys, a };
};

test('sight: close target becomes suspicious after ~0.6 s, hunted after a second stage', () => {
  const { sys, a } = setup();
  sys.setTarget({ id: 'p', pos: { x: 0, y: 0, z: -3 }, points: [1.6], visibility: 1 });
  run(sys, 0.55); assert.equal(a.awareness, 'unaware');
  run(sys, 0.1); assert.equal(a.awareness, 'suspicious');
  run(sys, 0.65); assert.equal(a.awareness, 'hunted');
});

test('sight: fill takes ~1.4 s at range, and crouched visibility slows it', () => {
  const { sys, a } = setup();
  sys.setTarget({ id: 'p', pos: { x: 0, y: 0, z: -25.9 }, points: [1.6], visibility: 1 });
  run(sys, 1.3); assert.equal(a.awareness, 'unaware'); run(sys, 0.15); assert.equal(a.awareness, 'suspicious');
  const s2 = setup(); s2.sys.setTarget({ id: 'p', pos: { x: 0, y: 0, z: -3 }, points: [1.6], visibility: 0.5 });
  run(s2.sys, 0.9); assert.equal(s2.a.awareness, 'unaware');
});

test('sight: behind the cone or occluded is invisible', () => {
  const { sys, a } = setup(); sys.setTarget({ id: 'p', pos: { x: 0, y: 0, z: 3 }, points: [1.6], visibility: 1 });
  run(sys, 3); assert.equal(a.awareness, 'unaware');
  const s2 = setup(true); s2.sys.setTarget({ id: 'p', pos: { x: 0, y: 0, z: -3 }, points: [1.6], visibility: 1 });
  run(s2.sys, 3); assert.equal(s2.a.awareness, 'unaware');
});

test('hearing: noise → suspicious with last-known position; loud → hunted', () => {
  const { sys, a } = setup();
  sys.emit({ kind: 'noise', pos: { x: 5, y: 0, z: 5 }, radius: 8 }); run(sys, 0.05);
  assert.equal(a.awareness, 'suspicious'); assert.deepEqual(a.lastKnown, { x: 5, y: 0, z: 5 });
  sys.emit({ kind: 'loud', pos: { x: 30, y: 0, z: 0 }, radius: 40 }); run(sys, 0.05);
  assert.equal(a.awareness, 'hunted');
});

test('memory: suspicious calms after investigateTime; hunted drops to suspicious after huntMemory', () => {
  const { sys, a } = setup();
  sys.emit({ kind: 'noise', pos: { x: 1, y: 0, z: 1 }, radius: 8 }); run(sys, 0.1);
  run(sys, 10.1); assert.equal(a.awareness, 'unaware');
  sys.setAwareness(a, 'hunted', 'forced', { x: 0, y: 0, z: -5 }); run(sys, 14.2);
  assert.equal(a.awareness, 'suspicious');
});

test('radio: hunted calls it in to the same group in range; aurora (radio off) cuts it', () => {
  const sys = new PerceptionSystem({ occluded: () => false }, { radioDelay: 0.8 });
  const a = sys.add(createPerceiver('g', cfg(), { x: 0, y: 0, z: 0 }));
  const b = sys.add(createPerceiver('g', cfg(), { x: 40, y: 0, z: 0 }));
  const c = sys.add(createPerceiver('other', cfg(), { x: 10, y: 0, z: 0 }));
  sys.emit({ kind: 'loud', pos: { x: 0, y: 0, z: 5 }, radius: 10 }); run(sys, 1);
  assert.equal(a.awareness, 'hunted'); assert.equal(b.awareness, 'hunted'); assert.equal(c.awareness, 'unaware');
  const s2 = new PerceptionSystem({ occluded: () => false }, { radioDelay: 0.8 }); s2.radioEnabled = false;
  const a2 = s2.add(createPerceiver('g', cfg(), { x: 0, y: 0, z: 0 })); const b2 = s2.add(createPerceiver('g', cfg(), { x: 40, y: 0, z: 0 }));
  s2.emit({ kind: 'loud', pos: { x: 0, y: 0, z: 5 }, radius: 10 }); run(s2, 1);
  assert.equal(a2.awareness, 'hunted'); assert.equal(b2.awareness, 'unaware');
});

test('visual stimulus: a body in view sends the viewer straight to hunted', () => {
  const { sys, a } = setup(); sys.addVisual('body', { x: 0, y: 0, z: -6 }, 'hunted'); run(sys, 0.1);
  assert.equal(a.awareness, 'hunted');
});
