import { Ascent } from '../mech/Ascent';
import { ASCENT } from '../../data/aegis';
import type { ChapterScript } from './Script';

/** Chapter 6 — Ascent (2% → 0%). Climb, strip, break atmosphere, the planet, Wren, the final line. */
export const CH6_SCRIPT: ChapterScript = {
  chapter: { id: 'ch6', title: 'Ascent', beats: [{ id: 'launch', checkpoint: true }, { id: 'climb' }, { id: 'silence' }, { id: 'wren' }, { id: 'end' }] },
  intro: 'c6.launch',
  sequences: [
    {
      id: 'c6.launch', cinematic: false, duration: 5,
      steps: [
        { at: 0, action: { kind: 'core', pct: 2 }, essential: true },
        { at: 0.2, action: { kind: 'line', id: 'c6.halcyon.core2' } },
        { at: 0.3, action: { kind: 'objective', text: 'Climb', at: undefined }, essential: true },
        { at: 3.0, action: { kind: 'line', id: 'c6.aegis.launch' } },
        { at: 3.2, action: { kind: 'call', fn: 'ignite' }, essential: true },
        { at: 4.0, action: { kind: 'line', id: 'c6.ballast.launch' } },
        { at: 4.2, action: { kind: 'prompt', text: '<kbd>WASD</kbd> steer clear of the debris', seconds: 5 } },
      ],
    },
    {
      id: 'c6.end', cinematic: true, skippable: false, replayable: true, title: 'You’re Late', duration: 33,
      steps: [
        { at: 0, action: { kind: 'call', fn: 'view', arg: 'cockpit' }, essential: true },
        { at: 2.4, action: { kind: 'line', id: 'c6.ballast.drift' } },
        { at: 4.5, action: { kind: 'call', fn: 'view', arg: 'planet' }, essential: true },
        { at: 5.0, action: { kind: 'call', fn: 'breakAnim' }, essential: true },
        { at: 15.5, action: { kind: 'call', fn: 'view', arg: 'ship' }, essential: true },
        { at: 15.5, action: { kind: 'call', fn: 'shipAnim' }, essential: true },
        { at: 18.0, action: { kind: 'line', id: 'c6.wren.return' } },
        { at: 24.5, action: { kind: 'call', fn: 'view', arg: 'cockpit' }, essential: true },
        { at: 25.5, action: { kind: 'line', id: 'c6.ballast.final' } },
        { at: 28.6, action: { kind: 'fade', to: 1, seconds: 0.05 } },
        { at: 32.5, action: { kind: 'flag', key: 'chapter.done' }, essential: true },
        { at: 32.6, action: { kind: 'endChapter' }, essential: true },
      ],
    },
  ],
  hooks: {
    ignite: ({ w, session }) => {
      w.state.set('ascent.started');
      const asc = w.ascent!;
      asc.start(w.state.num('ascent.progress', 0), w.state.num('ascent.jett', 0));
      session.ambientMusic();
    },
    view: ({ w }, arg) => { w.ascentView = arg as typeof w.ascentView; },
    breakAnim: ({ w }) => { let t = 0; w.onStep('c6.break', (dt) => { t += dt; w.ascent?.breakPlanet(Math.min(1, t / 11)); if (t > 11) w.offStep('c6.break'); }); },
    shipAnim: ({ w }) => { let t = 0; w.onStep('c6.ship', (dt) => { t += dt; w.ascent?.shipApproach(Math.min(1, t / 11)); if (t > 13) w.offStep('c6.ship'); }); },
  },
  setup(ctx) {
    const { w, session } = ctx;
    const a = w.aegis!;
    a.active = true; a.frame.locked = true;
    w.ascent = new Ascent(w);
    w.state.set('allPersonalCaches', ['pc1', 'pc2', 'pc3', 'pc4'].every((id) => w.inventory.caches.includes(id)));
    w.ascent.onJettison = (i) => {
      const j = ASCENT.jettisons[i]!;
      w.dialogue.say(j.line);
      if (i === 0) w.dialogue.say('c6.ballast.jettison1');
      if (i === 2) w.dialogue.say('c6.ballast.jettison3');
      w.state.set('ascent.jett', i + 1); w.state.set('ascent.progress', j.at);
      session.saveCheckpoint(`jettison${i}`, { pos: [0, 0, 0], yaw: 0, mech: true });
    };
    w.onStep('c6.atmoLine', () => { if (w.ascent && w.ascent.progress > 0.96 && ctx.once('c6.atmoSaid')) w.dialogue.say('c6.aegis.atmo'); });
    w.ascent.onBreak = () => { ctx.beat('silence'); ctx.play('c6.end'); };
    // a checkpoint mid-climb restarts the climb from the last jettison
    if (w.state.has('ascent.started')) session.callHook('ignite');
  },
};
