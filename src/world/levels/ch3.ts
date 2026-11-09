import type { LevelDef } from '../Level';
import { wallLine, crates, truck, tank, lamp, rocks, pipes, routeSigns } from './kit';
import { V } from '../Builder';

/**
 * Chapter 3 — Dead Colony (41%, snowstorm). Colony street (shotgun, weakened-door alternate route,
 * the water tower as a tool) → mast plaza (story cache, debris field, fast gate vs depot) → freight
 * building → the flooding cargo bay (Freight Lift Timed Zone, optional governor).
 */
export const CH3: LevelDef = {
  id: 'ch3',
  music: 'infiltration',
  spawn: { pos: [0, 0, 56], yaw: 0 },
  checkpoints: {
    start: { pos: [0, 0, 56], yaw: 0 },
    plaza: { pos: [0, 0, -62], yaw: 0 },
    freight: { pos: [0, 0, -156], yaw: 0 },
    bay: { pos: [0, -16, -170], yaw: 0 },
  },
  build(ctx) {
    const b = ctx.b, w = ctx.w;
    // surface, with the lift shaft hole (x -5..5, z -170..-180)
    b.floor(0, -55, 220, 230, 0);                 // z 60 .. -170
    b.floor(-57.5, -175, 105, 10, 0); b.floor(57.5, -175, 105, 10, 0); // around the shaft (x -5..5 open)
    b.floor(0, -190, 220, 20, 0);                 // z -180 .. -200
    rocks(ctx, -130, -200, -48, 70, 22, 31, 6, 18);
    rocks(ctx, 48, -200, 130, 70, 22, 32, 6, 18);
    ctx.landmark([0, 0, -100], 'mast');
    ctx.landmark([500, 0, -2400], 'yard');

    // ------------------------------------------------ colony street
    wallLine(ctx, -48, 50, -30, 50, 5, [], 'rock'); wallLine(ctx, 30, 50, 48, 50, 5, [], 'rock');
    for (const [x, z] of [[-20, 32], [-20, 6], [-20, -22]] as const) b.building(x, z, 12, 18, 5.5, { mat: 'halcyon', doors: [{ side: 'e', at: 0, width: 2.2 }], floorMat: 'concrete' });
    b.at(-20, -26, 11, 0.3, 3, 0, { mat: 'halcyon', kind: 'wall' }); // back room of the last house
    b.building(20, 32, 12, 18, 5.5, { mat: 'halcyon', doors: [{ side: 'w', at: 0, width: 2.2 }], floorMat: 'concrete' });
    b.building(20, 4, 12, 16, 5.5, { mat: 'halcyon', doors: [{ side: 'w', at: -3, width: 2.2 }], floorMat: 'concrete' });
    ctx.pickup('shotgun', [-22, 0, 34], 1, 'c3.shotgun');
    ctx.pickup('ammo', [-18, 0, 30], 2, 'c3.ammo1');
    ctx.cache('pc2', [-22, 0, -28]);
    truck(ctx, -4, 20); truck(ctx, 6, -8, true); crates(ctx, 4, 40, 4, 41); crates(ctx, -8, -2, 3, 42); pipes(ctx, 0, 10, 8, true);
    // the water tower: shoot (breach) its support and it comes down on whoever is underneath
    for (const [dx, dz] of [[-2, -2], [2, -2], [-2, 2]] as const) b.at(18 + dx, -26 + dz, 0.5, 0.5, 9, 0, { mat: 'metalDark', kind: 'wall' });
    ctx.weakDoor('c3.towerLeg', [19.6, 0, -24.4], [20.4, 9, -23.6], () => w.collapse.trigger('c3.tower'));
    b.at(18, -26, 7, 7, 5, 9, { mat: 'metal', kind: 'wall', dynamic: true, tag: 'c3.tank' });
    b.at(14, -30, 8, 8, 3, 0, { mat: 'metal', kind: 'wall', dynamic: true, tag: 'c3.tankDown' });
    // the collapsed row across the street; the middle building is breachable (alternate route)
    wallLine(ctx, -48, -46, -6, -46, 6, [], 'concrete', 1.2);
    wallLine(ctx, 6, -46, 30, -46, 6, [], 'concrete', 1.2);
    b.building(0, -46, 12, 8, 6, { mat: 'halcyon', doors: [{ side: 's', at: 0, width: 2.4, height: 3 }, { side: 'n', at: 0, width: 2.4, height: 3 }], floorMat: 'concrete' });
    ctx.weakDoor('c3.breachS', [-1.2, 0, -42.3], [1.2, 3, -41.7]);
    ctx.weakDoor('c3.breachN', [-1.2, 0, -50.3], [1.2, 3, -49.7]);
    // long route: the east alley
    wallLine(ctx, 30, 50, 30, -46, 4, [{ at: 18, width: 3 }], 'halcyon');
    for (const z of [30, 0, -30]) crates(ctx, 38, z, 3, 43 + z);
    ctx.area({ id: 'street', min: [-48, -46], max: [48, 50], fastGates: [], panels: [{ id: 'c3.panelA', at: [-13.5, 0, -40] }], reinforcements: [{ id: 'c3-rA', type: 'trooper', at: [0, 0, -40], area: 'street' }, { id: 'c3-rB', type: 'trooper', at: [36, 0, -40], area: 'street' }] });
    ctx.enemy({ id: 'c3-stA', type: 'trooper', at: [0, 0, 26], area: 'street', patrol: [{ p: [0, 0, 26], wait: 3 }, { p: [0, 0, -30], wait: 4, look: Math.PI }] });
    ctx.enemy({ id: 'c3-tw1', type: 'trooper', at: [16, 0, -28], yaw: Math.PI, area: 'street', post: true });
    ctx.enemy({ id: 'c3-tw2', type: 'trooper', at: [13, 0, -31], yaw: Math.PI * 0.8, area: 'street', post: true });
    ctx.enemy({ id: 'c3-alley', type: 'trooper', at: [38, 0, 6], area: 'street', patrol: [{ p: [38, 0, 6], wait: 3 }, { p: [38, 0, -40], wait: 3 }] });
    ctx.enemy({ id: 'c3-roof', type: 'spotter', at: [20, 5.9, 4], yaw: Math.PI * 0.95, area: 'street', post: true });
    lamp(ctx, -8, 46); lamp(ctx, 8, -40);
    ctx.collapse([{ id: 'c3.tower', kind: 'structure', at: [15, 0, -29], remove: ['c3.tank'], drop: ['c3.tankDown'], radius: 7 }]);

    // ------------------------------------------------ mast plaza (story cache, debris field)
    wallLine(ctx, -48, -140, 48, -140, 5, [{ at: 0, width: 4.4 }, { at: -36, width: 3 }]);
    ctx.gate({ id: 'c3.fast', min: [-2.2, 0, -140.4], max: [2.2, 4.2, -139.6], area: 'plaza', fast: true, console: [5, 0, -137] });
    routeSigns(ctx, [0, 4.6, -139.4], 0);
    b.at(0, -100, 6, 6, 1.2, 0, { mat: 'concrete', kind: 'cover-low' });
    ctx.cache('sc2', [4, 1.2, -100]);
    b.at(-10, -88, 1, 1, 1, 0, { mat: 'metalDark', kind: 'prop' });
    ctx.light([-10, 1.6, -88], 0xffc890, 6, 10); // straggler fire barrel (warm, not amber UI)
    crates(ctx, -22, -76, 5, 51); crates(ctx, 18, -82, 4, 52); crates(ctx, -14, -118, 4, 53); crates(ctx, 22, -124, 3, 54); truck(ctx, 12, -106, true); pipes(ctx, -30, -100, 12, false);
    // depot (long route, west) — through the building and out its side
    b.building(-34, -108, 20, 40, 6, { mat: 'sable', doors: [{ side: 'e', at: 12, width: 2.4 }, { side: 'n', at: -2, width: 2.6 }], floorMat: 'concrete' });
    crates(ctx, -38, -100, 6, 55);
    // pc1: maintenance hut, east
    b.building(34, -118, 10, 10, 4, { mat: 'concrete', doors: [{ side: 'w', at: 0, width: 2 }] });
    ctx.cache('pc1', [36, 0, -120]);
    ctx.area({ id: 'plaza', min: [-48, -140], max: [48, -46], fastGates: ['c3.fast'], panels: [{ id: 'c3.panelB', at: [46.5, 0, -96] }], reinforcements: [{ id: 'c3-rC', type: 'trooper', at: [-4, 0, -134], area: 'plaza' }, { id: 'c3-rD', type: 'heavy', at: [4, 0, -134], area: 'plaza' }] });
    ctx.enemy({ id: 'c3-strA', type: 'trooper', at: [-12, 0, -86], yaw: -2.2, area: 'plaza', post: true });
    ctx.enemy({ id: 'c3-strB', type: 'trooper', at: [-8, 0, -90], yaw: 0.9, area: 'plaza', post: true });
    ctx.enemy({ id: 'c3-plA', type: 'trooper', at: [20, 0, -70], area: 'plaza', patrol: [{ p: [20, 0, -70], wait: 3 }, { p: [24, 0, -132], wait: 4, look: Math.PI }, { p: [8, 0, -132], wait: 2 }] });
    ctx.enemy({ id: 'c3-drone', type: 'drone', at: [0, 9, -110], area: 'plaza', loop: [[-30, 9, -70], [30, 9, -70], [30, 9, -130], [-30, 9, -130]] });

    // ------------------------------------------------ freight building + lift
    wallLine(ctx, -48, -200, 48, -200, 8, [], 'rock');
    b.building(0, -172, 36, 40, 14, { mat: 'sable', doors: [{ side: 's', at: 0, width: 8, height: 7 }], roof: true, floor: false });
    // the lift car (moves down the shaft), shaft walls below
    const car = b.at(0, -175, 10, 10, 0.4, -0.4, { mat: 'grate', kind: 'floor', surface: 'metal', dynamic: true, tag: 'c3.car', solid: { block: false } })!;
    for (const [x, z, sw, sd] of [[-5.3, -175, 0.6, 11], [5.3, -175, 0.6, 11], [0, -169.7, 11, 0.6]] as const) b.at(x, z, sw, sd, 16, -16, { mat: 'concrete', kind: 'wall' });
    b.at(0, -180.3, 11, 0.6, 3, -3, { mat: 'concrete', kind: 'wall' });
    // the shaft opening: the surface slab is pierced (inactive floor over the shaft is the car itself)
    ctx.area({ id: 'freight', min: [-18, -192], max: [18, -152], fastGates: [], panels: [] });
    ctx.enemy({ id: 'c3-frA', type: 'trooper', at: [-10, 0, -164], area: 'freight', patrol: [{ p: [-10, 0, -164], wait: 3 }, { p: [10, 0, -186], wait: 3 }] });

    // ------------------------------------------------ cargo bay (underground, y = -16)
    const Y = -16;
    b.at(0, -220, 84, 120, 2, Y - 2, { mat: 'concrete', kind: 'floor', surface: 'metal', solid: { block: false } });
    wallLine(ctx, -42, -160, 42, -160, 13, [], 'concrete', 1, Y);
    wallLine(ctx, -42, -160, -42, -280, 13, [], 'concrete', 1, Y);
    wallLine(ctx, 42, -160, 42, -280, 13, [], 'concrete', 1, Y);
    wallLine(ctx, -42, -280, 42, -280, 13, [{ at: 0, width: 4 }], 'concrete', 1, Y);
    b.at(0, -220, 84, 120, 1, -3, { mat: 'concrete', kind: 'wall', decor: true }); // ceiling (visual)
    // crate maze + walkway
    for (const [x, z, n, s] of [[-24, -190, 6, 61], [16, -196, 5, 62], [-12, -214, 6, 63], [22, -226, 6, 64], [-26, -236, 5, 65], [8, -248, 4, 66], [-6, -262, 3, 67]] as const) for (let i = 0; i < n; i++) b.crate(x + (i % 3) * 1.4, z + Math.floor(i / 3) * 1.4, 1.3, i % 2 ? 2.4 : 1.3, Y);
    pipes(ctx, 0, -206, 30, true, Y, 1.0); pipes(ctx, -30, -250, 20, false, Y, 1.0);
    // the governor's cargo pod: behind a weakened door (breacher) or the crawl round the back
    b.at(-34, -252, 12, 0.5, 4, Y, { mat: 'halcyon', kind: 'wall' });
    b.at(-28.25, -258, 0.5, 12, 4, Y, { mat: 'halcyon', kind: 'wall' });
    b.at(-34, -264, 12, 0.5, 1.2, Y, { mat: 'halcyon', kind: 'cover-low' }); // crawl gap over the back
    ctx.weakDoor('c3.podDoor', [-29, Y, -255], [-28, Y + 3, -253]);
    ctx.component('flightGovernor', [-35, Y, -258]);
    // levers that open the conduit hatch
    ctx.use('c3.leverA', [-38, Y, -180], 'Release hatch lock', 1.5, () => w.emit('c3.lever'));
    ctx.use('c3.leverB', [38, Y, -240], 'Release hatch lock', 1.5, () => w.emit('c3.lever'));
    ctx.gate({ id: 'c3.hatch', min: [-2, Y, -280.5], max: [2, Y + 3.5, -279.5], area: 'bay', fast: false, startClosed: true });
    b.at(0, -300, 4, 40, 3.5, Y, { mat: 'black', kind: 'floor', decor: true });
    b.floor(0, -300, 6, 40, Y, { mat: 'concrete', surface: 'metal' });
    b.at(-2.5, -300, 1, 40, 4, Y, { mat: 'concrete', kind: 'wall' }); b.at(2.5, -300, 1, 40, 4, Y, { mat: 'concrete', kind: 'wall' });
    ctx.water('c3.flood', [-42, Y - 6, -280], [42, Y + 8, -160], Y - 3);
    ctx.light([0, Y + 10, -200], 0xdfe8ff, 10, 40, 1); ctx.light([0, Y + 10, -250], 0xdfe8ff, 10, 40, 1);
    ctx.light([-34, Y + 3, -258], 0xdfe8ff, 6, 12);
    ctx.area({ id: 'bay', min: [-42, -280], max: [42, -160], fastGates: [], panels: [] });
    ctx.enemy({ id: 'c3-bayA', type: 'trooper', at: [10, Y, -214], area: 'bay', patrol: [{ p: [10, Y, -214], wait: 3 }, { p: [30, Y, -244], wait: 3 }, { p: [0, Y, -256], wait: 3 }] });
    ctx.enemy({ id: 'c3-bayB', type: 'trooper', at: [-20, Y, -222], yaw: Math.PI / 2, area: 'bay', post: true });
    ctx.dark([-42, Y - 2, -280], [42, Y + 12, -160], 0.35);
    void car; void tank; void V;
  },
  bot: [
    { do: 'goto', to: [0, 0, 44] },
    { do: 'goto', to: [-12, 0, 32] },
    { do: 'goto', to: [-14, 0, 32] },
    { do: 'interact', id: 'pickup:c3.shotgun' },
    { do: 'goto', to: [-12, 0, 32] },
    { do: 'takedowns', radius: 0, area: 'street', ids: ['c3-stA', 'c3-tw1', 'c3-tw2'] },
    { do: 'goto', to: [0, 0, -38] },
    { do: 'breach', door: 'c3.breachS', at: [0, 1.4, -42] },
    { do: 'goto', to: [0, 0, -45] },
    { do: 'breach', door: 'c3.breachN', at: [0, 1.4, -50] },
    { do: 'goto', to: [0, 0, -56] },
    { do: 'goto', to: [4, 1.2, -96], crouch: true },
    { do: 'interact', id: 'cache:sc2' },
    { do: 'takedowns', radius: 0, area: 'plaza' },
    { do: 'goto', to: [0, 0, -134] },
    { do: 'passGate', gate: 'c3.fast' },
    { do: 'goto', to: [0, 0, -146] },
    { do: 'goto', to: [0, 0, -174] },
    { do: 'waitFlag', flag: 'c3.inBay', timeout: 60 },
    { do: 'goto', to: [0, -16, -183] },
    { do: 'goto', to: [-34, -16, -181] },
    { do: 'interact', id: 'c3.leverA' },
    { do: 'goto', to: [-8, -16, -184] },
    { do: 'goto', to: [2, -16, -230] },
    { do: 'goto', to: [34, -16, -238] },
    { do: 'interact', id: 'c3.leverB' },
    { do: 'goto', to: [0, -16, -272] },
    { do: 'goto', to: [0, -16, -296] },
    { do: 'waitFlag', flag: 'chapter.done', timeout: 30 },
  ],
};
