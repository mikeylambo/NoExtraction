import * as THREE from 'three';
import { LevelBuilder, V } from './Builder';
import { Enemy, type EnemySpawn } from '../ai/Enemy';
import type { AreaDef } from '../ai/AlertDirector';
import type { GateDef } from './Gates';
import type { CollapseInstance } from './Collapse';
import { CACHES } from '../../data/caches';
import { COMPONENTS, type ComponentId } from '../../data/components';
import { WEAPONS, type WeaponId } from '../../data/weapons';
import { PALETTE } from '../../data/palette';
import { glowSprite } from './Materials';
import type { World } from '../game/World';

export type Vec3T = [number, number, number];
export interface SpawnPoint { pos: Vec3T; yaw: number; mech?: boolean }

/** One step of a chapter's critical path for the headless bot. */
export type BotStep =
  | { do: 'goto'; to: Vec3T; crouch?: boolean; sprint?: boolean; tol?: number; timeout?: number; jump?: boolean }
  | { do: 'interact'; id: string; hold?: boolean }
  | { do: 'wait'; s: number }
  | { do: 'passGate'; gate: string }
  | { do: 'breach'; door: string; at: Vec3T }
  | { do: 'waitFlag'; flag: string; timeout?: number }
  | { do: 'takedowns'; radius: number; area?: string; ids?: string[] }
  | { do: 'clearArea'; area: string; loud?: boolean }
  | { do: 'mechFight'; until: string; timeout?: number }
  | { do: 'mechGoto'; to: Vec3T; assault?: boolean; fly?: boolean; tol?: number; timeout?: number }
  | { do: 'ascent' }
  | { do: 'skipCinematic' }
  | { do: 'call'; fn: string };

export interface LevelDef {
  id: string;
  build(ctx: LevelContext): void;
  spawn: SpawnPoint;
  checkpoints: Record<string, SpawnPoint>;
  bot: BotStep[];
  /** Ambient music cue. */
  music: string;
  /** Mech-scale chapter. */
  mech?: boolean;
}

/** What level builders can place. Everything is data-driven from the level file. */
export class LevelContext {
  readonly b: LevelBuilder;
  constructor(readonly w: World, readonly skipEnemies: Set<string>) { this.b = new LevelBuilder(w.collision); }

  enemy(s: EnemySpawn): Enemy | null {
    const key = s.id ?? `${s.type}@${s.at.map((v) => Math.round(v)).join(',')}`;
    s.id = key;
    if (this.skipEnemies.has(key)) return null;
    const e = new Enemy(this.w, s);
    this.w.enemies.push(e);
    return e;
  }
  area(def: AreaDef): void { this.w.alert.addArea(def); }
  gate(def: GateDef): void { this.w.gates.add(this.b, def); }
  collapse(list: CollapseInstance[]): void { this.w.collapse.register(list); }

