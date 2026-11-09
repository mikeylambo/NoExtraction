import type { LevelDef } from '../Level';
import { wallLine, crates, truck, tank, tower, lamp, rocks, pipes, routeSigns } from './kit';
import { buildWrenShip } from '../Ships';

/**
 * Chapter 2 — Left Behind (58%). Motor pool (lockdown lesson, carbine) → optional armory (Missile
 * Rack) → cliff road → The Pad (Timed Zone 1:30 over the bridge) → the pad: Wren's ship climbing.
 */
export const CH2: LevelDef = {
  id: 'ch2',
  music: 'infiltration',
  spawn: { pos: [0, 0, 44], yaw: 0 },
  checkpoints: {
    start: { pos: [0, 0, 44], yaw: 0 },
    road: { pos: [0, 0, -92], yaw: 0 },
    armory: { pos: [58, 0, -40], yaw: -Math.PI / 2 },
    bridge: { pos: [0, 0, -196], yaw: 0 },
    pad: { pos: [0, 0, -352], yaw: 0 },
  },
  build(ctx) {
    const b = ctx.b, w = ctx.w;
    // ground up to the cliff edge at z = -200 (chasm beyond)
    b.floor(0, -70, 260, 270, 0);
    rocks(ctx, -130, -205, -60, 60, 26, 21, 8, 20);
    rocks(ctx, 100, -205, 130, 60, 18, 22, 8, 20);
    b.at(-6, 52, 1, 18, 6, 0, { mat: 'rock', kind: 'wall' }); b.at(6, 52, 1, 18, 6, 0, { mat: 'rock', kind: 'wall' }); b.at(0, 52, 13, 18, 1, 6, { mat: 'rock', kind: 'wall' });
    b.at(0, 61, 13, 1, 6, 0, { mat: 'rock', kind: 'wall' });
    ctx.landmark([300, 0, -2600], 'yard');

    // ------------------------------------------------ motor pool (lockdown lesson)
    wallLine(ctx, -55, 34, 55, 34, 5, [{ at: 0, width: 12 }]);
    wallLine(ctx, -55, 34, -55, -80, 5, [{ at: -20, width: 3 }]);
    wallLine(ctx, 55, 34, 55, -80, 5, [{ at: -36, width: 3 }]);
    wallLine(ctx, -55, -80, 55, -80, 5, [{ at: 0, width: 4.4 }, { at: -46, width: 3 }]);
    ctx.gate({ id: 'c2.fast', min: [-2.2, 0, -80.4], max: [2.2, 4.2, -79.6], area: 'motorpool', fast: true, console: [5, 0, -77] });
    routeSigns(ctx, [0, 4.6, -79.4], 0);
    for (const [x, z, al] of [[-30, 14, false], [-14, -4, true], [18, 10, false], [30, -30, true], [-28, -46, false], [8, -54, true]] as const) truck(ctx, x, z, al);
    crates(ctx, -44, 22, 5, 31); crates(ctx, 36, 22, 4, 32); crates(ctx, -8, -30, 6, 33); crates(ctx, 22, -60, 5, 34); crates(ctx, -40, -66, 4, 35);
    tank(ctx, 44, -12, 2.5, 6); pipes(ctx, -20, -16, 12, false); pipes(ctx, 0, 6, 16, true);
    lamp(ctx, -50, 30); lamp(ctx, 50, 30); lamp(ctx, -50, -76); lamp(ctx, 50, -76); lamp(ctx, 0, -40, 7);
    ctx.pickup('carbine', [-10, 0, 26], 1, 'c2.carbine');
    ctx.pickup('ammo', [-12, 0, 26], 2, 'c2.ammo1');
    ctx.area({ id: 'motorpool', min: [-55, -80], max: [55, 34], fastGates: ['c2.fast'], panels: [{ id: 'c2.panelA', at: [-53.5, 0, 0] }, { id: 'c2.panelB', at: [53.5, 0, -60] }],
      reinforcements: [{ id: 'c2-rA', type: 'trooper', at: [-4, 0, -74], area: 'motorpool' }, { id: 'c2-rB', type: 'trooper', at: [4, 0, -74], area: 'motorpool' }, { id: 'c2-rC', type: 'trooper', at: [0, 0, -70], area: 'motorpool' }] });
    ctx.enemy({ id: 'c2-mpA', type: 'trooper', at: [-34, 0, 4], area: 'motorpool', patrol: [{ p: [-34, 0, 4], wait: 3 }, { p: [-34, 0, -30], wait: 3 }, { p: [-10, 0, -40], wait: 2 }] });
    ctx.enemy({ id: 'c2-mpB', type: 'trooper', at: [24, 0, -6], area: 'motorpool', patrol: [{ p: [24, 0, -6], wait: 4, look: Math.PI }, { p: [40, 0, -50], wait: 3 }, { p: [10, 0, -66], wait: 3, look: 0 }] });
    ctx.enemy({ id: 'c2-mpC', type: 'trooper', at: [-6, 0, -70], yaw: Math.PI, area: 'motorpool', post: true });
    ctx.enemy({ id: 'c2-mpD', type: 'trooper', at: [6, 0, 12], yaw: 0.6, area: 'motorpool', patrol: [{ p: [6, 0, 12], wait: 5, look: 1 }, { p: [-8, 0, 0], wait: 4, look: -0.6 }] });
    ctx.enemy({ id: 'c2-drone', type: 'drone', at: [0, 8, -20], area: 'motorpool', loop: [[-40, 8, -10], [0, 8, -60], [40, 8, -10], [0, 8, 20]] });

    // long route: west sheds (always open, slower)
    b.building(-78, -24, 30, 40, 7, { mat: 'sable', doors: [{ side: 'e', at: 4, width: 3, height: 3 }, { side: 'n', at: 0, width: 4, height: 3.5 }], floorMat: 'concrete' });
    crates(ctx, -86, -20, 6, 36); pipes(ctx, -72, -30, 10, true);
    b.at(-78, -66, 30, 1, 5, 0, { mat: 'concrete', kind: 'wall' });
    b.at(-63, -60, 1, 12, 5, 0, { mat: 'concrete', kind: 'wall' });
    ctx.area({ id: 'sheds', min: [-95, -80], max: [-55, 0], fastGates: [], panels: [] });
    ctx.enemy({ id: 'c2-shed', type: 'trooper', at: [-82, 0, -30], area: 'sheds', patrol: [{ p: [-82, 0, -30], wait: 4 }, { p: [-72, 0, -14], wait: 4 }] });

    // ------------------------------------------------ armory (optional, east)
    b.building(80, -40, 28, 34, 7, { mat: 'sable', doors: [{ side: 'w', at: 4, width: 3, height: 3 }], floorMat: 'concrete' });
    crates(ctx, 72, -52, 3, 37); b.at(88, -30, 6, 2, 2, 0, { mat: 'metalDark', kind: 'cover-high' });
    ctx.component('missileRack', [86, 0, -48]);
    ctx.pickup('ammo', [72, 0, -28], 2, 'c2.ammo2'); ctx.pickup('flash', [74, 0, -28], 1, 'c2.flash');
    tower(ctx, 64, -6, 6, 'x+');
    ctx.area({ id: 'armory', min: [55, -80], max: [100, 30], fastGates: [], panels: [{ id: 'c2.panelC', at: [66.5, 0, -40] }] });
    ctx.enemy({ id: 'c2-armA', type: 'trooper', at: [76, 0, -30], area: 'armory', patrol: [{ p: [76, 0, -30], wait: 4 }, { p: [84, 0, -50], wait: 4 }] });
    ctx.enemy({ id: 'c2-armB', type: 'trooper', at: [62, 0, -60], yaw: Math.PI, area: 'armory', post: true });
    ctx.enemy({ id: 'c2-armSpot', type: 'spotter', at: [64, 6, -6.5], yaw: Math.PI * 0.85, area: 'armory', post: true });

    // ------------------------------------------------ cliff road
    wallLine(ctx, -55, -80, -55, -196, 4, [], 'rock', 2);
    wallLine(ctx, 40, -80, 40, -196, 4, [], 'rock', 2);
    for (const z of [-100, -128, -156, -182]) { crates(ctx, -30 + (z % 3) * 6, z, 3, Math.abs(z)); truck(ctx, 20, z - 8, true); }
    ctx.area({ id: 'road', min: [-55, -196], max: [40, -80], fastGates: [], panels: [] });
    ctx.enemy({ id: 'c2-roadA', type: 'trooper', at: [-10, 0, -120], area: 'road', patrol: [{ p: [-10, 0, -120], wait: 4 }, { p: [-30, 0, -150], wait: 3 }] });
    ctx.enemy({ id: 'c2-roadB', type: 'trooper', at: [14, 0, -168], yaw: Math.PI, area: 'road', post: true });
    lamp(ctx, -20, -190, 6); lamp(ctx, 20, -190, 6);

    // ------------------------------------------------ the bridge (The Pad Timed Zone) — over the chasm
    const segs = 12, segLen = 12;
    for (let i = 0; i < segs; i++) {
      const z = -200 - i * segLen - segLen / 2;
      b.at(0, z, 8, segLen - 0.15, 0.6, -0.6, { mat: 'metal', kind: 'floor', surface: 'metal', dynamic: true, tag: `c2.bridge${i}`, solid: { block: false } });
      b.at(-4.3, z, 0.25, segLen - 0.2, 1.1, 0, { mat: 'metalDark', kind: 'cover-low', dynamic: true, tag: `c2.bridge${i}` });
      b.at(4.3, z, 0.25, segLen - 0.2, 1.1, 0, { mat: 'metalDark', kind: 'cover-low', dynamic: true, tag: `c2.bridge${i}` });
    }
    // fallen gantry the player must vault, a car wreck to slide past
    b.at(0, -248, 8, 1, 1.0, 0, { mat: 'hazard', kind: 'cover-low', dynamic: true, tag: 'c2.gantry' });
    b.at(-2, -280, 3, 2, 1.0, 0, { mat: 'metalDark', kind: 'cover-low' });
    // pylons
    for (const z of [-224, -272, -320]) for (const x of [-6, 6]) b.at(x, z, 1.4, 1.4, 22, -20, { mat: 'concrete', kind: 'wall' });
    ctx.collapse([
      { id: 'c2.debris1', kind: 'debris', at: [2, 0, -230], radius: 6 },
      { id: 'c2.debris2', kind: 'debris', at: [-2, 0, -262], radius: 6 },
      { id: 'c2.debris3', kind: 'debris', at: [1, 0, -296], radius: 6 },
      { id: 'c2.gantryFall', kind: 'structure', at: [0, 0, -248], drop: ['c2.gantry'], radius: 3 },
      ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => ({ id: `c2.fall${i}`, kind: 'fissure' as const, at: [-4, 0, -200 - i * segLen] as [number, number, number], to: [4, 0, -200 - i * segLen] as [number, number, number], remove: [`c2.bridge${i}`] })),
    ]);

    // ------------------------------------------------ the pad (cliff)
    b.floor(0, -372, 80, 60, 0, { mat: 'concrete', surface: 'metal' });
    b.at(0, -372, 30, 30, 0.3, 0, { mat: 'halcyon', kind: 'floor', solid: { block: false } });
    for (const [x, z] of [[-15, -357], [15, -357], [-15, -387], [15, -387]] as const) b.at(x, z, 0.6, 0.6, 1.2, 0.3, { mat: 'glowWhite', kind: 'prop' });
    rocks(ctx, -60, -420, 60, -400, 10, 23, 6, 16);
    b.rock(-46, -372, 10, 70, 12); b.rock(46, -372, 10, 70, 12);
    ctx.cache('sc1', [0, 0.3, -380]);
    ctx.light([0, 6, -372], 0xdfe8ff, 10, 30);
    // Wren's ship — already climbing
    const ship = buildWrenShip();
    ship.root.position.set(0, 60, -420); ship.root.visible = false;
    w.scene.add(ship.root);
    w.on('c2.shipLift', () => {
      ship.root.visible = true; let t = 0;
      w.onStep('c2.ship', (dt) => { t += dt; ship.root.position.set(0, 60 + t * t * 6, -420 - t * 18); ship.root.rotation.x = -0.25 - Math.min(0.5, t * 0.05); for (const e of ship.engines) e.scale.setScalar(7 + Math.sin(w.simTime * 30) * 0.6); if (t > 24) { ship.root.visible = false; w.offStep('c2.ship'); } });
    });
    // chasm walls (looks bottomless)
    b.at(0, -272, 120, 140, 2, -90, { mat: 'black', kind: 'floor', decor: true });
  },
  bot: [
    { do: 'goto', to: [0, 0, 36] },
    { do: 'interact', id: 'pickup:c2.carbine' },
    { do: 'goto', to: [-50, 0, 20], crouch: true },
    { do: 'goto', to: [-54, 0, -20], crouch: true },
    { do: 'goto', to: [-62, 0, -20], crouch: true },
    { do: 'goto', to: [-68, 0, -20], crouch: true },
    { do: 'goto', to: [-78, 0, -36], crouch: true },
    { do: 'goto', to: [-78, 0, -46], crouch: true },
    { do: 'goto', to: [-70, 0, -60], crouch: true },
    { do: 'goto', to: [-50, 0, -82] },
    { do: 'goto', to: [-46, 0, -86] },
    { do: 'goto', to: [-20, 0, -110] },
    { do: 'goto', to: [-6, 0, -192] },
    { do: 'waitFlag', flag: 'c2.zoneStarted', timeout: 20 },
    { do: 'goto', to: [0, 0, -240], sprint: true },
    { do: 'goto', to: [0, 0, -246], sprint: true },
    { do: 'goto', to: [0, 0, -252], sprint: true, jump: true },
    { do: 'goto', to: [3, 0, -278], sprint: true },
    { do: 'goto', to: [0, 0, -345], sprint: true },
    { do: 'waitFlag', flag: 'c2.atPad', timeout: 30 },
    { do: 'interact', id: 'cache:sc1' },
    { do: 'waitFlag', flag: 'chapter.done', timeout: 90 },
  ],
};
