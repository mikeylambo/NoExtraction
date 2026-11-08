/**
 * Uniform-grid spatial hash on the XZ plane. Items are re-inserted when they move; queries return
 * candidates whose cell overlaps the query circle or box (callers do the exact test).
 */
export interface HashItem {
  readonly id: number | string;
}

export class SpatialHash<T extends HashItem> {
  private cells = new Map<number, Set<T>>();
  private where = new Map<T['id'], { item: T; keys: number[] }>();

  constructor(readonly cellSize = 8) {}

  private key(cx: number, cz: number): number {
    // 2^15 cells per axis is plenty for authored areas; offset keeps the key positive.
    return ((cx + 16384) & 0x7fff) * 32768 + ((cz + 16384) & 0x7fff);
  }

  private keysFor(minX: number, minZ: number, maxX: number, maxZ: number): number[] {
    const s = this.cellSize;
    const x0 = Math.floor(minX / s), x1 = Math.floor(maxX / s);
    const z0 = Math.floor(minZ / s), z1 = Math.floor(maxZ / s);
    const out: number[] = [];
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) out.push(this.key(x, z));
    return out;
  }

  /** Insert or move an item covering the given XZ bounds. */
  set(item: T, minX: number, minZ: number, maxX = minX, maxZ = minZ): void {
    this.remove(item);
    const keys = this.keysFor(minX, minZ, maxX, maxZ);
    for (const k of keys) {
      let cell = this.cells.get(k);
      if (!cell) { cell = new Set(); this.cells.set(k, cell); }
      cell.add(item);
    }
    this.where.set(item.id, { item, keys });
  }

  remove(item: T): void {
    const entry = this.where.get(item.id);
    if (!entry) return;
    for (const k of entry.keys) this.cells.get(k)?.delete(entry.item);
    this.where.delete(item.id);
  }

  clear(): void { this.cells.clear(); this.where.clear(); }

  get size(): number { return this.where.size; }

  /** Candidates overlapping an axis-aligned XZ rectangle (deduplicated). */
  queryRect(minX: number, minZ: number, maxX: number, maxZ: number, out: T[] = []): T[] {
    out.length = 0;
    const seen = new Set<T>();
    for (const k of this.keysFor(minX, minZ, maxX, maxZ)) {
      const cell = this.cells.get(k);
      if (!cell) continue;
      for (const item of cell) if (!seen.has(item)) { seen.add(item); out.push(item); }
    }
    return out;
  }

  queryCircle(x: number, z: number, r: number, out: T[] = []): T[] {
    return this.queryRect(x - r, z - r, x + r, z + r, out);
  }

  /** Candidates along a segment (cells touched by its bounding box; fine for short rays). */
  querySegment(ax: number, az: number, bx: number, bz: number, out: T[] = []): T[] {
    return this.queryRect(Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz), out);
  }
}
