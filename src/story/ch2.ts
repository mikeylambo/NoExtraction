import type { ChapterScript } from './Script';

/** Chapter 2 — Left Behind (58%). Lockdown, carbine, the first Timed Zone, the first story cache. */
export const CH2_SCRIPT: ChapterScript = {
  chapter: {
    id: 'ch2', title: 'Left Behind',
    beats: [{ id: 'motorpool', checkpoint: true }, { id: 'road', checkpoint: true }, { id: 'bridge', checkpoint: true }, { id: 'pad' }, { id: 'cache' }, { id: 'end' }],
  },
  intro: 'c2.intro',
  sequences: [
    {
      id: 'c2.intro', cinematic: false, duration: 9,
      steps: [
        { at: 0, action: { kind: 'core', pct: 58 }, essential: true },
        { at: 0.2, action: { kind: 'line', id: 'c2.halcyon.core58' } },
        { at: 0.3, action: { kind: 'call', fn: 'windowClock' }, essential: true },
        { at: 0.4, action: { kind: 'lines', ids: ['c2.wren.alarm', 'c2.ballast.alarm', 'c2.wren.carbine', 'c2.wren.armory'] } },
        { at: 0.5, action: { kind: 'objective', text: 'Cross the motor pool to the cliff road', at: [0, 0, -80] }, essential: true },
      ],
    },
    {
      id: 'c2.bridge', cinematic: false, duration: 3,
      steps: [
        { at: 0, action: { kind: 'flag', key: 'c2.zoneStarted' }, essential: true },
        { at: 0, action: { kind: 'zone', id: 'pad', op: 'start' }, essential: true },
        { at: 0.1, action: { kind: 'lines', ids: ['c2.wren.window', 'c2.ballast.bridge'] } },
        { at: 0.2, action: { kind: 'objective', text: 'Reach the pad', at: [0, 0, -352] }, essential: true },
        { at: 2.0, action: { kind: 'collapse', id: 'c2.debris1' } },
      ],
    },
    {
      id: 'c2.pad', cinematic: true, skippable: true, replayable: true, title: 'Four Minutes Late', duration: 22,
      steps: [
        { at: 0, action: { kind: 'zone', id: 'pad', op: 'complete' }, essential: true },
        { at: 0, action: { kind: 'flag', key: 'c2.atPad' }, essential: true },
        { at: 0, action: { kind: 'call', fn: 'shipLift' } },
        { at: 0, action: { kind: 'music', cue: 'wren' } },
        { at: 0, action: { kind: 'shots', blendOut: 1.0, shots: [
          { id: 'ship', duration: 7, from: { p: [-6, 2.4, -350], t: [0, 70, -430], fov: 55 }, to: { p: [-4, 2.2, -356], t: [0, 140, -480], fov: 50 }, letterbox: 1 },
          { id: 'ballast', duration: 7, from: { p: [5, 2.4, -362], t: [0, 1.4, -352], fov: 45 }, to: { p: [3.6, 2, -360], t: [0, 1.4, -352], fov: 40 }, letterbox: 1 },
          { id: 'quake', duration: 8, from: { p: [0, 14, -330], t: [0, 0, -300], fov: 60 }, to: { p: [0, 18, -322], t: [0, -10, -270], fov: 60 }, shake: 0.35, letterbox: 1 },
        ] } },
        { at: 0.3, action: { kind: 'lines', ids: ['c2.wren.climbing', 'c2.ballast.wait'] } },
        { at: 7.4, action: { kind: 'line', id: 'c2.halcyon.revoke' } },
        { at: 14.3, action: { kind: 'lines', ids: ['c2.ballast.pad1', 'c2.ballast.pad2'] } },
        { at: 15, action: { kind: 'shake', amount: 0.35 } },
        { at: 15, action: { kind: 'call', fn: 'quake' }, essential: true },
        { at: 17, action: { kind: 'line', id: 'c2.ballast.quake' } },
        { at: 21, action: { kind: 'objective', text: 'The amber light — Ava left something', at: [0, 0.3, -380] }, essential: true },
        { at: 21, action: { kind: 'checkpoint', id: 'pad' }, essential: true },
      ],
    },
    {
      id: 'c2.end', duration: 6,
      steps: [
        { at: 0, action: { kind: 'line', id: 'c2.ballast.yard' } },
        { at: 3, action: { kind: 'fade', to: 1, seconds: 2 } },
        { at: 5.2, action: { kind: 'flag', key: 'chapter.done' }, essential: true },
        { at: 5.3, action: { kind: 'endChapter' }, essential: true },
      ],
    },
  ],
  hooks: {
    windowClock: ({ w }) => { if (!w.state.has('c2.zoneStarted')) w.zones.startNarrative('window', 'Extraction window', 150); },
    shipLift: ({ w }) => w.emit('c2.shipLift'),
    quake: ({ w }) => {
      // the first major quake: the bridge behind him goes into the chasm
      for (let i = 0; i < 12; i++) w.collapse.trigger(`c2.fall${i}`);
      w.atmo.flare = 0.6;
    },
  },
  setup(ctx) {
    const { w } = ctx;
    w.on('weapon', (id) => { if (id === 'carbine' && ctx.once('c2.carbineTip')) w.hud.tutorialPrompt('carbine', '<kbd>1</kbd>/<kbd>2</kbd> swap — the carbine is loud', 5); });
    w.on('component', (id) => { if (id === 'missileRack') w.dialogue.say('c2.ballast.missileRack'); });
    w.on('lockdown', () => { if (ctx.once('c2.lockTip')) w.hud.tutorialPrompt('lockdown', 'Fast gates sealed — hack a console or take the long way', 6); });
    // an aurora flare over the motor pool: radios, alarms and the visor go dark for 10 s — a window
    ctx.trigger('c2.auroraT', [-55, -1, -12], [55, 8, -4], () => {
      w.collapse.trigger('c2.aurora');
      w.hud.tutorialPrompt('aurora', 'Aurora flare — their radios and alarms are down for a few seconds', 6);
    });
    ctx.trigger('c2.armory', [55, -1, -80], [100, 8, 30], () => ctx.checkpoint('armory'));
    ctx.trigger('c2.road', [-55, -1, -100], [40, 8, -84], () => { ctx.beat('road'); ctx.checkpoint('road'); ctx.objective('Follow the cliff road to the bridge', [0, 0, -196]); });
    // the Pad: the bridge starts collapsing the moment you're on it
    ctx.trigger('c2.bridge', [-6, -1, -199], [6, 8, -194], () => { ctx.beat('bridge'); ctx.play('c2.bridge'); });
    ctx.trigger('c2.d2', [-6, -2, -246], [6, 8, -240], () => { w.collapse.trigger('c2.debris2'); w.collapse.trigger('c2.gantryFall'); });
    ctx.trigger('c2.d3', [-6, -2, -280], [6, 8, -274], () => w.collapse.trigger('c2.debris3'));
    // sections fall behind the player while the clock runs (lost cause: the ship is already climbing)
    w.onStep('c2.chase', () => {
      const z = w.zones.active; if (!z || z.id !== 'pad') return;
      const k = 1 - z.left / z.total;
      const upto = Math.floor(k * 12) - 1;
      for (let i = 0; i <= upto; i++) w.collapse.trigger(`c2.fall${i}`);
    });
    ctx.trigger('c2.pad', [-14, -1, -356], [14, 8, -345], () => { ctx.beat('pad'); ctx.play('c2.pad'); });
    w.on('cache', (id) => { if (id === 'sc1') { ctx.beat('cache'); const off = w.on('line:end', (l) => { if (l === 'c2.ballast.cache1reply') { off(); ctx.play('c2.end'); } }); } });
    w.on('zone:fail', () => w.dialogue.say('c2.ballast.bridgeFail'));
  },
};
