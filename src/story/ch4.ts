import * as THREE from 'three';
import type { ChapterScript } from './Script';
import { PALETTE } from '../../data/palette';

/** Chapter 4 — Under the Ice (24%). Darkness + visor reliance, Heavies, Hounds, water, the Conduit Flood. */
export const CH4_SCRIPT: ChapterScript = {
  chapter: { id: 'ch4', title: 'Under the Ice', beats: [{ id: 'tunnel', checkpoint: true }, { id: 'hall', checkpoint: true }, { id: 'runs', checkpoint: true }, { id: 'conduit', checkpoint: true }, { id: 'depot' }] },
  intro: 'c4.intro',
  sequences: [
    {
      id: 'c4.intro', cinematic: false, duration: 6,
      steps: [
        { at: 0, action: { kind: 'core', pct: 24 }, essential: true },
        { at: 0.3, action: { kind: 'line', id: 'c4.halcyon.core24' } },
        { at: 0.4, action: { kind: 'line', id: 'c4.ballast.dark' } },
        { at: 0.5, action: { kind: 'prompt', text: '<kbd>Q</kbd> visor scan — in the dark, it is how you see', seconds: 6 } },
        { at: 0.5, action: { kind: 'objective', text: 'Follow the conduits toward the yard', at: [0, 0, -80] }, essential: true },
      ],
    },
    {
      id: 'c4.flood', cinematic: false, duration: 3,
      steps: [
        { at: 0, action: { kind: 'flag', key: 'c4.flooding' }, essential: true },
        { at: 0, action: { kind: 'zone', id: 'conduitFlood', op: 'start' }, essential: true },
        { at: 0.1, action: { kind: 'lines', ids: ['c4.ballast.water', 'c4.ballast.conduit'] } },
        { at: 0.2, action: { kind: 'objective', text: 'Outrun the water', at: [0, 0, -350] }, essential: true },
        { at: 1.5, action: { kind: 'collapse', id: 'c4.steam1' } },
      ],
    },
    {
      id: 'c4.end', cinematic: true, skippable: true, replayable: true, title: 'The Forward Depot', duration: 6,
      steps: [
        { at: 0, action: { kind: 'zone', id: 'conduitFlood', op: 'complete' }, essential: true },
        { at: 0, action: { kind: 'shots', blendOut: 0.5, shots: [{ id: 'up', duration: 5, from: { p: [0, 1.7, -346], t: [0, 8, -360], fov: 55 }, to: { p: [0, 1.7, -349], t: [0, 12, -362], fov: 48 }, letterbox: 1 }] } },
        { at: 0.4, action: { kind: 'line', id: 'c4.ballast.depot' } },
        { at: 3.5, action: { kind: 'fade', to: 1, seconds: 2 } },
        { at: 5.6, action: { kind: 'flag', key: 'chapter.done' }, essential: true },
        { at: 5.7, action: { kind: 'endChapter' }, essential: true },
      ],
    },
  ],
  setup(ctx) {
    const { w } = ctx;
    w.atmo.darkness = 0.82; w.atmo.snowScale = 0;
    // a dim helmet lamp: enough to move, not enough to read the room (the visor does that)
    const lamp = w.lights.add({ pos: new THREE.Vector3(), color: PALETTE.cyan, intensity: 1.6, distance: 7, priority: 3 });
    w.onStep('c4.lamp', () => { if (w.player) lamp.pos.copy(w.player.pos).setY(w.player.pos.y + 1.7); });
    w.on('cache', (id) => { if (id === 'sc3') ctx.objective('Through the pump hall', [0, 0, -40]); });
    ctx.trigger('c4.hall', [-30, -1, -4], [30, 8, 3], () => { ctx.beat('hall'); ctx.checkpoint('hall'); });
    w.onStep('c4.heavyHint', () => { const p = w.player; const h = w.enemies.find((e) => e.key === 'c4-heavy'); if (p && h && h.alive && h.pos.distanceTo(p.pos) < 22 && ctx.once('c4.heavySaid')) { w.dialogue.say('c4.ballast.heavy'); w.hud.tutorialPrompt('heavy', 'Heavies are armoured in front — takedown from behind', 6); } });
    w.on('component', (id) => { if (id === 'arcBlade') w.dialogue.say('c4.ballast.arcBlade'); });
    ctx.trigger('c4.runs', [-44, -1, -90], [34, 8, -81], () => { ctx.beat('runs'); ctx.checkpoint('hounds'); w.dialogue.say('c4.ballast.hounds'); w.hud.tutorialPrompt('hounds', 'Hounds hunt by sound — walk, crouch, or throw a decoy (<kbd>T</kbd> cycle, <kbd>G</kbd> throw)', 7); });
    ctx.trigger('c4.conduit', [-6, -1, -150], [6, 8, -143], () => { ctx.beat('conduit'); ctx.play('c4.flood'); });
    ctx.trigger('c4.steam2', [-6, -1, -262], [6, 8, -255], () => w.collapse.trigger('c4.steam2'));
    // the flood front: segments fill in order as the clock runs; the last one fills at 0:00
    w.onStep('c4.front', () => {
      const z = w.zones.active; if (!z || z.id !== 'conduitFlood') return;
      const k = 1 - z.left / z.total;
      const front = k * 10 * 1.02;
      for (let i = 0; i < 10; i++) { const f = Math.max(0, Math.min(1, front - i)); w.hazards.setLevel(`c4.seg${i}`, -1.5 + f * 4); }
    });
    ctx.trigger('c4.depot', [-10, -1, -360], [10, 8, -343], () => { ctx.beat('depot'); ctx.play('c4.end'); });
  },
};
