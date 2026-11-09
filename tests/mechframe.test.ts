import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MechFrame, MECH_BASELINE, cloneBaseline } from '@slu/mech-frame';

const flat = { groundAt: () => 0, confine: () => false };
const idle = { moveX: 0, moveZ: 0, rise: false, descend: false };
const step = (m: MechFrame, s: number, input = idle) => { for (let t = 0; t < s; t += 1 / 60) m.update(1 / 60, input); };

test('baseline values are AlphaMech BLINKFALL (unchanged)', () => {
  assert.equal(MECH_BASELINE.speed, 62); assert.equal(MECH_BASELINE.quickSpeed, 200); assert.equal(MECH_BASELINE.quickCost, 20);
  assert.equal(MECH_BASELINE.assaultSpeed, 200); assert.equal(MECH_BASELINE.camDist, 30); assert.equal(MECH_BASELINE.camFov, 62);
});

test('quick boost: costs energy, has a cooldown, moves at quickSpeed', () => {
  const m = new MechFrame(flat, cloneBaseline());
  assert.ok(m.quickBoost(new THREE.Vector3(1, 0, 0)));
  assert.equal(m.energy, 80);
  assert.equal(m.quickBoost(new THREE.Vector3(1, 0, 0)), false, 'cooldown');
  m.update(1 / 60, idle); assert.ok(Math.abs(m.vel.x - 200) < 1e-6);
});

test('without sustained flight the jets only hop (≤ 12 m) and gravity returns the frame', () => {
  const m = new MechFrame(flat, cloneBaseline()); m.caps = { sustainedFlight: false, hopHeight: 12, airBoost: false };
  let peak = 0; for (let t = 0; t < 2; t += 1 / 60) { m.update(1 / 60, { ...idle, rise: true }); peak = Math.max(peak, m.pos.y); }
  assert.ok(peak <= 12 + 2, `peak ${peak}`); step(m, 3); assert.equal(m.pos.y, 0);
});

test('with flight the frame holds altitude (ASHFALL profile)', () => {
  const m = new MechFrame(flat, cloneBaseline());
  step(m, 0.8, { ...idle, rise: true }); const y = m.pos.y; step(m, 1); assert.ok(Math.abs(m.pos.y - y) < 1e-6 && y > 10);
});

test('over a bottomless void (ground ≤ −1000) there is no altitude cap pulling the frame down', () => {
  const m = new MechFrame({ groundAt: () => -10000, confine: () => false }, cloneBaseline());
  m.pos.set(0, 30, 0); m.grounded = false; m.update(1 / 60, idle);
  assert.ok(m.pos.y > 29, `y ${m.pos.y}`);
});
