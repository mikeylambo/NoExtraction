/** Minimal typed event emitter (no dependencies, so the package stays portable). */
export class Emitter<E extends Record<string, unknown>> {
  private map = new Map<keyof E, Set<(payload: never) => void>>();
  on<K extends keyof E>(type: K, fn: (payload: E[K]) => void): () => void {
    let set = this.map.get(type);
    if (!set) { set = new Set(); this.map.set(type, set); }
    set.add(fn as (payload: never) => void);
    return () => { set!.delete(fn as (payload: never) => void); };
  }
  emit<K extends keyof E>(type: K, payload: E[K]): void {
    const set = this.map.get(type);
    if (!set) return;
    for (const fn of [...set]) (fn as (p: E[K]) => void)(payload);
  }
  clear(): void { this.map.clear(); }
}

export interface Vec3 { x: number; y: number; z: number }
