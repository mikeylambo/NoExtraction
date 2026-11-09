import * as THREE from 'three';
import { ALERT } from '../../data/alert';
import { PALETTE } from '../../data/palette';
import type { World } from '../game/World';
import type { LevelBuilder } from './Builder';
import { V } from './Builder';
import type { Solid } from './Collision';
import { worldMat } from './Materials';

export interface GateDef { id: string; min: [number, number, number]; max: [number, number, number]; area: string; fast: boolean; console?: [number, number, number]; startClosed?: boolean }
interface GateState { def: GateDef; solid: Solid; door: THREE.Mesh; strips: THREE.Mesh[]; sealed: boolean; open: boolean; hacked: boolean; t: number }

/**
 * Fast-route gates (open while Unseen, sealed on Lockdown, bypassable by a 6 s loud console hack),
 * story doors, and weakened doors that the breacher opens.
 */
export class Gates {
  private gates = new Map<string, GateState>();
  private weak = new Map<number, { solid: Solid; id: string; onBreach?: () => void }>();
  constructor(private readonly w: World) {}

  add(b: LevelBuilder, def: GateDef): void {
    const min = V(...def.min), max = V(...def.max);
    const solid = b.box(min, max, { mat: 'metalDark', kind: 'gate', dynamic: true, tag: def.id })!;
    const door = solid.mesh as THREE.Mesh;
    const size = max.clone().sub(min);
    const along = size.x > size.z;
    const strips: THREE.Mesh[] = [];
    for (const side of [-1, 1]) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(along ? 0.2 : 0.3, size.y + 0.4, along ? 0.3 : 0.2), new THREE.MeshStandardMaterial({ color: 0x050505, emissive: def.fast ? PALETTE.cyan : 0xd0d6dc, emissiveIntensity: 2 }));
      s.position.set(along ? (side < 0 ? min.x - 0.15 : max.x + 0.15) : (min.x + max.x) / 2, (min.y + max.y) / 2, along ? (min.z + max.z) / 2 : side < 0 ? min.z - 0.15 : max.z + 0.15);
      this.w.scene.add(s); strips.push(s);
    }
    const st: GateState = { def, solid, door, strips, sealed: false, open: !def.startClosed, hacked: false, t: def.startClosed ? 0 : 1 };
    solid.active = !st.open;
    this.gates.set(def.id, st);
    if (def.console) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.2, 0.4), worldMat('metal'));
      c.position.set(def.console[0], def.console[1] + 0.6, def.console[2]); this.w.scene.add(c);
      const screen = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.05), new THREE.MeshStandardMaterial({ color: 0x050505, emissive: PALETTE.cyan, emissiveIntensity: 1.6 }));
      screen.position.set(def.console[0], def.console[1] + 1.05, def.console[2] - 0.22); this.w.scene.add(screen);
      let tick = 0;
      this.w.interact.add({
        id: `hack:${def.id}`, pos: V(...def.console), radius: 2, prompt: 'Hack gate', hold: ALERT.gateHack.seconds, interruptible: true,
        enabled: () => st.sealed && !st.hacked,
        onTick: (t) => { if (Math.floor(t / ALERT.gateHack.noiseInterval) !== tick) { tick = Math.floor(t / ALERT.gateHack.noiseInterval); this.w.perception.emit({ kind: 'loud', pos: V(...def.console!), radius: ALERT.gateHack.noiseRadius, group: def.area }); this.w.audio?.sfx('hack.tick', V(...def.console!), 1); } },
        onCancel: () => { tick = 0; },
        onComplete: () => { tick = 0; st.hacked = true; this.open(def.id); this.w.state.set(`gate.${def.id}.hacked`); this.w.hud?.toast('Gate bypassed', 'cyan'); },
      });
    }
  }

  addWeakDoor(b: LevelBuilder, id: string, min: [number, number, number], max: [number, number, number], onBreach?: () => void): void {
    if (this.w.state.applied(`breach.${id}`)) return;
    const s = b.box(V(...min), V(...max), { mat: 'hazard', kind: 'door-weak', dynamic: true, tag: id })!;
    this.weak.set(s.id, { solid: s, id, onBreach });
  }

  breach(s: Solid): void {
    const wd = this.weak.get(s.id); if (!wd || !s.active) return;
    s.active = false;
    if (s.mesh) s.mesh.visible = false;
    const c = s.min.clone().add(s.max).multiplyScalar(0.5);
    this.w.fx.explosion(c, 0.5, 0xd0d6dc);
    this.w.audio?.sfx('structure.groan', c, 0.7);
    this.w.state.apply(`breach.${wd.id}`);
    wd.onBreach?.();
  }

  has(id: string): boolean { return this.gates.has(id); }
  isOpen(id: string): boolean { return !!this.gates.get(id)?.open; }
  isSealed(id: string): boolean { return !!this.gates.get(id)?.sealed; }

  seal(id: string): void {
    const g = this.gates.get(id); if (!g || g.sealed || g.hacked) return;
    g.sealed = true; g.open = false; g.solid.active = true;
    this.w.state.set(`gate.${id}.sealed`);
    this.w.audio?.sfx('gate.slam', g.solid.min.clone().add(g.solid.max).multiplyScalar(0.5), 1);
    for (const s of g.strips) (s.material as THREE.MeshStandardMaterial).emissive.setHex(PALETTE.red);
  }
  open(id: string): void {
    const g = this.gates.get(id); if (!g) return;
    g.open = true; g.solid.active = false;
    if (g.sealed) for (const s of g.strips) (s.material as THREE.MeshStandardMaterial).emissive.setHex(PALETTE.cyan);
    g.sealed = false;
  }
  close(id: string): void { const g = this.gates.get(id); if (!g) return; g.open = false; g.solid.active = true; }

  /** Re-apply persisted gate state after a checkpoint restore. */
  restore(): void {
    for (const g of this.gates.values()) {
      if (this.w.state.has(`gate.${g.def.id}.hacked`)) { g.hacked = true; g.sealed = false; this.open(g.def.id); }
      else if (this.w.state.has(`gate.${g.def.id}.sealed`)) { g.sealed = false; this.seal(g.def.id); }
      else if (this.w.state.has(`gate.${g.def.id}.opened`)) this.open(g.def.id);
    }
  }

  update(dt: number): void {
    for (const g of this.gates.values()) {
      const want = g.open ? 1 : 0;
      g.t += Math.sign(want - g.t) * Math.min(Math.abs(want - g.t), dt * (g.sealed ? 6 : 1.5));
      const h = g.def.max[1] - g.def.min[1];
      g.door.position.y = (g.def.min[1] + g.def.max[1]) / 2 + g.t * (h - 0.15);
    }
  }

  clear(): void { for (const g of this.gates.values()) for (const s of g.strips) this.w.scene.remove(s); this.gates.clear(); this.weak.clear(); }
}
