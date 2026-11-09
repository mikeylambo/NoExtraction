import * as THREE from 'three';

export interface LightEmitter { pos: THREE.Vector3; color: number; intensity: number; distance: number; priority?: number; enabled?: () => boolean }

/** A fixed number of real point lights assigned each frame to the nearest/most important emitters. */
export class LightPool {
  private lights: THREE.PointLight[] = [];
  private emitters: LightEmitter[] = [];
  constructor(scene: THREE.Scene, count = 6) {
    for (let i = 0; i < count; i++) { const l = new THREE.PointLight(0xffffff, 0, 10, 2); scene.add(l); this.lights.push(l); }
  }
  add(e: LightEmitter): LightEmitter { this.emitters.push(e); return e; }
  remove(e: LightEmitter): void { this.emitters = this.emitters.filter((x) => x !== e); }
  clear(): void { this.emitters = []; for (const l of this.lights) l.intensity = 0; }
  update(cam: THREE.Vector3): void {
    const live = this.emitters.filter((e) => e.enabled?.() ?? true)
      .map((e) => ({ e, s: e.pos.distanceToSquared(cam) / Math.pow(e.distance, 2) - (e.priority ?? 0) }))
      .sort((a, b) => a.s - b.s);
    this.lights.forEach((l, i) => {
      const it = live[i];
      if (!it || it.s > 9) { l.intensity = 0; return; }
      l.position.copy(it.e.pos); l.color.setHex(it.e.color); l.distance = it.e.distance; l.intensity = it.e.intensity;
    });
  }
}
