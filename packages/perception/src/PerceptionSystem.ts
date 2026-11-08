import { SpatialHash } from './SpatialHash';

export interface Vec3 { x: number; y: number; z: number }
export type Awareness = 'unaware' | 'suspicious' | 'hunted';
export type AwarenessCause = 'sight' | 'noise' | 'loud' | 'visual-stimulus' | 'radio' | 'forced' | 'decay';

export interface SightConfig {
  /** Max sight distance, metres. */
  range: number;
  /** Horizontal field of view, degrees. */
  fovDeg: number;
  /** Vertical half-tolerance for horizontal cones, degrees (ignored when pitchDeg is set). */
  vHalfDeg?: number;
  /** If set, the cone is a true 3D cone tilted down by this many degrees (e.g. a scanning beam). */
  pitchDeg?: number;
  /** Distance at or under which the cone fills at `fillClose` seconds. */
  closeRange: number;
  /** Seconds to fill one stage at close range. */
  fillClose: number;
  /** Seconds to fill one stage at max range. */
  fillFar: number;
  /** Eye height above `pos`. */
  eyeHeight: number;
  /** Highest awareness sight alone can produce (a scanning beam may only raise suspicion). */
  maxAwareness?: Awareness;
}

export interface HearingConfig {
  /** Multiplies every stimulus radius for this listener (hounds hear further). */
  multiplier: number;
  /** Highest awareness quiet noise may produce. Loud stimuli always escalate to hunted. */
  quietMax?: Awareness;
}

export interface PerceiverConfig {
  sight: SightConfig | null;
  hearing: HearingConfig | null;
  /** Seconds a suspicious perceiver investigates before calming down. */
  investigateTime: number;
  /** Seconds a hunted perceiver keeps hunting without contact before dropping to suspicious. */
  huntMemory: number;
  /** Radio broadcast reach when this perceiver goes hunted. 0 disables. */
  radioRange: number;
}

export interface Perceiver {
  readonly id: number;
  /** Radio group (an encounter area). Radio only reaches the same group. */
  group: string;
  pos: Vec3;
  /** Facing, radians. 0 looks down -Z; positive turns toward -X (Three.js convention). */
  yaw: number;
  config: PerceiverConfig;
  awareness: Awareness;
  /** Stage-one meter (unaware → suspicious), 0..1. */
  suspicion: number;
  /** Stage-two meter (suspicious → hunted), 0..1. */
  hunt: number;
  lastKnown: Vec3 | null;
  lastContactAt: number;
  investigateLeft: number;
  /** Perception switched off entirely (dead, stunned, scripted). */
  enabled: boolean;
  /** Sight switched off temporarily (flash, steam). */
  blind: boolean;
  /** Read-only results of the last update. */
  seesTarget: boolean;
  /** Seconds of uninterrupted hunted state. */
  huntedFor: number;
}

export interface PerceptionTarget {
  readonly id: string;
  pos: Vec3;
  /** Eye/chest point offsets used for line of sight, metres above pos. */
  points: number[];
  /** 0..1 visibility multiplier (crouch, darkness, cover). 0 = invisible. */
  visibility: number;
}

export interface Stimulus {
  kind: 'noise' | 'loud';
  pos: Vec3;
  radius: number;
  /** Who made it, if anyone tracked (the target) did. */
  sourceId?: string;
  /** Optional radio group restriction. */
  group?: string;
}

export interface VisualStimulus {
  readonly id: string;
  pos: Vec3;
  /** Awareness a perceiver jumps to on seeing it (a body → hunted). */
  alertTo: Awareness;
  /** Seconds remaining; Infinity for persistent. */
  ttl: number;
  /** Perceiver ids that already reacted. */
  seenBy: Set<number>;
}

export interface WorldQuery {
  /** True if solid geometry blocks the segment. */
  occluded(from: Vec3, to: Vec3): boolean;
  /** True if a vision-only blocker (steam, smoke) blocks the segment. */
  visionBlocked?(from: Vec3, to: Vec3): boolean;
}

export interface PerceptionOptions {
  /** Seconds between a perceiver going hunted and its radio call landing. */
  radioDelay?: number;
  cellSize?: number;
}

export interface AwarenessEvent { id: number; from: Awareness; to: Awareness; cause: AwarenessCause; lastKnown: Vec3 | null }
export interface RadioEvent { fromId: number; group: string; reached: number[] }
type Listener<E> = (e: E) => void;

