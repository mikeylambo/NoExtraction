// Automated proofs for the brief's checklist items that can be proven headlessly.
import { startPreview, openGame, sleep } from './browser.mjs';
import fs from 'node:fs';
const pv = await startPreview(5213);
const { browser, page, errors } = await openGame(pv.url, { query: '?headless', width: 640, height: 360 });
await page.waitForFunction(() => window.__nx && window.__nx.app.mode !== 'splash');
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(detail)); };
const load = async (ch) => { await page.evaluate((c) => window.__nx.app.launch(c), ch); await sleep(1500); await page.evaluate(() => window.__nx.skip()); await sleep(300); };

// 1. Lockdown seals the fast gate, every time, in every chapter that has one
for (const [ch, gate, at] of [['ch1', 'c1.fast', [0, 0, 30]], ['ch2', 'c2.fast', [0, 0, -40]], ['ch3', 'c3.fast', [0, 0, -100]], ['ch4', 'c4.fast', [0, 0, -40]]]) {
  for (let rep = 0; rep < 3; rep++) {
    await load(ch);
    const r = await page.evaluate(([g, p]) => { const n = window.__nx; n.teleport(...p); const before = n.app.session.w.gates.isSealed(g); n.setAlert('lockdown'); return { before }; }, [gate, at]);
    await sleep(600);
    const after = await page.evaluate((g) => ({ sealed: window.__nx.app.session.w.gates.isSealed(g), lockdowns: window.__nx.state().lockdowns, solid: true }), gate);
    check(`${ch} lockdown seals ${gate} (run ${rep + 1})`, !r.before && after.sealed && after.lockdowns >= 1, { ...r, ...after });
  }
}
// 1b. Lockdown via 8 s continuous Hunted (no panel)
await load('ch1');
await page.evaluate(() => { const n = window.__nx; n.godMode(true); n.teleport(0, 0, 30); n.setAlert('hunted'); });
let t0 = Date.now(); let sealed = false;
while (Date.now() - t0 < 40000) { await sleep(500); const s = await page.evaluate(() => ({ sealed: window.__nx.app.session.w.gates.isSealed('c1.fast'), t: window.__nx.state().time })); if (s.sealed) { sealed = true; break; } await page.evaluate(() => window.__nx.setAlert('hunted')); }
check('ch1 lockdown from 8 s continuous Hunted seals the fast gate', sealed, {});

// 2. Collapse telegraphs at spec times
const SPEC = { fissure: 2.0, structure: 2.5, shelf: 3.0, debris: 1.5, aurora: 1.0, steam: 1.2 };
await load('ch1');
const log = await page.evaluate(async () => {
  const w = window.__nx.app.session.w; const p = w.focusPos();
  for (const kind of ['fissure', 'structure', 'shelf', 'debris', 'aurora', 'steam']) w.collapse.trigger({ id: `proof.${kind}`, kind, at: [p.x + 20, 0, p.z + 20], to: [p.x + 30, 0, p.z + 20] });
  return w.collapse.log.filter((l) => l.id.startsWith('proof.')).map((l) => ({ kind: l.kind, telegraph: +(l.landAt - l.telegraphAt).toFixed(3) }));
});
for (const l of log) check(`collapse ${l.kind} telegraph ${l.telegraph}s = spec ${SPEC[l.kind]}s`, Math.abs(l.telegraph - SPEC[l.kind]) < 1e-6, l);
let landed = 1; for (let i = 0; i < 40 && landed > 0; i++) { await sleep(500); landed = await page.evaluate(() => window.__nx.app.session.w.collapse.activeCount); }
check('all six collapse kinds landed after their telegraphs', landed === 0, { stillRunning: landed });

// 3. Core scrub 72 → 0 visibly changes sky, weather, tremors
const looks = [];
for (const pct of [72, 58, 41, 24, 11, 2, 0]) looks.push(await page.evaluate((v) => { window.__nx.setCore(v); const L = window.__nx.app.session.w.atmo.look; return { pct: v, sky: L.sky, snow: L.snow, tremorEvery: L.tremorEvery, aurora: L.aurora, coreGlow: L.coreGlow, fogFar: L.fogFar }; }, pct));
const distinct = new Set(looks.map((l) => JSON.stringify([l.sky, l.snow, l.aurora, l.coreGlow]))).size;
check('Core Stability scrub 72→0 produces 7 distinct world looks', distinct === 7, looks);

