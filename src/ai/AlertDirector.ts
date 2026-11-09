import * as THREE from 'three';
import { ALERT } from '../../data/alert';
import { PALETTE } from '../../data/palette';
import { Enemy, type EnemySpawn } from './Enemy';
import type { World } from '../game/World';

export interface AreaDef {
  id: string;
  name?: string;
  min: [number, number];
  max: [number, number];
  /** Gate ids that seal on lockdown. */
  fastGates: string[];
  panels: { id: string; at: [number, number, number] }[];
  reinforcements?: EnemySpawn[];
}

interface AreaState { def: AreaDef; huntedT: number; lockdown: boolean; noSightT: number; reinforced: boolean; everLocked: boolean; panelMeshes: Map<string, THREE.Mesh> }

export type AlertLevel = 0 | 1 | 2 | 3;

/**
 * The alert ladder above perception: area-wide Hunted, alarm panels (3 s, telegraphed by a red
 * pulse), Lockdown (Hunted 8 s continuous or a panel reached) which seals fast gates, spawns one
 * reinforcement squad, and decays after 45 s without a sightline. Sealed gates stay sealed.
 */
export class AlertDirector {
  private areas = new Map<string, AreaState>();
  /** Aurora flare: alarms (and radios) offline. */
  alarmsOfflineT = 0;
  lockdownsThisChapter = 0;
  listeners: ((e: { type: 'lockdown' | 'lockdown-end' | 'alarm-start' | 'hunted'; area: string }) => void)[] = [];

  constructor(private readonly w: World) {}