const RANK: Record<Awareness, number> = { unaware: 0, suspicious: 1, hunted: 2 };
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const copy = (v: Vec3): Vec3 => ({ x: v.x, y: v.y, z: v.z });

let nextId = 1;

export function createPerceiver(group: string, config: PerceiverConfig, pos: Vec3, yaw = 0): Perceiver {
  return {
    id: nextId++, group, pos: copy(pos), yaw, config, awareness: 'unaware', suspicion: 0, hunt: 0,
    lastKnown: null, lastContactAt: -Infinity, investigateLeft: 0, enabled: true, blind: false,
    seesTarget: false, huntedFor: 0,
  };
}

/**
 * One shared perception system: sight cones that fill over time, hearing radii, last-known-position
 * memory and alert propagation by radio. Game-agnostic — it never moves anyone; AI reads the
 * resulting awareness and decides what to do.
 */
export class PerceptionSystem {
  readonly perceivers = new Map<number, Perceiver>();
  readonly targets: PerceptionTarget[] = [];
  readonly visuals = new Map<string, VisualStimulus>();
  /** Radio propagation (an aurora flare cuts it). */
  radioEnabled = true;
  time = 0;
  private hash: SpatialHash<Perceiver>;
  private queue: Stimulus[] = [];
  private pendingRadio: { at: number; from: Perceiver }[] = [];
  private awarenessListeners: Listener<AwarenessEvent>[] = [];
  private radioListeners: Listener<RadioEvent>[] = [];
  private readonly radioDelay: number;
  private scratch: Perceiver[] = [];

  constructor(private readonly world: WorldQuery, options: PerceptionOptions = {}) {
    this.radioDelay = options.radioDelay ?? 0.8;
    this.hash = new SpatialHash<Perceiver>(options.cellSize ?? 10);
  }

  onAwareness(fn: Listener<AwarenessEvent>): () => void { this.awarenessListeners.push(fn); return () => { this.awarenessListeners = this.awarenessListeners.filter((f) => f !== fn); }; }
  onRadio(fn: Listener<RadioEvent>): () => void { this.radioListeners.push(fn); return () => { this.radioListeners = this.radioListeners.filter((f) => f !== fn); }; }

  add(p: Perceiver): Perceiver { this.perceivers.set(p.id, p); this.hash.set(p, p.pos.x, p.pos.z); return p; }
  remove(id: number): void { const p = this.perceivers.get(id); if (p) { this.hash.remove(p); this.perceivers.delete(id); } }
  clear(): void { this.perceivers.clear(); this.hash.clear(); this.queue = []; this.pendingRadio = []; this.visuals.clear(); this.targets.length = 0; }

  setTarget(target: PerceptionTarget): void {
    const i = this.targets.findIndex((t) => t.id === target.id);
    if (i >= 0) this.targets[i] = target; else this.targets.push(target);
  }

  emit(stimulus: Stimulus): void { this.queue.push({ ...stimulus, pos: copy(stimulus.pos) }); }

  addVisual(id: string, pos: Vec3, alertTo: Awareness, ttl = Infinity): void {
    this.visuals.set(id, { id, pos: copy(pos), alertTo, ttl, seenBy: new Set() });
  }
  removeVisual(id: string): void { this.visuals.delete(id); }

  /** Highest stage-fill among perceivers currently filling, 0..2 (for a detection HUD). */
  detectionLevel(group?: string): number {
    let best = 0;
    for (const p of this.perceivers.values()) {
      if (!p.enabled || (group && p.group !== group)) continue;
      const v = RANK[p.awareness] + (p.awareness === 'unaware' ? p.suspicion : p.awareness === 'suspicious' ? p.hunt : 0);
      if (v > best) best = v;
    }
    return Math.min(2, best);
  }

  /** Highest awareness in a group (or overall). */
  highest(group?: string): Awareness {
    let r = 0;
    for (const p of this.perceivers.values()) if (p.enabled && (!group || p.group === group)) r = Math.max(r, RANK[p.awareness]);
    return r === 2 ? 'hunted' : r === 1 ? 'suspicious' : 'unaware';
  }

