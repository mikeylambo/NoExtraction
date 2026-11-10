import type { ChapterScript } from './Script';

/**
 * Chapter 1 — The Job. Onboarding through the mission (GDD §16), Ava live on the radio.
 * Prompts are contextual and fade permanently after two successful uses; nothing pauses play.
 */
export const CH1_SCRIPT: ChapterScript = {
  chapter: {
    id: 'ch1', title: 'The Job',
    beats: [
      { id: 'ridge', checkpoint: true }, { id: 'firstPatrol' }, { id: 'pair' }, { id: 'courtyard', checkpoint: true },
      { id: 'inner', checkpoint: true }, { id: 'hangar', checkpoint: true }, { id: 'sabotage' }, { id: 'window', checkpoint: true }, { id: 'exit' },
    ],
  },
  intro: 'c1.intro',
  sequences: [
    {
      id: 'c1.intro', cinematic: true, skippable: true, replayable: true, title: 'The Job', duration: 15,
      steps: [
        { at: 0, action: { kind: 'core', pct: 72 }, essential: true },
        { at: 0, action: { kind: 'shots', blendOut: 1.2, shots: [
          { id: 'valley', duration: 6, from: { p: [30, 30, 260], t: [0, 8, 60], fov: 45 }, to: { p: [14, 22, 236], t: [0, 6, 40], fov: 42 }, letterbox: 1 },
          { id: 'ridge', duration: 7, from: { p: [3, 8.4, 214], t: [0, 7, 196], fov: 50 }, to: { p: [1.4, 7.9, 211.5], t: [0, 7, 190], fov: 58 }, blendIn: 1.2, letterbox: 1 },
        ] } },
        { at: 0.6, action: { kind: 'line', id: 'c1.halcyon.core72' } },
        { at: 0.6, action: { kind: 'lines', ids: ['c1.wren.open1', 'c1.ballast.open1', 'c1.wren.open2'] } },
        { at: 0.5, action: { kind: 'objective', text: 'Infiltrate the Sable complex', at: [0, 0, 60] }, essential: true },
      ],
    },
    {
      id: 'c1.hangar', cinematic: true, skippable: true, replayable: true, title: 'FLAMINGO-07', duration: 9,
      steps: [
        { at: 0, action: { kind: 'shots', blendOut: 0.9, shots: [
          { id: 'reveal', duration: 5, from: { p: [-6, 2, -96], t: [0, 7, -125], fov: 50 }, to: { p: [-3, 1.6, -103], t: [0, 9, -125], fov: 42 }, letterbox: 1 },
          { id: 'face', duration: 4, from: { p: [4, 9, -116], t: [0, 9.5, -125], fov: 38 }, to: { p: [2, 9.5, -117.5], t: [0, 9.5, -125], fov: 34 }, letterbox: 1 },
        ] } },
        { at: 0.2, action: { kind: 'lines', ids: ['c1.wren.hangar1', 'c1.ballast.hangar1', 'c1.wren.hangar2'] } },
        { at: 0.1, action: { kind: 'objective', text: 'Pull the flight governor from FLAMINGO-07', at: [0, 1, -132.5] }, essential: true },
      ],
    },
    {
      id: 'c1.sabotage', duration: 7,
      steps: [
        { at: 0, action: { kind: 'flag', key: 'c1.sabotaged' }, essential: true },
        { at: 0, action: { kind: 'sfx', id: 'mech.systemloss' } },
        { at: 0.3, action: { kind: 'lines', ids: ['c1.ballast.sabotage', 'c1.wren.tube', 'c1.ballast.tube'] } },
        { at: 0.5, action: { kind: 'objective', text: 'Drop the governor in the cargo tube', at: [-24, 1, -144] }, essential: true },
      ],
    },
    {
      id: 'c1.window', duration: 6,
      steps: [
        { at: 0, action: { kind: 'flag', key: 'c1.window' }, essential: true },
        { at: 0, action: { kind: 'call', fn: 'openRear' }, essential: true },
        { at: 0.2, action: { kind: 'lines', ids: ['c1.wren.window', 'c1.ballast.window', 'c1.wren.window2'] } },
        { at: 0.4, action: { kind: 'call', fn: 'windowClock' }, essential: true },
        { at: 0.5, action: { kind: 'objective', text: 'Get to the extraction pad', at: [0, 0, -198] }, essential: true },
        { at: 1, action: { kind: 'checkpoint', id: 'exit' }, essential: true },
      ],
    },
    {
      id: 'c1.end', cinematic: false, duration: 4,
      steps: [
        { at: 0, action: { kind: 'line', id: 'c1.wren.exit' } },
        { at: 1.6, action: { kind: 'fade', to: 1, seconds: 1.6 } },
        { at: 3.6, action: { kind: 'flag', key: 'chapter.done' }, essential: true },
        { at: 3.7, action: { kind: 'endChapter' }, essential: true },
      ],
    },
  ],
  hooks: {
    openRear: ({ w }) => { w.gates.open('c1.rear'); w.state.set('gate.c1.rear.opened'); },
    windowClock: ({ w }) => { w.state.set('c1.windowStartedAt', w.simTime); w.zones.startNarrative('window', 'Extraction window', 480); },
  },
  setup(ctx) {
    const { w } = ctx;
    const hud = w.hud;
    // 1. ridge: move, camera, sprint
    if (!w.state.has('c1.ridgeDone')) {
      hud.tutorialPrompt('move', '<kbd>WASD</kbd> move  ·  <kbd>Mouse</kbd> look', 7);
      ctx.trigger('c1.sprintHint', [-6, 5, 196], [6, 10, 204], () => hud.tutorialPrompt('sprint', 'Hold <kbd>Shift</kbd> to sprint', 5));
      ctx.trigger('c1.vaultHint', [-6, 5, 186.5], [6, 10, 192], () => hud.tutorialPrompt('vault', '<kbd>Space</kbd> vault low cover', 5));
      ctx.trigger('c1.mantleHint', [-6, 5, 174], [6, 10, 180], () => hud.tutorialPrompt('mantle', '<kbd>Space</kbd> climb', 5));
    }
    w.on('player:vault', () => hud.learned('vault'));
    w.on('player:mantle', () => hud.learned('mantle'));
    w.onStep('c1.learnSprint', () => { if (w.player?.sprinting) { hud.learned('sprint'); w.offStep('c1.learnSprint'); } if (w.player && w.player.speed > 1) hud.learned('move'); });
    // 2. first patrol: crouch, takedown from behind
    ctx.trigger('c1.firstPatrol', [-30, -1, 140], [30, 8, 150], () => {
      w.state.set('c1.ridgeDone'); ctx.beat('firstPatrol'); ctx.checkpoint('outer');
      w.dialogue.say('c1.wren.firstPatrol');
      hud.tutorialPrompt('crouch', '<kbd>C</kbd> crouch — quieter, harder to see', 6);
      ctx.objective('Take down the trooper', [0, 0, 122]);
    });
    w.on('player:takedown', () => {
      hud.learned('takedown');
      if (ctx.once('c1.cleanSaid')) w.dialogue.say('c1.wren.clean');
    });
    w.onStep('c1.tdPrompt', () => {
      const p = w.player; if (!p) return;
      if (p.takedownCandidate && !p.chainCandidate) hud.tutorialPrompt('takedown', '<kbd>F</kbd> takedown — from behind, unaware targets', 3);
      if (p.chainCandidate) hud.tutorialPrompt('chain', '<kbd>F</kbd> again — chain takedown', 2);
      if (p.crouched) hud.learned('crouch');
    });
    // 3. the pair: chain
    ctx.trigger('c1.pair', [-30, -1, 100], [30, 8, 112], () => { ctx.beat('pair'); w.dialogue.say('c1.wren.pair'); ctx.objective('Drop both troopers', [0, 0, 89]); });
    w.on('player:chain', () => { hud.learned('chain'); if (ctx.once('c1.chainSaid')) w.dialogue.say('c1.wren.chainDone'); });
    // 4. courtyard: visor, fast vs long route
    ctx.trigger('c1.courtyard', [-10, -1, 58], [10, 8, 66], () => {
      ctx.beat('courtyard'); ctx.checkpoint('courtyard');
      w.dialogue.sayAll(['c1.wren.visor', 'c1.wren.fastGate', 'c1.wren.longRoute']);
      hud.tutorialPrompt('scan', '<kbd>Q</kbd> visor scan — marks enemies and their sightlines', 7);
      ctx.objective('Through the courtyard — cyan gate, or the service yard', [0, 0, -20]);
    });
    w.onStep('c1.learnScan', () => { if ((w.player?.visor.uses ?? 0) > 0) { hud.learned('scan'); if (w.player!.visor.uses > 1) w.offStep('c1.learnScan'); } });
    // steam vents in the service yard are part of its hazard run
    ctx.trigger('c1.steamA', [44, -1, 34], [72, 6, 46], () => w.collapse.trigger('c1.steamA'));
    ctx.trigger('c1.steamB', [44, -1, -24], [72, 6, -14], () => w.collapse.trigger('c1.steamB'));
    ctx.trigger('c1.service', [42, -1, -30], [74, 6, -24], () => ctx.checkpoint('service'));
    // 5. inner yard: spotter
    ctx.trigger('c1.inner', [-38, -1, -32], [38, 8, -22], () => {
      ctx.beat('inner'); ctx.checkpoint('inner');
      w.dialogue.say('c1.wren.spotter');
      ctx.objective('Reach the hangar', [0, 0, -90]);
      w.dialogue.say('c1.halcyon.tremor');
    });
    ctx.trigger('c1.innerFromService', [32, -1, -110], [40, 8, -98], () => { if (ctx.once('c1.svcHangar')) { ctx.objective('Reach the hangar', [0, 0, -100]); } });
    // alert reactions
    w.on('lockdown', () => { if (ctx.once('c1.lockSaid')) w.dialogue.say('c1.wren.lockdown'); });
    w.onStep('c1.seen', () => { if (w.alert.level() >= 2 && ctx.once('c1.seenSaid')) w.dialogue.say('c1.wren.seen'); });
    // 6. hangar
    ctx.trigger('c1.hangar', [-31, -1, -100], [31, 12, -91], () => { if (ctx.once('c1.hangarSeen')) { ctx.beat('hangar'); ctx.checkpoint('hangar'); ctx.play('c1.hangar'); } });
    ctx.trigger('c1.hangarSide', [26, -1, -110], [32, 6, -98], () => { if (ctx.once('c1.hangarSeen')) { ctx.beat('hangar'); ctx.checkpoint('hangar'); ctx.play('c1.hangar'); } });
    w.on('c1.sabotage', () => { ctx.beat('sabotage'); ctx.play('c1.sabotage'); });
    w.on('c1.tube', () => { w.state.set('c1.tubed'); ctx.beat('window'); ctx.play('c1.window'); });
    if (w.state.has('c1.window')) { w.gates.open('c1.rear'); const left = 480 - (w.simTime - (w.state.num('c1.windowStartedAt'))); w.zones.startNarrative('window', 'Extraction window', Math.max(300, left)); }
    // 7. exit
    ctx.trigger('c1.exit', [-6, -1, -200], [6, 8, -190], () => { ctx.beat('exit'); ctx.play('c1.end'); }, 'c1.window');
  },
};
