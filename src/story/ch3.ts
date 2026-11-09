import * as THREE from 'three';
import type { ChapterScript } from './Script';

/** Chapter 3 — Dead Colony (41%). Shotgun, alternate routes, collapse events as tools, personal caches, the Freight Lift. */
export const CH3_SCRIPT: ChapterScript = {
  chapter: {
    id: 'ch3', title: 'Dead Colony',
    beats: [{ id: 'street', checkpoint: true }, { id: 'plaza', checkpoint: true }, { id: 'freight', checkpoint: true }, { id: 'lift' }, { id: 'bay', checkpoint: true }, { id: 'end' }],
  },
  intro: 'c3.intro',
  sequences: [
    {
      id: 'c3.intro', cinematic: true, skippable: true, replayable: true, title: 'Dead Colony', duration: 9,
      steps: [
        { at: 0, action: { kind: 'core', pct: 41 }, essential: true },
        { at: 0, action: { kind: 'shots', blendOut: 1.2, shots: [
          { id: 'street', duration: 8, from: { p: [6, 14, 70], t: [0, 4, 0], fov: 50 }, to: { p: [2, 9, 66], t: [0, 3, 10], fov: 46 }, letterbox: 1 },
        ] } },
        { at: 0.3, action: { kind: 'line', id: 'c3.halcyon.core41' } },
        { at: 0.4, action: { kind: 'line', id: 'c3.ballast.open' } },
        { at: 0.5, action: { kind: 'objective', text: 'Find a way through the colony to the freight lift', at: [0, 0, -150] }, essential: true },
      ],
    },
    {
      id: 'c3.lift', cinematic: false, duration: 12,
      steps: [
        { at: 0, action: { kind: 'flag', key: 'c3.riding' }, essential: true },
        { at: 0, action: { kind: 'sfx', id: 'structure.groan' } },
        { at: 0.5, action: { kind: 'call', fn: 'descend' }, essential: true },
        { at: 1, action: { kind: 'line', id: 'c3.ballast.liftDown' } },
      ],
    },
    {
      id: 'c3.flood', cinematic: false, duration: 3,
      steps: [
        { at: 0, action: { kind: 'flag', key: 'c3.inBay' }, essential: true },
        { at: 0, action: { kind: 'zone', id: 'freightLift', op: 'start' }, essential: true },
        { at: 0.1, action: { kind: 'line', id: 'c3.ballast.freightLift' } },
        { at: 0.2, action: { kind: 'objective', text: 'Release both hatch locks before the bay floods', at: [-38, -16, -180] }, essential: true },
      ],
    },
    {
      id: 'c3.end', duration: 4,
      steps: [
        { at: 0, action: { kind: 'zone', id: 'freightLift', op: 'complete' }, essential: true },
        { at: 0.5, action: { kind: 'fade', to: 1, seconds: 2 } },
        { at: 3, action: { kind: 'flag', key: 'chapter.done' }, essential: true },
        { at: 3.1, action: { kind: 'endChapter' }, essential: true },
      ],
    },
  ],
  hooks: {
    descend: ({ w }) => {
      const car = w.collapse.solidsByTag('c3.car')[0]; if (!car) return;
      let y = 0; const Y = -16;
      w.onStep('c3.car', (dt) => {
        y = Math.max(Y, y - dt * 1.7);
        w.collision.move(car, new THREE.Vector3(car.min.x, y - 0.4, car.min.z), new THREE.Vector3(car.max.x, y, car.max.z));
        if (car.mesh) car.mesh.position.y = y - 0.2;
        if (Math.floor(y) !== Math.floor(y + dt * 1.7)) w.addShake(0.04);
        if (y <= Y) { w.offStep('c3.car'); w.state.set('c3.carDown'); w.emit('c3.carDown'); }
      });
    },
  },
  setup(ctx) {
    const { w } = ctx;
    w.on('weapon', (id) => { if (id === 'shotgun') { w.dialogue.say('c3.ballast.shotgun'); w.hud.tutorialPrompt('shotgun', 'Breacher opens weakened doors — loud', 5); } });
    ctx.trigger('c3.weak', [-8, -1, -40], [8, 6, -32], () => w.dialogue.say('c3.ballast.weakDoor'));
    w.onStep('c3.towerHint', () => {
      const p = w.player; if (!p || w.state.applied('collapse.c3.tower')) return;
      if (p.pos.distanceTo(new THREE.Vector3(18, 0, -26)) < 26 && w.enemies.some((e) => e.alive && e.pos.distanceTo(new THREE.Vector3(15, 0, -29)) < 6) && ctx.once('c3.towerSaid')) {
        w.dialogue.say('c3.ballast.collapseTool');
        w.hud.tutorialPrompt('towerTool', 'Shoot the tower\'s weakened leg with the breacher', 6);
      }
    });
    ctx.trigger('c3.plaza', [-48, -1, -66], [48, 8, -56], () => { ctx.beat('plaza'); ctx.checkpoint('plaza'); ctx.objective('The radio mast — then the freight building', [0, 0, -100]); });
    // snowstorm debris field over the plaza (telegraphed; it hits Sable too)
    let debrisT = 6;
    w.onStep('c3.debris', (dt) => {
      const p = w.focusPos();
      if (p.z > -58 || p.z < -142) return;
      debrisT -= dt; if (debrisT > 0) return;
      debrisT = 7 + w.rng.next() * 5;
      const a = w.rng.next() * Math.PI * 2, r = 10 + w.rng.next() * 18;
      w.collapse.trigger({ id: `c3.debris.${w.simTime.toFixed(1)}`, kind: 'debris', at: [p.x + Math.cos(a) * r, 0, p.z + Math.sin(a) * r], radius: 8 });
    });
    w.on('cache', (id) => { if (id === 'sc2') { ctx.objective('Freight lift — north of the plaza', [0, 0, -156]); w.hud.toast('Route marked', 'amber'); } });
    ctx.trigger('c3.freight', [-18, -1, -158], [18, 10, -150], () => { ctx.beat('freight'); ctx.checkpoint('freight'); ctx.objective('Take the freight lift down', [0, 0, -175]); });
    ctx.trigger('c3.onCar', [-4.5, -0.5, -179.5], [4.5, 3, -170.5], () => { ctx.beat('lift'); ctx.play('c3.lift'); }, 'objective');
    w.on('c3.carDown', () => { ctx.beat('bay'); ctx.play('c3.flood'); });
    // water follows the clock
    w.onStep('c3.water', () => {
      const z = w.zones.active;
      if (z && z.id === 'freightLift') { const k = 1 - z.left / z.total; w.hazards.setLevel('c3.flood', -19 + k * 4.9); }
      if (z && z.id === 'freightLift' && z.left < 30 && ctx.once('c3.waterSaid')) w.dialogue.say('c4.ballast.water');
    });
    w.on('zone:fail', (id) => { if (id === 'freightLift') w.dialogue.say('c3.ballast.liftFlood'); });
    w.on('component', (id) => { if (id === 'flightGovernor') w.dialogue.say('c3.ballast.governor'); });
    let levers = 0;
    w.on('c3.lever', () => {
      levers++;
      if (levers >= 2) { w.gates.open('c3.hatch'); w.state.set('gate.c3.hatch.opened'); ctx.objective('Through the conduit hatch', [0, -16, -282]); w.audio.sfx('gate.slam', null, 0.6); }
      else ctx.objective('One more hatch lock', [38, -16, -240]);
    });
    if (w.state.has('used.c3.leverA') && w.state.has('used.c3.leverB')) w.gates.open('c3.hatch');
    // restoring at the bay checkpoint: the car is already down
    if (w.state.has('c3.carDown')) { const car = w.collapse.solidsByTag('c3.car')[0]; if (car) { w.collision.move(car, new THREE.Vector3(car.min.x, -16.4, car.min.z), new THREE.Vector3(car.max.x, -16, car.max.z)); if (car.mesh) car.mesh.position.y = -16.2; } }
    ctx.trigger('c3.exit', [-2, -17, -296], [2, -12, -284], () => { ctx.beat('end'); ctx.play('c3.end'); });
  },
};
