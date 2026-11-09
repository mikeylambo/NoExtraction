import type { LevelDef } from '../Level';
import { wallLine, crates, truck, tank, tower, lamp, rocks, pipes, routeSigns } from './kit';
import { PALETTE } from '../../../data/palette';
import { buildPlayerMech } from '@slu/mech-frame';
import { AEGIS_PALETTE } from '../../mech/Aegis';
import { HUMAN_SIGHT } from '../../../data/alert';

/**
 * Chapter 1 — The Job. Ridge (onboarding) → first patrol → the pair → courtyard (Fast gate vs the
 * service-yard Long Route, visor) → inner yard (Spotter) → AEGIS hangar (sabotage) → exit.
 * North is −Z. All on-foot scale.
 */
export const CH1: LevelDef = {
  id: 'ch1',
  music: 'infiltration',
  spawn: { pos: [0, 6, 208], yaw: 0 },
  checkpoints: {
    start: { pos: [0, 6, 208], yaw: 0 },
    outer: { pos: [0, 0, 146], yaw: 0 },
    courtyard: { pos: [0, 0, 70], yaw: 0 },
    inner: { pos: [0, 0, -24], yaw: 0 },
    service: { pos: [58, 0, -40], yaw: 0 },
    hangar: { pos: [0, 0, -86], yaw: 0 },
    exit: { pos: [0, 0, -156], yaw: 0 },
  },
  build(ctx) {
    const b = ctx.b;
    // ground: the whole valley floor
    b.floor(0, 0, 260, 470, 0, { mat: 'snow', surface: 'snow' });
    // valley sides (impassable rock)
    rocks(ctx, -130, -230, -95, 230, 30, 11, 8, 22);
    rocks(ctx, 95, -230, 130, 230, 30, 12, 8, 22);

    // ---------------------------------------------------------- 1. ridge (onboarding)
    b.floor(0, 190, 12, 50, 6, { mat: 'rock', surface: 'rock' });
    b.rock(-9, 190, 6, 52, 9); b.rock(9, 190, 6, 52, 9);
    b.rock(0, 186, 10, 0.9, 0.9, 6);            // vault (low)
    b.at(0, 172.5, 10, 3, 1.8, 6, { mat: 'rock', kind: 'wall', surface: 'rock' }); // mantle (1.8 m)
    b.floor(0, 170, 12, 2, 7.8, { mat: 'rock', surface: 'rock', kind: 'platform' });
    b.floor(0, 162, 12, 14, 4, { mat: 'rock', surface: 'rock' });
    b.floor(0, 152, 12, 6, 2, { mat: 'rock', surface: 'rock' });
    b.rock(-9, 158, 6, 20, 8); b.rock(9, 158, 6, 20, 8);
    ctx.landmark([0, 0, -1400], 'complex');

    // ---------------------------------------------------------- 2. first patrol
    tank(ctx, -10, 126, 2.4, 5); tank(ctx, 12, 120, 2, 4);
    crates(ctx, -4, 132, 4, 3);
    b.berm(6, 136, 8, 2);
    ctx.area({ id: 'outer', min: [-90, 70], max: [90, 150], fastGates: [], panels: [] });
    ctx.enemy({ id: 'c1-patrol', type: 'trooper', at: [-6, 0, 122], area: 'outer', patrol: [{ p: [-6, 0, 122], wait: 2.5, look: Math.PI / 2 }, { p: [7, 0, 118], wait: 2.5, look: -Math.PI / 2 }] });

    // ---------------------------------------------------------- 3. the pair
    truck(ctx, 0, 84, true);
    crates(ctx, -14, 96, 3, 5); crates(ctx, 12, 100, 3, 6);
    b.berm(-6, 104, 10, 2);
    ctx.enemy({ id: 'c1-pairA', type: 'trooper', at: [-1.6, 0, 89], yaw: 0, area: 'outer', post: true });
    ctx.enemy({ id: 'c1-pairB', type: 'trooper', at: [1.8, 0, 90.5], yaw: 0.25, area: 'outer', post: true });
    lamp(ctx, -18, 78); lamp(ctx, 18, 78);

    // ---------------------------------------------------------- 4. courtyard (fast vs long route)
    // compound south wall with main gateway
    wallLine(ctx, -40, 60, 40, 60, 5, [{ at: 0, width: 6 }]);
    wallLine(ctx, -40, 60, -40, -20, 5);
    wallLine(ctx, 40, 60, 40, -20, 5, [{ at: 34, width: 3 }]); // service door east
    wallLine(ctx, -40, -20, 40, -20, 5, [{ at: 0, width: 4.4 }]); // fast gate gap
    ctx.gate({ id: 'c1.fast', min: [-2.2, 0, -20.4], max: [2.2, 4.2, -19.6], area: 'courtyard', fast: true, console: [5, 0, -17.2] });
    routeSigns(ctx, [0, 4.6, -19.4], 0);
    crates(ctx, -28, 40, 6, 7); crates(ctx, 22, 44, 5, 8); crates(ctx, -18, 6, 4, 9); crates(ctx, 16, 0, 6, 10);
    pipes(ctx, 0, 24, 14, true); pipes(ctx, -24, 18, 10, false); truck(ctx, 26, 20);
    b.coverHigh(-8, 12, 4, 1); b.coverHigh(10, -8, 1, 4);
    lamp(ctx, -36, 56); lamp(ctx, 36, -16); lamp(ctx, -36, -16);
    ctx.area({ id: 'courtyard', min: [-40, -20], max: [40, 60], fastGates: ['c1.fast'], panels: [{ id: 'c1.panelA', at: [-38.5, 0, 22] }],
      reinforcements: [
        { id: 'c1-reinfA', type: 'trooper', at: [-6, 0, -12], area: 'courtyard' },
        { id: 'c1-reinfB', type: 'trooper', at: [6, 0, -12], area: 'courtyard' },
      ] });
    ctx.enemy({ id: 'c1-cyA', type: 'trooper', at: [-20, 0, 30], area: 'courtyard', patrol: [{ p: [-20, 0, 30], wait: 3 }, { p: [-20, 0, 2], wait: 2 }, { p: [-4, 0, -6], wait: 3, look: Math.PI }, { p: [-20, 0, 2], wait: 1 }] });
    ctx.enemy({ id: 'c1-cyB', type: 'trooper', at: [14, 0, 14], area: 'courtyard', patrol: [{ p: [14, 0, 14], wait: 2 }, { p: [30, 0, 34], wait: 3, look: 0 }, { p: [4, 0, 38], wait: 2 }] });
    ctx.enemy({ id: 'c1-drone', type: 'drone', at: [0, 8, 30], area: 'courtyard', loop: [[-26, 8, 46], [26, 8, 46], [26, 8, 0], [-26, 8, 0]] });

    // long route: service yard (east), 2–3× longer, hazards
    wallLine(ctx, 76, 60, 76, -110, 5, [], 'concrete');
    wallLine(ctx, 40, 60, 76, 60, 5);
    b.floor(58, -20, 30, 50, 0.02, { mat: 'ice', surface: 'ice', kind: 'platform' });
    for (const z of [40, 18, -6, -34, -58, -84]) { pipes(ctx, 58, z, 20, true, 0, 1.0); }
    tank(ctx, 50, 8, 2, 5); tank(ctx, 66, -46, 2.2, 6); crates(ctx, 62, 28, 4, 11); crates(ctx, 48, -70, 4, 12);
    wallLine(ctx, 40, -20, 40, -110, 5, [{ at: -104, width: 3 }]); // west wall of service yard, door to hangar side
    routeSigns(ctx, [40.4, 3.4, 34], Math.PI / 2, [41, 2.6, 34], -Math.PI / 2);
    ctx.area({ id: 'service', min: [40, -110], max: [76, 60], fastGates: [], panels: [] });
    ctx.enemy({ id: 'c1-svc', type: 'trooper', at: [58, 0, -10], area: 'service', patrol: [{ p: [58, 0, -10], wait: 4, look: Math.PI }, { p: [58, 0, -60], wait: 4, look: 0 }] });
    ctx.collapse([
      { id: 'c1.steamA', kind: 'steam', at: [52, 0, 30], extent: [4, 3, 3] },
      { id: 'c1.steamB', kind: 'steam', at: [64, 0, -30], extent: [5, 3, 3] },
    ]);

    // ---------------------------------------------------------- 5. inner yard (spotter overwatch)
    wallLine(ctx, -40, -20, -40, -90, 5);
    tower(ctx, 26, -58, 7, 'z+');
    crates(ctx, -10, -34, 4, 13); crates(ctx, 6, -44, 3, 14); crates(ctx, -24, -52, 5, 15); crates(ctx, 10, -66, 4, 16); crates(ctx, -6, -76, 3, 17);
    b.coverHigh(-14, -62, 4, 1); b.coverHigh(16, -80, 4, 1); pipes(ctx, 0, -56, 8, true);
    ctx.area({ id: 'inner', min: [-40, -90], max: [40, -20], fastGates: [], panels: [{ id: 'c1.panelB', at: [-38.5, 0, -48] }] });
    ctx.enemy({ id: 'c1-spotter', type: 'spotter', at: [26, 7, -58.5], yaw: 0.5, area: 'inner', post: true });
    ctx.enemy({ id: 'c1-inner', type: 'trooper', at: [-18, 0, -40], area: 'inner', patrol: [{ p: [-18, 0, -40], wait: 3 }, { p: [-18, 0, -80], wait: 3, look: -Math.PI / 2 }, { p: [4, 0, -84], wait: 2 }] });
    lamp(ctx, 0, -88, 7);

    // ---------------------------------------------------------- 6. hangar (AEGIS-07)
    b.building(0, -120, 64, 60, 18, { mat: 'sable', doors: [{ side: 'n', at: 0, width: 9, height: 9 }, { side: 'e', at: 16, width: 3, height: 3 }, { side: 's', at: 0, width: 9, height: 9 }], floorMat: 'concrete' });
    b.at(-24, -132, 6, 14, 4, 0, { mat: 'metalDark', kind: 'wall' });   // service bay
    b.at(22, -100, 8, 4, 2.6, 0, { mat: 'metal', kind: 'cover-high' });
    crates(ctx, -26, -102, 4, 18); crates(ctx, 20, -140, 3, 19);
    b.at(0, -125, 16, 12, 0.5, 0, { mat: 'hazard', kind: 'floor', solid: { block: false } }); // cradle plate
    for (const x of [-9, 9]) b.at(x, -125, 1, 12, 12, 0, { mat: 'metalDark', kind: 'wall' }); // gantry legs
    b.at(0, -125, 19, 12, 0.6, 12, { mat: 'metalDark', kind: 'wall', solid: { walk: true } });
    ctx.light([0, 14, -120], 0xdfe8ff, 14, 40, 1);
    ctx.light([-24, 5, -140], 0xdfe8ff, 6, 14);
    ctx.area({ id: 'hangar', min: [-32, -150], max: [32, -90], fastGates: [], panels: [{ id: 'c1.panelC', at: [30.5, 0, -132] }] });
    ctx.enemy({ id: 'c1-techA', type: 'trooper', at: [-14, 0, -112], area: 'hangar', patrol: [{ p: [-14, 0, -112], wait: 4, look: -Math.PI / 2 }, { p: [-14, 0, -140], wait: 3 }, { p: [12, 0, -142], wait: 4, look: Math.PI }] });
    ctx.enemy({ id: 'c1-techB', type: 'trooper', at: [14, 0, -108], yaw: Math.PI / 2, area: 'hangar', post: true });
    // the cargo tube
    b.at(-24, -146, 1.6, 1.6, 3, 0, { mat: 'halcyon', kind: 'wall' });
    b.at(-24, -146, 1.8, 1.8, 0.2, 3, { mat: 'glowCyan', decor: true });

    // AEGIS-07, parked in its cradle
    const aegis = buildPlayerMech(AEGIS_PALETTE);
    aegis.root.position.set(0, 0.5, -125); aegis.root.rotation.y = 0;
    aegis.root.traverse((o) => { o.castShadow = true; });
    ctx.w.scene.add(aegis.root);
    const W = ctx.w;
    W.on('c1.sabotage', () => { aegis.mats.glow.emissiveIntensity = 0.05; });
    if (W.state.has('c1.sabotaged')) aegis.mats.glow.emissiveIntensity = 0.05;
    ctx.use('c1.sabotage', [0, 0, -132.5], 'Pull the flight governor', 2.5, () => W.emit('c1.sabotage'), () => !W.state.has('c1.sabotaged'));
    ctx.use('c1.tube', [-24, 0, -144], 'Cargo tube', 1.0, () => W.emit('c1.tube'), () => W.state.has('c1.sabotaged') && !W.state.has('c1.tubed'));

    // perimeter: no walking round the compound
    wallLine(ctx, -95, 60, -40, 60, 5); wallLine(ctx, 76, 60, 95, 60, 5);
    wallLine(ctx, 40, -110, 76, -110, 5);
    wallLine(ctx, -95, -152, 95, -152, 6, [{ at: 0, width: 12 }]);

    // ---------------------------------------------------------- 7. exit tunnel
    b.at(-6, -175, 1, 50, 6, 0, { mat: 'rock', kind: 'wall' }); b.at(6, -175, 1, 50, 6, 0, { mat: 'rock', kind: 'wall' });
    b.at(0, -175, 13, 50, 1, 6, { mat: 'rock', kind: 'wall' });
    ctx.gate({ id: 'c1.rear', min: [-4.5, 0, -150.4], max: [4.5, 9, -149.6], area: 'hangar', fast: false, startClosed: true });
    lamp(ctx, 0, -195, 5, 0xdfe8ff);
    ctx.dark([-6, 0, -200], [6, 6, -152], 0.4);
    void PALETTE; void HUMAN_SIGHT;
  },
  bot: [
    { do: 'goto', to: [0, 6, 192] },
    { do: 'goto', to: [0, 6, 182], jump: true },
    { do: 'goto', to: [0, 7.8, 170], jump: true },
    { do: 'goto', to: [0, 2, 150] },
    { do: 'takedowns', radius: 40 },
    { do: 'goto', to: [-6, 0, 100], crouch: true },
    { do: 'takedowns', radius: 22 },
    { do: 'goto', to: [-2, 0, 64], crouch: true },
    { do: 'goto', to: [0, 0, 55], crouch: true },
    { do: 'goto', to: [-34, 0, 50], crouch: true },
    { do: 'takedowns', radius: 0, area: 'courtyard' },
    { do: 'goto', to: [-30, 0, -10], crouch: true },
    { do: 'goto', to: [0, 0, -14], crouch: true },
    { do: 'passGate', gate: 'c1.fast' },
    { do: 'goto', to: [0, 0, -28], crouch: true },
    { do: 'takedowns', radius: 0, area: 'inner' },
    { do: 'goto', to: [18, 0, -30], crouch: true },
    { do: 'goto', to: [26, 0, -45], crouch: true },
    { do: 'goto', to: [26, 7, -56.4], crouch: true, timeout: 30 },
    { do: 'takedowns', radius: 3 },
    { do: 'goto', to: [26, 0, -45] },
    { do: 'goto', to: [0, 0, -86], crouch: true },
    { do: 'takedowns', radius: 0, area: 'hangar' },
    { do: 'interact', id: 'c1.sabotage' },
    { do: 'waitFlag', flag: 'c1.sabotaged' },
    { do: 'interact', id: 'c1.tube' },
    { do: 'waitFlag', flag: 'c1.window' },
    { do: 'goto', to: [0, 0, -148], timeout: 30 },
    { do: 'goto', to: [0, 0, -198], sprint: true },
    { do: 'waitFlag', flag: 'chapter.done', timeout: 30 },
  ],
};
