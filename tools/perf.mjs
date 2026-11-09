// Per-chapter performance probe at 1920×1080 in each chapter's heaviest representative spot.
// Frame times here are only meaningful on real GPUs; draw calls / triangles / actors are hardware-independent.
import { startPreview, openGame, sleep } from './browser.mjs';
import fs from 'node:fs';
const spots = {
  ch1: (n) => { n.skip(); n.teleport(0, 0, 40); n.setAlert('hunted'); },
  ch2: (n) => { n.skip(); n.teleport(0, 0, 0); },
  ch3: (n) => { n.skip(); n.teleport(0, 0, -80); },
  ch4: (n) => { n.skip(); n.teleport(0, 0, -40); },
  ch5: (n) => { n.skip(); n.app.session.callHook('enterCockpit'); n.app.session.callHook('online'); const w = n.app.session.w; for (const f of ['c5.firstKill', 'c5.wardensDone', 'c5.stormDone', 'c5.ambushDone', 'c5.shelfOnce', 'c5.ambushOnce']) w.state.set(f); w.aegis.frame.pos.set(0, 0, -9000); },
  ch6: () => {},
};
const pv = await startPreview(5211);
const out = [];
for (const [ch, fn] of Object.entries(spots)) {
  const { browser, page, errors } = await openGame(pv.url, { query: '?overlay', width: 1920, height: 1080 });
  await page.waitForFunction(() => window.__nx); await sleep(1500); await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__nx.app.mode !== 'splash', null, { timeout: 30000 });
  await page.evaluate((c) => window.__nx.app.launch(c), ch); await sleep(2500);
  await page.evaluate(`(${fn.toString()})(window.__nx)`); await sleep(ch === 'ch5' ? 20000 : 6000);
  const samples = [];
  for (let i = 0; i < 8; i++) { await sleep(1000); samples.push(await page.evaluate(() => { const o = window.__nx.app['overlay'].stats; const w = window.__nx.app.session.w; return { ...o, enemies: w.enemies.filter((e) => e.alive).length, mechs: w.mechHostiles.filter((m) => m.alive).length, particles: w.fx.activeParticles }; })); }
  const max = (k) => Math.max(...samples.map((s) => s[k]));
  const avg = (k) => +(samples.reduce((a, s) => a + s[k], 0) / samples.length).toFixed(2);
  const r = { chapter: ch, frameMsAvg: avg('frameMs'), frameMsP95: max('p95'), fps: avg('fps'), drawCallsMax: max('draws'), trianglesMax: max('tris'), enemies: max('enemies'), mechs: max('mechs'), particlesMax: max('particles'), errors: errors.slice(0, 3) };
  out.push(r); console.log(JSON.stringify(r));
  await browser.close();
}
pv.stop();
fs.mkdirSync('artifacts', { recursive: true });
fs.writeFileSync('artifacts/perf.json', JSON.stringify({ machine: 'CI container, SwiftShader (CPU) WebGL — NOT the 2019 MBP target', at: new Date().toISOString(), results: out }, null, 2));
process.exit(0);