  setAwareness(p: Perceiver, to: Awareness, cause: AwarenessCause, lastKnown: Vec3 | null = p.lastKnown): void {
    const from = p.awareness;
    if (lastKnown) p.lastKnown = copy(lastKnown);
    if (to === 'suspicious') p.investigateLeft = p.config.investigateTime;
    if (to === 'hunted') { p.lastContactAt = this.time; p.suspicion = 1; p.hunt = 1; }
    if (to === 'unaware') { p.suspicion = 0; p.hunt = 0; p.lastKnown = null; p.huntedFor = 0; }
    if (to === 'suspicious' && from === 'unaware') p.hunt = 0;
    if (to !== 'hunted') p.huntedFor = 0;
    if (from === to) return;
    p.awareness = to;
    for (const fn of this.awarenessListeners) fn({ id: p.id, from, to, cause, lastKnown: p.lastKnown ? copy(p.lastKnown) : null });
    if (to === 'hunted' && cause !== 'radio' && cause !== 'forced') this.pendingRadio.push({ at: this.time + this.radioDelay, from: p });
  }

  /** Raise (never lower) awareness. */
  escalate(p: Perceiver, to: Awareness, cause: AwarenessCause, lastKnown: Vec3 | null): void {
    if (RANK[to] > RANK[p.awareness]) this.setAwareness(p, to, cause, lastKnown);
    else if (lastKnown) {
      p.lastKnown = copy(lastKnown);
      if (p.awareness === 'suspicious') p.investigateLeft = p.config.investigateTime;
      if (p.awareness === 'hunted' && cause !== 'radio') p.lastContactAt = this.time;
    }
  }

  /** Can this perceiver see a world point right now (cone + range + line of sight)? */
  canSeePoint(p: Perceiver, point: Vec3, rangeScale = 1): boolean {
    const s = p.config.sight;
    if (!s || p.blind || !p.enabled) return false;
    const eye = { x: p.pos.x, y: p.pos.y + s.eyeHeight, z: p.pos.z };
    const dx = point.x - eye.x, dy = point.y - eye.y, dz = point.z - eye.z;
    const dist = Math.hypot(dx, dy, dz);
    if (dist > s.range * rangeScale || dist < 1e-4) return dist < 1e-4;
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
    if (s.pitchDeg !== undefined) {
      const pr = (s.pitchDeg * Math.PI) / 180;
      const cx = fx * Math.cos(pr), cy = -Math.sin(pr), cz = fz * Math.cos(pr);
      const cos = (dx * cx + dy * cy + dz * cz) / dist;
      if (cos < Math.cos(((s.fovDeg / 2) * Math.PI) / 180)) return false;
    } else {
      const hd = Math.hypot(dx, dz);
      if (hd > 1e-4) {
        const cos = (dx * fx + dz * fz) / hd;
        if (cos < Math.cos(((s.fovDeg / 2) * Math.PI) / 180)) return false;
      }
      const vHalf = ((s.vHalfDeg ?? 50) * Math.PI) / 180;
      if (Math.abs(Math.atan2(dy, Math.max(hd, 1e-4))) > vHalf) return false;
    }
    if (this.world.occluded(eye, point)) return false;
    if (this.world.visionBlocked?.(eye, point)) return false;
    return true;
  }