// 4. Timed Zone fail returns to the zone checkpoint
await load('ch2');
await page.evaluate(() => { const n = window.__nx; n.teleport(0, 0, -197); });
await sleep(2000);
const zs = await page.evaluate(() => ({ zone: window.__nx.state().zone, cp: window.__nx.app.session.lastCheckpoint?.checkpointId }));
await page.evaluate(() => { const z = window.__nx.app.session.w.zones.active; if (z) z.left = 0.05; });
await sleep(2500);
const after = await page.evaluate(() => ({ zone: window.__nx.state().zone, pos: window.__nx.state().player.pos, cp: window.__nx.app.session.lastCheckpoint?.checkpointId }));
check('Timed Zone (The Pad) fail restarts at the zone checkpoint with a full clock', zs.zone?.id === 'pad' && after.zone?.id === 'pad' && after.zone.left > 80 && Math.abs(after.pos[2] - (-197)) < 4, { before: zs, after });

// 5. Narrative: sequence with VO + subtitles + shots + collapse hands control back; skip works; mid-chapter save restores flags + world changes
await load('ch1');
const seq = await page.evaluate(async () => {
  const n = window.__nx, w = n.app.session.w;
  w.sequences.register([{ id: 'proof.seq', cinematic: true, skippable: true, duration: 3, steps: [
    { at: 0, action: { kind: 'shots', blendOut: 0.5, shots: [{ id: 'a', duration: 1.5, from: { p: [0, 20, 230], t: [0, 0, 150], fov: 50 } }] } },
    { at: 0, action: { kind: 'line', id: 'c1.wren.clean' } },
    { at: 0.5, action: { kind: 'collapse', id: 'proof.fissure2' } },
    { at: 1, action: { kind: 'flag', key: 'proof.flag' }, essential: true },
  ] }]);
  w.collapse.register([{ id: 'proof.fissure2', kind: 'fissure', at: [0, 6, 200] }]);
  w.sequences.play('proof.seq');
  return { locked: w.cinematic.controlLocked, subs: document.querySelectorAll('.nv-sub').length };
});
await sleep(4500);
const seq2 = await page.evaluate(() => { const w = window.__nx.app.session.w; return { locked: w.cinematic.controlLocked, flag: w.state.has('proof.flag'), change: w.state.applied('collapse.proof.fissure2') }; });
check('sequence: VO + subtitles + shots + collapse, then control returns', seq.locked && seq.subs >= 1 && !seq2.locked && seq2.flag && seq2.change, { seq, seq2 });
await page.evaluate(() => window.__nx.app.session.w.sequences.play('proof.seq'));
await sleep(300);
const sk = await page.evaluate(() => { const n = window.__nx; n.app.session.w.state.unset('proof.flag'); n.skip(); const w = n.app.session.w; return { cine: w.sequences.cinematic, locked: w.cinematic.controlLocked, flag: w.state.has('proof.flag') }; });
check('skip ends the cinematic, runs essential steps, returns control', sk.cine === null && !sk.locked && sk.flag, sk);
const rt = await page.evaluate(async () => { const s = window.__nx.app.session; s.w.state.set('proof.persist', 7); s.w.state.apply('proof.change'); const p = s.saveCheckpoint('proofCp'); s.load('ch1', { payload: p }); return { v: s.w.state.num('proof.persist'), c: s.w.state.applied('proof.change'), cp: s.lastCheckpoint?.checkpointId }; });
check('mid-chapter checkpoint restores flags and world changes', rt.v === 7 && rt.c, rt);

fs.writeFileSync('artifacts/proofs.json', JSON.stringify({ at: new Date().toISOString(), results, errors: errors.slice(0, 5) }, null, 2));
console.log(`${results.filter((r) => r.ok).length}/${results.length} proofs passed`);
await browser.close(); pv.stop(); process.exit(results.every((r) => r.ok) ? 0 : 1);
