import { TIMED_ZONES, TIMED_ZONE_ASSIST, TIMED_ZONE_ACCEL_AT } from '../../data/timedZones';
import type { World } from '../game/World';

export interface ZoneRun { id: string; total: number; left: number; checkpointId: string; onFail?: () => void; onExpire?: () => void }

/** Real-time local clocks. Failing restarts at the zone's checkpoint; assist adds 50%. */
export class TimedZones {
  active: ZoneRun | null = null;
  completed = new Set<string>();
  /** Called by the game when the clock runs out (restores the zone checkpoint). */
  onFail: (run: ZoneRun) => void = () => {};
  private lastMark = Infinity;
  constructor(private readonly w: World) {}

  start(id: string, checkpointId: string, opts: { onExpire?: () => void } = {}): ZoneRun {
    const def = TIMED_ZONES[id]!;
    const total = def.seconds * (this.w.options.timedZoneAssist ? TIMED_ZONE_ASSIST : 1);
    this.active = { id, total, left: total, checkpointId, onExpire: opts.onExpire };
    this.lastMark = total;
    this.w.audio?.music('timedZone');
    this.w.hud?.zoneStart(def.name);
    return this.active;
  }

  complete(id?: string): void {
    const a = this.active; if (!a || (id && a.id !== id)) return;
    this.completed.add(a.id);
    this.active = null;
    this.w.state.set(`zone.${a.id}.done`);
    this.w.audio?.music(null);
  }
  stop(): void { this.active = null; }

  update(dt: number): void {
    const a = this.active; if (!a) return;
    if (!this.w.dev.freezeZones) a.left -= dt;
    for (const m of TIMED_ZONE_ACCEL_AT) if (this.lastMark > m && a.left <= m) this.w.audio?.tempo(m <= 10 ? 1.35 : 1.15);
    this.lastMark = a.left;
    if (a.left <= 0) {
      a.left = 0;
      this.active = null;
      if (a.onExpire) a.onExpire(); else this.onFail(a);
    }
  }
}
