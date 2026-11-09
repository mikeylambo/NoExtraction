import type { LevelDef } from '../Level';

/** Chapter 6 — Ascent. No ground to speak of: the cradle, then sky, then nothing. */
export const CH6: LevelDef = {
  id: 'ch6',
  music: 'ascent',
  mech: true,
  spawn: { pos: [0, 0, 0], yaw: 0, mech: true },
  checkpoints: { start: { pos: [0, 0, 0], yaw: 0, mech: true } },
  build(ctx) {
    const b = ctx.b;
    b.at(0, 0, 40, 40, 4, -4, { mat: 'hazard', kind: 'floor', surface: 'metal', solid: { block: false } });
    for (const [x, z] of [[-18, -18], [18, -18], [-18, 18], [18, 18]] as const) b.at(x, z, 4, 4, 60, 0, { mat: 'sable', kind: 'wall', decor: true });
  },
  bot: [
    { do: 'waitFlag', flag: 'ascent.started', timeout: 40 },
    { do: 'ascent' },
    { do: 'waitFlag', flag: 'chapter.done', timeout: 90 },
  ],
};