  update(dt: number): void {
    this.time += dt;
    for (const p of this.perceivers.values()) this.hash.set(p, p.pos.x, p.pos.z);

    // ---- visual stimuli lifetimes
    for (const v of this.visuals.values()) { v.ttl -= dt; if (v.ttl <= 0) this.visuals.delete(v.id); }

    // ---- sight
    for (const p of this.perceivers.values()) {
      p.seesTarget = false;
      if (!p.enabled) continue;
      const s = p.config.sight;
      if (s && !p.blind) {
        let bestRate = 0; let seenPos: Vec3 | null = null;
        for (const t of this.targets) {
          if (t.visibility <= 0) continue;
          const eyeY = p.pos.y + s.eyeHeight;
          let visible = false;
          for (const h of t.points) {
            const pt = { x: t.pos.x, y: t.pos.y + h, z: t.pos.z };
            if (this.canSeePoint(p, pt)) { visible = true; break; }
          }
          if (!visible) continue;
          const dist = Math.hypot(t.pos.x - p.pos.x, t.pos.y - eyeY, t.pos.z - p.pos.z);
          const k = clamp01((dist - s.closeRange) / Math.max(1e-3, s.range - s.closeRange));
          const fill = s.fillClose + (s.fillFar - s.fillClose) * k;
          const rate = t.visibility / Math.max(0.05, fill);
          if (rate > bestRate) { bestRate = rate; seenPos = t.pos; }
        }
        if (seenPos) {
          p.seesTarget = true;
          const cap = RANK[s.maxAwareness ?? 'hunted'];
          if (p.awareness === 'unaware') {
            p.suspicion = clamp01(p.suspicion + bestRate * dt);
            if (p.suspicion >= 1) this.setAwareness(p, 'suspicious', 'sight', seenPos);
          } else if (p.awareness === 'suspicious') {
            p.lastKnown = copy(seenPos);
            p.investigateLeft = p.config.investigateTime;
            if (cap >= 2) {
              p.hunt = clamp01(p.hunt + bestRate * dt);
              if (p.hunt >= 1) this.setAwareness(p, 'hunted', 'sight', seenPos);
            }
          } else {
            p.lastKnown = copy(seenPos);
            p.lastContactAt = this.time;
          }
        }
      }
      // ---- seen bodies & other visual stimuli
      if (s && !p.blind) {
        for (const v of this.visuals.values()) {
          if (v.seenBy.has(p.id)) continue;
          if (this.canSeePoint(p, { x: v.pos.x, y: v.pos.y + 0.3, z: v.pos.z }, 0.7)) {
            v.seenBy.add(p.id);
            this.escalate(p, v.alertTo, 'visual-stimulus', v.pos);
          }
        }
      }
      // ---- decay
      if (!p.seesTarget) {
        if (p.awareness === 'unaware') p.suspicion = Math.max(0, p.suspicion - dt * 0.35);
        else if (p.awareness === 'suspicious') {
          p.hunt = Math.max(0, p.hunt - dt * 0.4);
          p.investigateLeft -= dt;
          if (p.investigateLeft <= 0) this.setAwareness(p, 'unaware', 'decay', null);
        } else if (this.time - p.lastContactAt > p.config.huntMemory) {
          this.setAwareness(p, 'suspicious', 'decay', p.lastKnown);
        }
      }
      p.huntedFor = p.awareness === 'hunted' ? p.huntedFor + dt : 0;
    }

    // ---- hearing
    const queue = this.queue; this.queue = [];
    for (const st of queue) {
      const maxR = st.radius * 2.5;
      for (const p of this.hash.queryCircle(st.pos.x, st.pos.z, maxR, this.scratch)) {
        if (!p.enabled || !p.config.hearing) continue;
        if (st.group && p.group !== st.group) continue;
        const r = st.radius * p.config.hearing.multiplier;
        const d = Math.hypot(st.pos.x - p.pos.x, st.pos.y - p.pos.y, st.pos.z - p.pos.z);
        if (d > r) continue;
        if (st.kind === 'loud') this.escalate(p, 'hunted', 'loud', st.pos);
        else {
          const cap = p.config.hearing.quietMax ?? 'suspicious';
          this.escalate(p, RANK[cap] >= 1 ? 'suspicious' : 'unaware', 'noise', st.pos);
          if (cap === 'hunted' && p.awareness === 'suspicious' && d < r * 0.35) this.escalate(p, 'hunted', 'noise', st.pos);
        }
      }
    }

    // ---- radio
    if (this.pendingRadio.length) {
      const due = this.pendingRadio.filter((r) => r.at <= this.time);
      this.pendingRadio = this.pendingRadio.filter((r) => r.at > this.time);
      for (const { from } of due) {
        if (!this.radioEnabled || !from.enabled || from.awareness !== 'hunted' || from.config.radioRange <= 0) continue;
        const reached: number[] = [];
        for (const p of this.perceivers.values()) {
          if (p === from || !p.enabled || p.group !== from.group) continue;
          if (Math.hypot(p.pos.x - from.pos.x, p.pos.z - from.pos.z) > from.config.radioRange) continue;
          if (p.awareness !== 'hunted') { this.setAwareness(p, 'hunted', 'radio', from.lastKnown); reached.push(p.id); }
        }
        for (const fn of this.radioListeners) fn({ fromId: from.id, group: from.group, reached });
      }
    }
  }

  /** Debug/overlay snapshot: cones, hearing radii and memory, no references. */
  snapshot() {
    return [...this.perceivers.values()].map((p) => ({
      id: p.id, group: p.group, pos: copy(p.pos), yaw: p.yaw, awareness: p.awareness,
      suspicion: +p.suspicion.toFixed(2), hunt: +p.hunt.toFixed(2), enabled: p.enabled, blind: p.blind,
      sees: p.seesTarget, lastKnown: p.lastKnown ? copy(p.lastKnown) : null,
      range: p.config.sight?.range ?? 0, fovDeg: p.config.sight?.fovDeg ?? 0, hearing: p.config.hearing?.multiplier ?? 0,
    }));
  }
}
