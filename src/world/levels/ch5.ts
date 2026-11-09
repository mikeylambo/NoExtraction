import type { LevelDef } from '../Level';
import { wallLine, crates, rocks, prng } from './kit';
import { MARSHAL } from '../../../data/bosses/marshal';

/**
 * Chapter 5 — Aegis (11%). Forward depot (on foot → board) → depot yard (Warden squad) → the shelf
 * (Shelf Run, 1:30) → Sable's outer yard (magnetic storm) → the canyon (Warden ambush: left arm) →
 * the launch platform (The Marshal). Mech scale: AlphaMech movement values, so distances are big.
 */
export const SHELF = { start: -900, segLen: 400, segs: 12, width: 260 };
export const MARSHAL_CENTER: [number, number, number] = [0, 0, -9400];

export const CH5: LevelDef = {
  id: 'ch5',
  music: 'infiltration',
  mech: true,
  spawn: { pos: [0, 0, 26], yaw: 0 },
  checkpoints: {
    start: { pos: [0, 0, 26], yaw: 0 },
    online: { pos: [0, 0, -40], yaw: 0, mech: true },
    shelf: { pos: [0, 0, SHELF.start + 60], yaw: 0, mech: true },
    storm: { pos: [0, 0, -6200], yaw: 0, mech: true },
    canyon: { pos: [0, 0, -7300], yaw: 0, mech: true },
    marshal: { pos: [0, 0, -8900], yaw: 0, mech: true },
  },
  build(ctx) {
    const b = ctx.b, w = ctx.w;
    w.atmo.setShadowSize(220);
    // ------------------------------------------------ forward depot (on foot)
    b.floor(0, -10, 120, 120, 0, { mat: 'concrete', surface: 'metal' });
    b.building(0, -20, 70, 80, 24, { mat: 'sable', doors: [{ side: 'n', at: 0, width: 26, height: 20 }, { side: 's', at: 0, width: 4, height: 3 }], floorMat: 'concrete' });
    crates(ctx, -22, 4, 6, 81); crates(ctx, 18, 8, 5, 82); b.at(-24, -40, 10, 14, 5, 0, { mat: 'metalDark', kind: 'wall' });
    ctx.cache('sc4', [6, 0, -36]);
    ctx.light([0, 18, -20], 0xdfe8ff, 10, 50, 1);
    ctx.use('c5.board', [0, 0, -30], 'Board AEGIS-07', 1.2, () => w.emit('c5.board'), () => !w.state.has('c5.boarded') && w.state.has('c5.canBoard'));

    // ------------------------------------------------ depot yard (Warden squad)
    b.floor(0, -420, 900, 700, 0, { mat: 'snow', surface: 'snow' });
    const r = prng(91);
    for (let i = 0; i < 26; i++) { const x = (r() - 0.5) * 760, z = -140 - r() * 600; if (Math.abs(x) < 55) continue; /* central avenue */ b.at(x, z, 14 + r() * 26, 14 + r() * 26, 10 + r() * 18, 0, { mat: r() < 0.5 ? 'sable' : 'concrete', kind: 'mech' }); }
    for (let i = 0; i < 14; i++) { const cx2 = (r() - 0.5) * 600; if (Math.abs(cx2) < 50) continue; crates(ctx, cx2, -160 - r() * 520, 6, 100 + i); }
    wallLine(ctx, -450, -70, -450, -770, 40, [], 'rock', 30); wallLine(ctx, 450, -70, 450, -770, 40, [], 'rock', 30);
    wallLine(ctx, -450, -70, -40, -70, 30, [], 'rock', 20); wallLine(ctx, 40, -70, 450, -70, 30, [], 'rock', 20);
    b.at(0, -720, 30, 30, 2, 0, { mat: 'halcyon', kind: 'mech' }); // repair station pad
    b.at(0, -720, 8, 8, 18, 2, { mat: 'glowWhite', kind: 'mech' });

    // ------------------------------------------------ the shelf (Shelf Run)
    for (let i = 0; i < SHELF.segs; i++) {
      const z0 = SHELF.start - i * SHELF.segLen;
      const gap = i > 0 && i % 3 === 0 ? 30 : 0; // crevasses: a jump-jet hop clears them; flight clears them easily
      const len = SHELF.segLen - gap;
      b.at(0, z0 - gap - len / 2, SHELF.width, len, 6, -6, { mat: 'ice', kind: 'floor', surface: 'ice', dynamic: true, tag: `c5.shelf${i}`, solid: { block: false } });
      const rr = prng(200 + i);
      for (let k = 0; k < 3; k++) b.at((rr() - 0.5) * (SHELF.width - 60), z0 - gap - rr() * len, 30 + rr() * 30, 12, 16 + rr() * 12, 0, { mat: 'ice', kind: 'mech', dynamic: true, tag: `c5.shelf${i}` });
    }
    b.floor(0, -830, 260, 140, 0, { mat: 'snow' }); // yard → shelf apron
    const shelfEnd = SHELF.start - SHELF.segs * SHELF.segLen;
    rocks(ctx, -420, shelfEnd, -200, -760, 30, 301, 30, 80);
    rocks(ctx, 200, shelfEnd, 420, -760, 30, 302, 30, 80);
    b.at(0, -3400, 2000, 6000, 2, -260, { mat: 'black', kind: 'floor', decor: true }); // the dark sea below

    // ------------------------------------------------ Sable outer yard (storm) + canyon (ambush)
    b.floor(0, -6400, 900, 1400, 0, { mat: 'snow' }); // z -5700 .. -7100 (shelf lands here)
    for (let i = 0; i < 20; i++) { const x = (r() - 0.5) * 760, z = -6150 - r() * 900; if (Math.abs(x) < 55) continue; b.at(x, z, 20 + r() * 30, 20 + r() * 30, 14 + r() * 26, 0, { mat: 'sable', kind: 'mech' }); }
    wallLine(ctx, -450, -5750, -450, -7100, 60, [], 'rock', 30); wallLine(ctx, 450, -5750, 450, -7100, 60, [], 'rock', 30);
    b.floor(0, -7600, 240, 1000, 0, { mat: 'snow' }); // canyon z -7100 .. -8100
    wallLine(ctx, -120, -7100, -120, -8100, 90, [], 'rock', 40); wallLine(ctx, 120, -7100, 120, -8100, 90, [], 'rock', 40);
    wallLine(ctx, -450, -7100, -120, -7100, 60, [], 'rock', 30); wallLine(ctx, 120, -7100, 450, -7100, 60, [], 'rock', 30);
    b.at(0, -8050, 30, 30, 2, 0, { mat: 'halcyon', kind: 'mech' }); b.at(0, -8050, 8, 8, 18, 2, { mat: 'glowWhite', kind: 'mech' });

    // ------------------------------------------------ launch platform (The Marshal)
    const [cx, , cz] = MARSHAL_CENTER, R = MARSHAL.arenaRadius, inner = R * (1 - MARSHAL.phase2.arenaShrink);
    b.floor(0, -8500, 240, 800, 0, { mat: 'snow' }); // canyon mouth → platform
    b.at(cx, cz, inner * 2, inner * 2, 4, -4, { mat: 'concrete', kind: 'floor', surface: 'metal', solid: { block: false } });
    for (const [x, z, sw, sd] of [[cx, cz - (inner + R) / 2, R * 2, R - inner], [cx, cz + (inner + R) / 2, R * 2, R - inner], [cx - (inner + R) / 2, cz, R - inner, inner * 2], [cx + (inner + R) / 2, cz, R - inner, inner * 2]] as const) b.at(x, z, sw, sd, 4, -4, { mat: 'concrete', kind: 'floor', surface: 'metal', dynamic: true, tag: 'c5.ring', solid: { block: false } });
    // gantries ring the platform
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; b.at(cx + Math.cos(a) * (R - 30), cz + Math.sin(a) * (R - 30), 14, 14, 70, 0, { mat: 'metalDark', kind: 'mech', dynamic: true, tag: 'c5.ring' }); }
    // the last launch cradle (north edge)
    b.at(cx, cz - R - 60, 60, 60, 140, -4, { mat: 'sable', kind: 'mech' });
    b.at(cx, cz - R - 60, 26, 26, 30, 136, { mat: 'glowWhite', kind: 'mech' });
    b.at(cx, cz - R - 20, 40, 40, 4, -4, { mat: 'hazard', kind: 'floor', surface: 'metal', solid: { block: false } });
    ctx.landmark([cx, 0, cz - R - 300], 'yard');
  },
  bot: [
    { do: 'interact', id: 'cache:sc4' },
    { do: 'waitFlag', flag: 'c5.canBoard', timeout: 60 },
    { do: 'interact', id: 'c5.board' },
    { do: 'waitFlag', flag: 'c5.online', timeout: 60 },
    { do: 'mechFight', until: 'c5.firstKill', timeout: 30 },
    { do: 'mechFight', until: 'c5.wardensDone', timeout: 300 },
    { do: 'mechGoto', to: [0, 0, -720], tol: 25 },
    { do: 'mechGoto', to: [0, 0, SHELF.start + 40], tol: 30 },
    ...Array.from({ length: SHELF.segs }, (_, i) => ({ do: 'mechGoto' as const, to: [0, 0, SHELF.start - (i + 1) * SHELF.segLen + 60] as [number, number, number], assault: true, tol: 60, timeout: 60 })),
    { do: 'mechGoto', to: [0, 0, -6300], assault: true, tol: 60 },
    { do: 'mechFight', until: 'c5.stormDone', timeout: 300 },
    { do: 'mechGoto', to: [0, 0, -7470], assault: true, tol: 20 },
    { do: 'mechFight', until: 'c5.ambushDone', timeout: 300 },
    { do: 'mechGoto', to: [0, 0, -8050], tol: 25 },
    { do: 'mechGoto', to: [0, 0, -8950], assault: true, tol: 60 },
    { do: 'mechFight', until: 'c5.marshalDown', timeout: 900 },
    { do: 'waitFlag', flag: 'chapter.done', timeout: 90 },
  ],
};