  /** Wren's cache: amber light, amber prompt, recording + contents. */
  cache(id: string, at: Vec3T, yaw = 0): void {
    const def = CACHES.find((c) => c.id === id)!;
    const w = this.w;
    const g = new THREE.Group(); g.position.set(...at); g.rotation.y = yaw;
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.55, 0.55), new THREE.MeshStandardMaterial({ color: 0x3a3a36, roughness: 0.6, metalness: 0.4 }));
    body.position.y = 0.28; body.castShadow = true; g.add(body);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.06, 0.57), new THREE.MeshStandardMaterial({ color: 0x100800, emissive: PALETTE.amber, emissiveIntensity: 2.5 }));
    stripe.position.y = 0.42; g.add(stripe);
    // amber diamond marker (shape carries meaning too)
    const dia = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), new THREE.MeshStandardMaterial({ color: 0x100800, emissive: PALETTE.amber, emissiveIntensity: 3 }));
    dia.position.y = 1.1; g.add(dia);
    const glow = glowSprite(PALETTE.amber, 3, 0.6); glow.position.y = 0.7; g.add(glow);
    w.scene.add(g);
    const taken = () => w.state.has(`cache.${id}`);
    const emitter = w.lights.add({ pos: V(...at).setY(at[1] + 1.2), color: PALETTE.amber, intensity: 6, distance: 9, priority: 0.5, enabled: () => !taken() });
    const refresh = () => { stripe.visible = dia.visible = glow.visible = !taken(); };
    refresh();
    w.onStep(`cache-spin-${id}`, (dt) => { dia.rotation.y += dt * 1.5; dia.position.y = 1.1 + Math.sin(w.simTime * 2) * 0.05; refresh(); });
    w.interact.add({
      id: `cache:${id}`, pos: V(...at), radius: 2, prompt: 'Open cache', color: 'amber', hold: 0.6,
      enabled: () => !taken(),
      onComplete: () => {
        w.state.set(`cache.${id}`);
        w.inventory.caches.push(id);
        const c = def.contents, inv = w.inventory;
        if (c.stims) inv.stims = Math.min(3, inv.stims + c.stims);
        if (c.flash) inv.flash = Math.min(3, inv.flash + c.flash);
        if (c.decoy) inv.decoy = Math.min(3, inv.decoy + c.decoy);
        if (c.ammo) for (const wid of inv.weapons) w.player?.weapons.addAmmo(wid as WeaponId, Math.round(c.ammo * (wid === 'sidearm' ? 1 : 0.6)));
        if (c.routeMarker) w.state.set(`route.${c.routeMarker}`);
        w.audio?.sfx('cache.chime', null, 1);
        w.audio?.sfx('cache.click', null, 0.8);
        w.hud?.toast(def.kind === 'story' ? 'Wren' : 'Wren · personal', 'amber');
        w.dialogue.sayAll(def.lines, { channel: 'recording' });
        w.emit('cache', id);
        emitter.intensity = 0;
      },
    });
  }

  /** AEGIS component pickup (cyan: Ballast's information). */
  component(id: ComponentId, at: Vec3T): void {
    const w = this.w;
    const g = new THREE.Group(); g.position.set(...at);
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.8, 1), new THREE.MeshStandardMaterial({ color: 0xc9d1d8, metalness: 0.6, roughness: 0.35 }));
    body.position.y = 0.4; body.castShadow = true; g.add(body);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.04, 6, 24), new THREE.MeshBasicMaterial({ color: PALETTE.cyan }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.05; g.add(ring);
    w.scene.add(g);
    const has = () => w.hasComponent(id);
    w.onStep(`comp-${id}`, () => { g.visible = !has(); ring.scale.setScalar(1 + Math.sin(w.simTime * 3) * 0.05); });
    w.interact.add({
      id: `component:${id}`, pos: V(...at), radius: 2.4, prompt: `Take ${COMPONENTS[id].name}`, hold: 1.2,
      enabled: () => !has(),
      onComplete: () => { w.inventory.components.push(id); w.state.set(`component.${id}`); w.audio?.sfx('gear.rattle', null, 1); w.hud?.toast(COMPONENTS[id].name, 'cyan'); w.emit('component', id); },
    });
  }

  /** Weapon / ammo / stim / throwable pickup. */
  pickup(kind: WeaponId | 'stim' | 'flash' | 'decoy' | 'ammo', at: Vec3T, amount = 1, id = `${kind}@${at.join(',')}`): void {
    const w = this.w;
    const key = `pickup.${id}`;
    if (w.state.has(key)) return;
    const g = new THREE.Group(); g.position.set(...at);
    const isW = kind in WEAPONS;
    const mesh = new THREE.Mesh(isW ? new THREE.BoxGeometry(0.15, 0.15, 0.8) : new THREE.BoxGeometry(0.4, 0.25, 0.3), new THREE.MeshStandardMaterial({ color: 0x23272b, metalness: 0.5, roughness: 0.5 }));
    mesh.position.y = 0.9; g.add(mesh);
    const rack = new THREE.Mesh(new THREE.BoxGeometry(isW ? 1.2 : 0.6, 0.8, 0.4), new THREE.MeshStandardMaterial({ color: 0x4a5058, roughness: 0.7 }));
    rack.position.y = 0.4; g.add(rack);
    const mark = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: PALETTE.cyan }));
    mark.position.y = 1.25; g.add(mark);
    w.scene.add(g);
    const label = isW ? WEAPONS[kind as WeaponId].name : kind === 'stim' ? 'Stim' : kind === 'flash' ? 'Flash charge' : kind === 'decoy' ? 'Noise decoy' : 'Ammo';
    w.interact.add({
      id: `pickup:${id}`, pos: V(...at), radius: 1.8, prompt: `Take ${label}`, hold: 0,
      enabled: () => !w.state.has(key),
      onComplete: () => {
        w.state.set(key); g.visible = false;
        const inv = w.inventory, p = w.player;
        if (isW) { p?.weapons.give(kind as WeaponId); if (p) p.weapons.select(inv.weapons.indexOf(kind)); w.emit('weapon', kind); }
        else if (kind === 'stim') inv.stims = Math.min(3, inv.stims + amount);
        else if (kind === 'flash') inv.flash = Math.min(3, inv.flash + amount);
        else if (kind === 'decoy') inv.decoy = Math.min(3, inv.decoy + amount);
        else for (const wid of inv.weapons) p?.weapons.addAmmo(wid as WeaponId, amount * (wid === 'sidearm' ? 12 : WEAPONS[wid as WeaponId].mag));
        w.audio?.sfx('gear.rattle', null, 0.8);
        w.hud?.toast(label, 'cyan');
      },
    });
  }

  /** Generic story interaction (sabotage, levers, consoles). */
  use(id: string, at: Vec3T, prompt: string, hold: number, onComplete: () => void, enabled: () => boolean = () => !this.w.state.has(`used.${id}`)): void {
    const w = this.w;
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.1), new THREE.MeshStandardMaterial({ color: 0x050505, emissive: PALETTE.cyan, emissiveIntensity: 1.6 }));
    m.position.set(at[0], at[1] + 1.2, at[2]); w.scene.add(m);
    w.onStep(`use-${id}`, () => { m.visible = enabled(); });
    w.interact.add({ id, pos: V(...at), radius: 2.2, prompt, hold, enabled, onComplete: () => { w.state.set(`used.${id}`); onComplete(); } });
  }

  /** Floor sign / route marker (cyan = Ballast's info: fast route). */
  sign(at: Vec3T, yaw: number, color: number, w = 2.4, h = 0.6): THREE.Mesh {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.08), new THREE.MeshStandardMaterial({ color: 0x050505, emissive: color, emissiveIntensity: 1.4 }));
    m.position.set(...at); m.rotation.y = yaw; this.w.scene.add(m);
    return m;
  }

  light(at: Vec3T, color: number, intensity = 8, distance = 14, priority = 0): void { this.w.lights.add({ pos: V(...at), color, intensity, distance, priority }); this.b.glow(at[0], at[1], at[2], color, 1.6, 0.5); }

  /** Distant landmark (always visible = always the goal). */
  landmark(at: Vec3T, kind: 'yard' | 'mast' | 'pad' | 'complex'): void {
    const w = this.w; const g = new THREE.Group(); g.position.set(...at);
    const mat = new THREE.MeshBasicMaterial({ color: 0x0c1218, fog: false });
    if (kind === 'yard') {
      for (let i = -2; i <= 2; i++) { const t = new THREE.Mesh(new THREE.BoxGeometry(18, 180 + Math.abs(i) * -30, 18), mat); t.position.set(i * 60, 90, 0); g.add(t); }
      const cradle = new THREE.Mesh(new THREE.CylinderGeometry(14, 22, 260, 8), mat); cradle.position.y = 130; g.add(cradle);
      for (let i = 0; i < 4; i++) { const s = glowSprite(0xffffff, 26, 0.9); (s.material as THREE.SpriteMaterial).fog = false; s.position.set(-120 + i * 80, 200, 0); g.add(s); s.userData.blink = i * 0.7; }
      w.onStep(`landmark-${at.join(',')}`, () => g.children.forEach((c) => { if (c.userData.blink !== undefined) c.visible = Math.sin(w.simTime * 2 + c.userData.blink) > 0.6; }));
    } else if (kind === 'mast') {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 1.4, 70, 6), new THREE.MeshStandardMaterial({ color: 0x3a434c })); m.position.y = 35; g.add(m);
      const s = glowSprite(0xffffff, 6, 0.9); s.position.y = 71; g.add(s);
    }
    w.scene.add(g);
  }

  water(id: string, min: Vec3T, max: Vec3T, level: number, lethal = true) { return this.w.hazards.addWater(id, min, max, level, lethal); }
  dark(min: Vec3T, max: Vec3T, amount: number) { this.w.hazards.addDark(min, max, amount); }
  weakDoor(id: string, min: Vec3T, max: Vec3T, onBreach?: () => void) { this.w.gates.addWeakDoor(this.b, id, min, max, onBreach); }

  finish(): void { this.b.finish(); this.w.scene.add(this.b.root); this.w.collapse.index(); }
}
