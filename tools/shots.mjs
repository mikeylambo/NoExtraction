// Screenshot tour: every chapter, set piece, HUD state and menu (artifacts/shots).
import { startPreview, openGame, sleep } from './browser.mjs';
import fs from 'node:fs';
const OUT = process.argv[2] ?? 'artifacts/shots';
const only = process.argv[3]?.split(',');
fs.mkdirSync(OUT, { recursive: true });
const pv = await startPreview(5210);
const { browser, page, errors } = await openGame(pv.url, { query: '', width: 1280, height: 720 });
const nx = (fn, arg) => page.evaluate(fn, arg);
const shot = async (name) => { await page.screenshot({ path: `${OUT}/${name}.png` }); console.log('shot', name); };
const settle = (ms = 2500) => sleep(ms);
await page.waitForFunction(() => window.__nx);
const want = (k) => !only || only.includes(k);
if (want('menus')) {
  await settle(1500); await shot('00-splash');
  await page.keyboard.press('Enter'); await settle(1500); await shot('01-title');
  await nx(() => window.__nx.app.showMenu('options')); await nx(() => { const a = window.__nx.app; a['optionsPage'] = 'accessibility'; a['showOptionsPage'](); }); await settle(700); await shot('02-options-accessibility');
  await nx(() => window.__nx.app['showChapterSelect']()); await settle(700); await shot('03-chapter-select');
} else { await page.keyboard.press('Enter'); await settle(800); }
const tour = {
  ch1: [[3, 'ch1-intro-cinematic'], [-1, null, (n) => { n.skip(); }], [3, 'ch1-ridge'], [0, null, (n) => { n.teleport(-6, 0, 140); }], [3, 'ch1-first-patrol'], [0, null, (n) => { n.teleport(-30, 0, 50); n.app.session.w.player.visor.pulse(); }], [1.2, 'ch1-courtyard-visor'], [0, null, (n) => { n.setAlert('hunted'); }], [2.5, 'ch1-hud-hunted'], [0, null, (n) => { n.setAlert('lockdown'); }], [2, 'ch1-hud-lockdown'], [0, null, (n) => { n.teleport(0, 0, -100); n.setAlert('unaware'); }], [8, 'ch1-hangar-aegis']],
  ch2: [[-1, null, (n) => n.skip()], [3, 'ch2-motor-pool'], [0, null, (n) => { n.teleport(0, 0, -205); n.triggerBeat('c2.bridge'); }], [4, 'ch2-the-pad-bridge'], [0, null, (n) => { n.teleport(0, 0, -350); }], [6, 'ch2-wren-ship'], [6, 'ch2-quake']],
  ch3: [[-1, null, (n) => n.skip()], [4, 'ch3-dead-colony'], [0, null, (n) => { n.teleport(0, 0, -96); }], [4, 'ch3-mast-plaza'], [0, null, (n) => { n.teleport(0, -16, -200); n.triggerBeat('c3.flood'); }], [4, 'ch3-freight-lift-flood']],
  ch4: [[-1, null, (n) => n.skip()], [3, 'ch4-dark'], [0, null, (n) => n.app.session.w.player.visor.pulse()], [1.0, 'ch4-visor-in-dark'], [0, null, (n) => { n.teleport(0, 0, -150); n.triggerBeat('c4.flood'); }], [8, 'ch4-conduit-flood']],
  ch5: [[-1, null, (n) => n.skip()], [2, 'ch5-depot'], [0, null, (n) => { n.app.session.w.state.set('c5.canBoard'); n.triggerBeat('c5.boot'); }], [7, 'ch5-boot-up'], [6, 'ch5-online'], [0, null, (n) => { n.app.session.w.aegis.frame.pos.set(0, 0, -400); }], [5, 'ch5-wardens'], [0, null, (n) => { n.app.session.w.state.set('c5.wardensDone'); n.app.session.w.aegis.frame.pos.set(0, 0, -880); }], [5, 'ch5-shelf-run'], [0, null, (n) => { const w = n.app.session.w; w.state.set('c5.ambushDone'); w.aegis.frame.pos.set(0, 0, -9050); }], [17, 'ch5-marshal'], [6, 'ch5-marshal-fight']],
  ch6: [[6, 'ch6-launch'], [20, 'ch6-climb'], [0, null, (n) => { const a = n.app.session.w.ascent; a.progress = 0.99; n.app.session.w.aegis.frame.pos.y = 99500; }], [6, 'ch6-silence'], [12, 'ch6-planet-breaks'], [10, 'ch6-wren']],
};
for (const [ch, steps] of Object.entries(tour)) {
  if (!want(ch)) continue;
  await nx((c) => window.__nx.app.launch(c), ch); await settle(1500);
  for (const [wait, name, fn] of steps) {
    if (fn) await page.evaluate(`(${fn.toString()})(window.__nx)`);
    if (wait > 0) await sleep(wait * 1000);
    if (name) await shot(name);
  }
}
console.log('ERRORS', errors.slice(0, 8).join('\n'));
await browser.close(); pv.stop(); process.exit(0);
