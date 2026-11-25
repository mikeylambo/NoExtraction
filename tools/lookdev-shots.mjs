// Lookdev stills: every shot with the full post stack, plus a raw (post off) A/B of shot 1.
// usage: node tools/lookdev-shots.mjs [outDir] [scale]
import { startPreview, openGame, sleep } from './browser.mjs';
import fs from 'node:fs';
const OUT = process.argv[2] ?? 'artifacts/lookdev';
const scale = Number(process.argv[3] ?? 1);
fs.mkdirSync(OUT, { recursive: true });
const pv = await startPreview(5212);
const { browser, page, errors } = await openGame(pv.url, { query: 'lookdev.html?clean&still&shot=1', width: 1280 * scale, height: 720 * scale });
await page.waitForFunction(() => window.__look?.ready, null, { timeout: 120000 });
const plan = [[1, 6, 'shot1-establishing'], [2, 4, 'shot2-patrol'], [3, 5, 'shot3-ground-floodlights'], [4, 5, 'shot4-door-sentry']];
await page.evaluate(() => window.__look.advance(3));
for (const [n, t, name] of plan) {
  await page.evaluate(([n, t]) => { window.__look.shot(n, t); window.__look.advance(0.2); window.__look.draw(); }, [n, t]);
  await page.screenshot({ path: `${OUT}/${name}.png`, timeout: 300000 }); console.log('shot', name, JSON.stringify(await page.evaluate(() => window.__look.info())));
}
await page.evaluate(() => { window.__look.post(false); window.__look.shot(1, 6); window.__look.draw(); });
await page.screenshot({ path: `${OUT}/shot1-raw-no-post.png`, timeout: 300000 }); console.log('shot raw');
console.log('ERRORS', errors.slice(0, 8).join('\n'));
await browser.close(); pv.stop(); process.exit(0);