  addArea(def: AreaDef): void {
    const st: AreaState = { def, huntedT: 0, lockdown: false, noSightT: 0, reinforced: false, everLocked: false, panelMeshes: new Map() };
    for (const p of def.panels) {
      const g = new THREE.Group();
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.0, 0.25), new THREE.MeshStandardMaterial({ color: 0x2a2f35, roughness: 0.6, metalness: 0.5 }));
      box.position.y = 1.3; g.add(box);
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.05), new THREE.MeshStandardMaterial({ color: 0x100000, emissive: PALETTE.red, emissiveIntensity: 0.4 }));
      lamp.position.set(0, 1.62, -0.14); g.add(lamp);
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.8, 0.12), new THREE.MeshStandardMaterial({ color: 0x1a1d21 }));
      post.position.y = 0.4; g.add(post);
      g.position.set(...p.at);
      this.w.scene.add(g);
      st.panelMeshes.set(p.id, lamp);
    }
    this.areas.set(def.id, st);
  }

  clear(): void { for (const a of this.areas.values()) for (const m of a.panelMeshes.values()) this.w.scene.remove(m.parent!); this.areas.clear(); this.lockdownsThisChapter = 0; }

  areaAt(p: THREE.Vector3): AreaState | null {
    for (const a of this.areas.values()) if (p.x >= a.def.min[0] && p.x <= a.def.max[0] && p.z >= a.def.min[1] && p.z <= a.def.max[1]) return a;
    return null;
  }
  areaState(id: string): AreaState | undefined { return this.areas.get(id); }
  isLocked(id: string): boolean { return !!this.areas.get(id)?.lockdown; }
  everLocked(id: string): boolean { return !!this.areas.get(id)?.everLocked; }

  /** HUD level for the player's current area. */
  level(): AlertLevel {
    const a = this.areaAt(this.w.focusPos());
    const id = a?.def.id;
    if (a?.lockdown) return 3;
    const h = this.w.perception.highest(id);
    return h === 'hunted' ? 2 : h === 'suspicious' ? 1 : 0;
  }
  detection(): number { const a = this.areaAt(this.w.focusPos()); return this.w.perception.detectionLevel(a?.def.id); }

  requestAlarm(e: Enemy): void {
    if (this.alarmsOfflineT > 0) return;
    const a = this.areas.get(e.spawn.area);
    if (!a || a.lockdown || !a.def.panels.length) return;
    if (this.w.enemies.some((o) => o !== e && o.alive && o.alarmTarget)) return;
    let best: { id: string; pos: THREE.Vector3 } | null = null; let bd = 45;
    for (const p of a.def.panels) { const pos = new THREE.Vector3(...p.at); const d = pos.distanceTo(e.pos); if (d < bd) { bd = d; best = { id: p.id, pos }; } }
    if (!best) return;
    e.alarmTarget = best; e.alarmT = 0;
    e.bark('alarm');
    for (const fn of this.listeners) fn({ type: 'alarm-start', area: a.def.id });
  }

  alarmProgress(e: Enemy, panelId: string, t: number): void {
    const a = this.areas.get(e.spawn.area); if (!a) return;
    const lamp = a.panelMeshes.get(panelId);
    if (lamp) (lamp.material as THREE.MeshStandardMaterial).emissiveIntensity = 1 + 3 * Math.abs(Math.sin(t * 9));
    if (Math.floor(t * 2) !== Math.floor((t - this.w.step) * 2)) { this.w.audio?.sfx('alarm.pulse', e.pos, 0.8); this.w.fx.marker(e.pos, 3 + t, PALETTE.red, 0.5); }
    if (this.alarmsOfflineT > 0) { e.alarmTarget = null; return; }
    if (t >= ALERT.lockdown.alarmPanelSeconds) { e.alarmTarget = null; this.lockdown(a, 'alarm'); }
  }

  onEnemyDown(e: Enemy): void { if (e.alarmTarget) e.alarmTarget = null; }

  droneSpotted(d: Enemy): void {
    const lk = d.perceiver.lastKnown; if (!lk) return;
    for (const e of this.w.enemies) if (e !== d && e.alive && e.spawn.area === d.spawn.area && e.pos.distanceTo(d.pos) < 40) this.w.perception.escalate(e.perceiver, 'suspicious', 'radio', lk);
  }

  lockdown(a: AreaState, cause: 'alarm' | 'hunted'): void {
    if (a.lockdown) return;
    a.lockdown = true; a.everLocked = true; a.noSightT = 0;
    this.lockdownsThisChapter++;
    this.w.counters.lockdowns++;
    for (const g of a.def.fastGates) this.w.gates.seal(g);
    this.w.audio?.sfx('siren.lockdown', this.w.focusPos(), 1);
    for (const e of this.w.enemies) if (e.alive && e.spawn.area === a.def.id) { this.w.perception.escalate(e.perceiver, 'hunted', 'radio', this.w.focusPos()); if (e === this.w.enemies.find((x) => x.alive && x.spawn.area === a.def.id)) e.bark('lockdown'); }
    if (!a.reinforced && a.def.reinforcements?.length) {
      a.reinforced = true;
      for (const s of a.def.reinforcements) {
        const en = new Enemy(this.w, s);
        this.w.enemies.push(en);
        this.w.perception.setAwareness(en.perceiver, 'hunted', 'forced', this.w.focusPos());
      }
      this.w.enemies.find((x) => x.alive && x.spawn.area === a.def.id)?.bark('reinforce');
    }
    for (const fn of this.listeners) fn({ type: 'lockdown', area: a.def.id });
    void cause;
  }

  update(dt: number): void {
    this.alarmsOfflineT = Math.max(0, this.alarmsOfflineT - dt);
    for (const a of this.areas.values()) {
      const enemies = this.w.enemies.filter((e) => e.alive && e.spawn.area === a.def.id);
      const anyHunted = enemies.some((e) => e.awareness === 'hunted');
      const anySees = enemies.some((e) => e.perceiver.seesTarget);
      a.huntedT = anyHunted ? a.huntedT + dt : 0;
      if (!a.lockdown && a.huntedT >= ALERT.lockdown.huntedSeconds) this.lockdown(a, 'hunted');
      if (a.lockdown) {
        a.noSightT = anySees ? 0 : a.noSightT + dt;
        if (a.noSightT >= ALERT.lockdown.decaySeconds || enemies.length === 0) {
          a.lockdown = false; a.huntedT = 0;
          for (const e of enemies) if (e.awareness === 'hunted') this.w.perception.setAwareness(e.perceiver, 'suspicious', 'decay', e.perceiver.lastKnown);
          for (const fn of this.listeners) fn({ type: 'lockdown-end', area: a.def.id });
        }
      }
      for (const [id, lamp] of a.panelMeshes) {
        const m = lamp.material as THREE.MeshStandardMaterial;
        const busy = enemies.some((e) => e.alarmTarget?.id === id);
        if (!busy) m.emissiveIntensity = a.lockdown ? 2.5 : this.alarmsOfflineT > 0 ? 0.05 : 0.4;
      }
    }
  }
}
