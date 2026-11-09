// Headless bot run of each chapter's critical path (part of `npm run check`).
// Usage: node tools/bot.mjs [ch1,ch2,...] [--loud] [--components=flightGovernor,missileRack]
import { startPreview, openGame, sleep } from './browser.mjs';
import fs from 'node:fs';

const args = process.argv.slice(2);
const chapters = (args.find((a) => !a.startsWith('--')) ?? 'ch1,ch2,ch3,ch4,ch5,ch6').split(',');
const mode = args.includes('--loud') ? 'loud' : 'stealth';
const comps = (args.find((a) => a.startsWith('--components='))?.split('=')[1] ?? '').split(',').filter(Boolean);
const limitS = Number(args.find((a) => a.startsWith('--limit='))?.split('=')[1] ?? 900);
const pv = await startPreview(5193);
const results = [];
for (const ch of chapters) {
  const { browser, page, errors } = await openGame(pv.url, { query: '?headless&fast', width: 640, height: 360 });
  await page.waitForFunction(() => window.__nx && window.__nx.app.mode !== 'splash', null, { timeout: 30000 });
  await page.evaluate(([c, comps]) => { const nx = window.__nx; nx.app.launch(c); for (const id of comps) nx.giveComponent(id); }, [ch, comps]);
  await sleep(500);
  await page.evaluate(([c, m]) => window.__nx.bot.start(c, m), [ch, mode]);
  const t0 = Date.now();
  let st;
  for (;;) {
    await sleep(2000);
    st = await page.evaluate(() => ({ bot: window.__nx.bot.status, mode: window.__nx.app.mode, s: window.__nx.state() }));
    if (st.mode === 'results' || st.mode === 'credits' || st.bot?.done || st.bot?.failed || (Date.now() - t0) / 1000 > limitS) break;
  }
  const ok = (st.mode === 'results' || st.mode === 'credits' || st.bot?.done) && !st.bot?.failed;
  results.push({ chapter: ch, ok, mode, simSeconds: Math.round(st.s.time), deaths: st.s.deaths, lockdowns: st.s.lockdowns, takedowns: st.s.takedowns, failed: st.bot?.failed ?? null, errors: errors.slice(0, 5), lastLog: st.bot?.log.slice(-12) });
  console.log(JSON.stringify(results.at(-1)));
  await browser.close();
}
pv.stop();
fs.mkdirSync('artifacts', { recursive: true });
fs.writeFileSync(`artifacts/bot-${mode}${comps.length ? '-' + comps.join('+') : ''}.json`, JSON.stringify(results, null, 2));
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `BOT FAILED: ${failed.map((f) => f.chapter).join(', ')}` : `BOT OK: ${results.map((r) => r.chapter).join(', ')}`);
process.exit(failed.length ? 1 : 0);
