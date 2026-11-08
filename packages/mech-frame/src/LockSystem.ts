import * as THREE from 'three';

export interface Lockable { pos: THREE.Vector3; alive: boolean }

/**
 * AlphaMech `frame/Lock.ts`, generic over any lockable. Soft assist by default; hard lock frames
 * both fighters. Lock simplifies orientation, never positioning.
 */
export class LockSystem<T extends Lockable = Lockable> {
  capacity = 1;
  targets: T[] = [];
  hard = false;
  /** Max acquisition range (AlphaMech had none; consumers set it). */
  range = Infinity;

  get primary(): T | null { return this.targets.find((t) => t.alive) ?? null; }
  get all(): T[] { return this.targets.filter((t) => t.alive); }
  prune() { this.targets = this.targets.filter((t) => t.alive); }

  best(hostiles: readonly T[], from: THREE.Vector3, forward: THREE.Vector3, exclude: T[] = []): T | null {
    let best: T | null = null, bestScore = -2;
    for (const h of hostiles) {
      if (!h.alive || exclude.includes(h)) continue;
      const dx = h.pos.x - from.x, dz = h.pos.z - from.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.001 || dist > this.range) continue;
      const s = (dx * forward.x + dz * forward.z) / dist - dist / 2400;
      if (s > bestScore) { bestScore = s; best = h; }
    }
    return best;
  }

  toggleHard(hostiles: readonly T[], from: THREE.Vector3, forward: THREE.Vector3): boolean {
    if (this.hard) { this.hard = false; this.targets = []; return false; }
    this.acquire(hostiles, from, forward);
    this.hard = this.targets.length > 0;
    return this.hard;
  }

  release() { this.hard = false; this.targets = []; }

  acquire(hostiles: readonly T[], from: THREE.Vector3, forward: THREE.Vector3) {
    this.targets = [];
    for (let i = 0; i < this.capacity; i++) {
      const t = this.best(hostiles, from, forward, this.targets);
      if (!t) break;
      this.targets.push(t);
    }
  }

  cycle(hostiles: readonly T[], dir: number) {
    const alive = hostiles.filter((h) => h.alive);
    if (!alive.length) { this.targets = []; return; }
    const cur = this.primary;
    const i = cur ? alive.indexOf(cur) : -1;
    this.targets = [alive[((i < 0 ? 0 : i + dir) + alive.length * 2) % alive.length]!];
    this.hard = true;
  }
}
