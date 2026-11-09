import type { LevelDef } from '../Level';
import { wallLine, crates, pipes, routeSigns } from './kit';

/**
 * Chapter 4 — Under the Ice (24%). Pitch dark; the visor and the violet core glow through the ice
 * are how you see. Pump hall (Heavy, optional maintenance bay with the Arc Blade) → hound runs (fast
 * gate vs the flooded side channel) → the Conduit Flood (Timed Zone 2:30) → the forward depot.
 */
const CONDUIT_SEGS = 10;
export const CH4: LevelDef = {
  id: 'ch4',
  music: 'infiltration',
  spawn: { pos: [0, 0, 36], yaw: 0 },
  checkpoints: {
    start: { pos: [0, 0, 36], yaw: 0 },
    hall: { pos: [0, 0, 2], yaw: 0 },
    hounds: { pos: [0, 0, -84], yaw: 0 },
    conduit: { pos: [0, 0, -146], yaw: 0 },
  },
  build(ctx) {
    const b = ctx.b, w = ctx.w;
    w.atmo.darkness = 0.82; w.atmo.snowScale = 0;
    const H = 9;
    // one long ice cavern system; ceilings are ice (violet core glow bleeds through)
    b.floor(0, -150, 140, 400, 0, { mat: 'ice', surface: 'ice' });
    b.at(0, -150, 140, 400, 2, H, { mat: 'ice', kind: 'wall', decor: true });
    ctx.dark([-70, -1, -360], [70, H, 50], 0.85);

    // ------------------------------------------------ entrance tunnel + story cache
    wallLine(ctx, -5, 50, -5, 4, H, [], 'ice'); wallLine(ctx, 5, 50, 5, 4, H, [], 'ice');
    wallLine(ctx, -5, 50, 5, 50, H, [], 'ice');
    ctx.cache('sc3', [3, 0, 24]);

    // ------------------------------------------------ pump hall
    wallLine(ctx, -34, 4, -5, 4, H, [], 'ice'); wallLine(ctx, 5, 4, 34, 4, H, [], 'ice');
    wallLine(ctx, -34, 4, -34, -80, H, [{ at: -40, width: 3 }], 'ice');
    wallLine(ctx, 34, 4, 34, -80, H, [{ at: -40, width: 3 }], 'ice');
    wallLine(ctx, -34, -80, 34, -80, H, [{ at: 0, width: 4.4 }], 'ice');
    ctx.gate({ id: 'c4.fast', min: [-2.2, 0, -80.4], max: [2.2, 4.2, -79.6], area: 'hall', fast: true, console: [5, 0, -77] });
    routeSigns(ctx, [0, 4.6, -79.4], 0);
    for (const [x, z] of [[-18, -18], [18, -18], [-18, -54], [18, -54]] as const) { b.at(x, z, 6, 6, 7, 0, { mat: 'metal', kind: 'wall' }); b.at(x, z, 6.4, 6.4, 0.4, 7, { mat: 'glowViolet', decor: true }); }
    pipes(ctx, 0, -30, 20, true, 0, 1.0); pipes(ctx, -8, -66, 12, true, 0, 1.0); crates(ctx, 8, -8, 4, 71); crates(ctx, -26, -30, 5, 72); crates(ctx, 22, -70, 4, 73);
    ctx.water('c4.channel', [-30, -1, -64], [-22, 0.5, -36], 0.45, false);
    ctx.cache('pc3', [-28, 0, -4]);
    ctx.area({ id: 'hall', min: [-34, -80], max: [34, 4], fastGates: ['c4.fast'], panels: [{ id: 'c4.panelA', at: [32.5, 0, -10] }], reinforcements: [{ id: 'c4-rA', type: 'trooper', at: [-4, 0, -74], area: 'hall' }, { id: 'c4-rB', type: 'hound', at: [4, 0, -74], area: 'hall' }] });
    ctx.enemy({ id: 'c4-heavy', type: 'heavy', at: [0, 0, -40], area: 'hall', patrol: [{ p: [0, 0, -40], wait: 4, look: 0 }, { p: [-24, 0, -40], wait: 3 }, { p: [0, 0, -66], wait: 4, look: Math.PI }, { p: [24, 0, -40], wait: 3 }] });
    ctx.enemy({ id: 'c4-hA', type: 'trooper', at: [-12, 0, -10], area: 'hall', patrol: [{ p: [-12, 0, -10], wait: 3 }, { p: [12, 0, -10], wait: 3 }] });
    ctx.enemy({ id: 'c4-hB', type: 'trooper', at: [26, 0, -60], yaw: Math.PI / 2, area: 'hall', post: true });

    // maintenance bay (east, optional): the Arc Blade
    b.at(52, -40, 36, 1, H, 0, { mat: 'ice', kind: 'wall' }); // keeps the bay a cul-de-sac
    wallLine(ctx, 34, -26, 64, -26, H, [], 'ice'); wallLine(ctx, 34, -54, 64, -54, H, [], 'ice'); wallLine(ctx, 64, -26, 64, -54, H, [], 'ice');
    b.at(60, -34, 1, 6, 6, 0, { mat: 'metalDark', kind: 'wall' });
    ctx.component('arcBlade', [56, 0, -46]);
    ctx.light([56, 4, -46], 0xdfe8ff, 6, 10);
    ctx.area({ id: 'maint', min: [34, -54], max: [64, -26], fastGates: [], panels: [] });
    ctx.enemy({ id: 'c4-maint', type: 'heavy', at: [48, 0, -34], yaw: -Math.PI / 2, area: 'maint', patrol: [{ p: [48, 0, -34], wait: 5, look: -Math.PI / 2 }, { p: [48, 0, -48], wait: 5, look: -Math.PI / 2 }] });

    // long route: the flooded side channel (west), slow wading
    wallLine(ctx, -34, -40, -60, -40, H, [], 'ice');
    wallLine(ctx, -60, -40, -60, -150, H, [], 'ice');
    wallLine(ctx, -44, -40, -44, -130, H, [], 'ice');
    ctx.water('c4.side', [-60, -1, -140], [-44, 1.2, -40], 1.0, false);
    for (const z of [-60, -84, -108]) pipes(ctx, -52, z, 14, true, 0, 1.0);

    // ------------------------------------------------ hound runs
    wallLine(ctx, -44, -80, -44, -140, H, [], 'ice'); wallLine(ctx, 34, -80, 34, -140, H, [], 'ice');
    for (const [x0, z0, x1, z1] of [[-30, -96, 10, -96], [-10, -112, 34, -112], [-34, -126, 12, -126]] as const) wallLine(ctx, x0, z0, x1, z1, H, [], 'ice');
    b.iceWall(20, -96, 0.6, 14, H); b.iceWall(-22, -112, 0.6, 14, H);
    wallLine(ctx, -60, -140, 34, -140, H, [{ at: 0, width: 5 }, { at: -52, width: 6 }], 'ice');
    ctx.cache('pc4', [-38, 0, -134]);
    ctx.area({ id: 'runs', min: [-44, -140], max: [34, -80], fastGates: [], panels: [] });
    ctx.enemy({ id: 'c4-houndA', type: 'hound', at: [-10, 0, -104], area: 'runs', patrol: [{ p: [-10, 0, -104], wait: 2 }, { p: [24, 0, -104], wait: 2 }, { p: [24, 0, -120], wait: 2 }] });
    ctx.enemy({ id: 'c4-houndB', type: 'hound', at: [10, 0, -132], area: 'runs', patrol: [{ p: [10, 0, -132], wait: 2 }, { p: [-30, 0, -132], wait: 2 }, { p: [-30, 0, -118], wait: 2 }] });

    // ------------------------------------------------ the conduit (Conduit Flood)
    const segLen = 20;
    wallLine(ctx, -6, -140, -6, -140 - CONDUIT_SEGS * segLen, H, [], 'ice'); wallLine(ctx, 6, -140, 6, -140 - CONDUIT_SEGS * segLen, H, [], 'ice');
    for (let i = 0; i < CONDUIT_SEGS; i++) {
      const z0 = -140 - i * segLen;
      ctx.water(`c4.seg${i}`, [-6, -2, z0 - segLen], [6, 3, z0], -1.5, true);
      // obstacles that need the moveset: vault, mantle step, slide under pipes
      if (i % 3 === 0) b.at(0, z0 - 10, 12, 0.8, 1.0, 0, { mat: 'metal', kind: 'cover-low' });
      if (i % 3 === 1) { b.at(0, z0 - 8, 12, 4, 1.7, 0, { mat: 'metalDark', kind: 'wall' }); b.floor(0, z0 - 13, 12, 6, 1.7, { mat: 'grate', surface: 'metal', kind: 'platform' }); b.stairs(0, z0 - 18.4, 'z+', 12, 4, 0.425, 0.6, 0, 'metalDark'); }
      if (i % 3 === 2) b.at(0, z0 - 10, 12, 1.2, 7.8, 1.2, { mat: 'metal', kind: 'wall' }); // pipe bank: crouch/slide under
    }
    ctx.collapse([
      { id: 'c4.steam1', kind: 'steam', at: [0, 0, -190], extent: [5, 3, 4] },
      { id: 'c4.steam2', kind: 'steam', at: [0, 0, -270], extent: [5, 3, 4] },
    ]);
    ctx.enemy({ id: 'c4-cHeavy', type: 'heavy', at: [0, 0, -232], yaw: 0, area: 'conduit', patrol: [{ p: [0, 0, -232], wait: 6, look: 0 }, { p: [0, 0, -246], wait: 6, look: Math.PI }] });
    ctx.area({ id: 'conduit', min: [-6, -340], max: [6, -140], fastGates: [], panels: [] });
    // the depot shaft
    b.floor(0, -350, 30, 20, 0, { mat: 'concrete', surface: 'metal' });
    wallLine(ctx, -15, -340, -6, -340, H, [], 'ice'); wallLine(ctx, 6, -340, 15, -340, H, [], 'ice');
    wallLine(ctx, -15, -340, -15, -360, H, [], 'ice'); wallLine(ctx, 15, -340, 15, -360, H, [], 'ice'); wallLine(ctx, -15, -360, 15, -360, H, [], 'ice');
    b.stairs(0, -344, 'z-', 6, 10, 0.5, 1.4, 0, 'metalDark');
    ctx.light([0, 6, -352], 0xdfe8ff, 8, 18, 1);
    ctx.light([0, 3, 24], 0xdfe8ff, 3, 10);
  },
  bot: [
    { do: 'goto', to: [0, 0, 26] },
    { do: 'interact', id: 'cache:sc3' },
    { do: 'goto', to: [0, 0, 0] },
    { do: 'takedowns', radius: 0, area: 'hall', ids: ['c4-hA'] },
    { do: 'goto', to: [-10, 0, -28], crouch: true },
    { do: 'takedowns', radius: 0, area: 'hall', ids: ['c4-heavy', 'c4-hB'] },
    { do: 'goto', to: [0, 0, -74], crouch: true },
    { do: 'passGate', gate: 'c4.fast' },
    { do: 'goto', to: [0, 0, -88], crouch: true },
    { do: 'goto', to: [26, 0, -90], crouch: true },
    { do: 'goto', to: [26, 0, -104], crouch: true },
    { do: 'goto', to: [-26, 0, -106], crouch: true },
    { do: 'goto', to: [-30, 0, -118], crouch: true },
    { do: 'goto', to: [22, 0, -119], crouch: true },
    { do: 'goto', to: [22, 0, -133], crouch: true },
    { do: 'goto', to: [0, 0, -134], crouch: true },
    { do: 'goto', to: [0, 0, -146] },
    { do: 'waitFlag', flag: 'c4.flooding', timeout: 20 },
    ...Array.from({ length: CONDUIT_SEGS }, (_, i) => ({ do: 'goto' as const, to: [0, 0, -140 - (i + 1) * 20 + 1] as [number, number, number], sprint: i % 3 !== 2, crouch: i % 3 === 2, jump: i % 3 !== 2, timeout: 40 })),
    { do: 'goto', to: [0, 0, -350] },
    { do: 'waitFlag', flag: 'chapter.done', timeout: 40 },
  ],
};
