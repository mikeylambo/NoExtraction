import * as THREE from 'three';
import { TimeControl, TraumaShake } from '@slu/web-shell';
import { PerceptionSystem } from '@slu/perception';
import { WorldState, StoryGraph, TriggerSystem, VoiceTrack, DialogueDirector, SequenceDirector, CinematicCamera, StoryCheckpoint } from '@slu/narrative';
import { CollisionWorld } from '../world/Collision';
import { Rng } from './Rng';
import { Fx } from '../world/Fx';
import { Atmosphere } from '../world/Atmosphere';
import { ALERT } from '../../data/alert';
import { DIFFICULTY, type DifficultyId } from '../../data/enemies';
import type { GameOptions } from '../../data/options';
import type { ComponentId } from '../../data/components';
import { SPEAKERS } from '../../data/story';
import type { StoryAction } from '../story/Actions';
import type { Ballast } from '../player/Ballast';
import type { Enemy } from '../ai/Enemy';
import type { AlertDirector } from '../ai/AlertDirector';
import type { Interactables } from '../world/Interactables';
import type { Gates } from '../world/Gates';
import type { CollapseSystem } from '../world/Collapse';
import type { Hazards } from '../world/Hazards';
import type { TimedZones } from '../world/TimedZones';
import type { AudioEngine } from '../audio/Engine';
import type { Hud } from '../ui/Hud';
import type { Aegis } from '../mech/Aegis';
import type { MechHostile } from '../ai/MechHostile';
import type { LightPool } from '../world/LightPool';
import type { Ascent } from '../mech/Ascent';

export interface Inventory {
  weapons: string[];
  current: number;
  ammo: Record<string, { mag: number; reserve: number }>;
  flash: number;
  decoy: number;
  throwable: 'flash' | 'decoy';
  stims: number;
  health: number;
  components: ComponentId[];
  caches: string[];
}

export const freshInventory = (): Inventory => ({
  weapons: ['sidearm'], current: 0, ammo: { sidearm: { mag: 12, reserve: 36 } }, flash: 1, decoy: 1, throwable: 'flash', stims: 1, health: 100, components: [], caches: [],
});

export interface ChapterCounters { takedowns: number; lockdowns: number; deaths: number; startedAt: number; kills: number; shotsFired: number }

/**
 * Everything one chapter's simulation can reach. Systems receive the World and never import each
 * other's internals; story, AI and the player talk through it.
 */
export class World {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 6000);
  readonly collision = new CollisionWorld(8);
  readonly fx: Fx;
  readonly atmo: Atmosphere;
  readonly time = new TimeControl();
  readonly shake = new TraumaShake(undefined, 'nx.shake');
  shakeCap = 0.35;
  simTime = 0;
  readonly rng = new Rng(0x5eed);
  /** Fixed step, seconds. */
  readonly step = 1 / 60;

  // narrative layer
  readonly state = new WorldState();
  readonly graph = new StoryGraph(this.state);
  readonly triggers = new TriggerSystem(this.state);
  readonly voice = new VoiceTrack(this.state);
  readonly dialogue: DialogueDirector;
  readonly sequences = new SequenceDirector<StoryAction>();
  readonly cinematic = new CinematicCamera();
  readonly checkpoint: StoryCheckpoint<Inventory, import('./Session').CheckpointExtra>;

  // perception & AI
  readonly perception: PerceptionSystem;
  enemies: Enemy[] = [];
  mechHostiles: MechHostile[] = [];
  alert!: AlertDirector;

  // systems (assigned by the chapter loader)
  player: Ballast | null = null;
  aegis: Aegis | null = null;
  ascent: Ascent | null = null;
  ascentView: 'climb' | 'planet' | 'ship' | 'cockpit' = 'climb';
  interact!: Interactables;
  gates!: Gates;
  collapse!: CollapseSystem;
  hazards!: Hazards;
  zones!: TimedZones;
  lights!: LightPool;
  audio!: AudioEngine;
  hud!: Hud;

  inventory: Inventory = freshInventory();
  counters: ChapterCounters = { takedowns: 0, lockdowns: 0, deaths: 0, startedAt: 0, kills: 0, shotsFired: 0 };
  options!: GameOptions;
  difficultyId: DifficultyId = 'normal';
  chapterId = 'ch1';
  /** Dev: god mode, Timed Zone freeze. */
  dev = { god: false, freezeZones: false, perceptionDebug: false, infiniteAmmo: false };
  /** Current objective text and world position (ping). */
  objective: { text: string; pos: THREE.Vector3 | null } = { text: '', pos: null };
  /** Is the player controlling the mech? */
  get inMech(): boolean { return !!this.aegis && this.aegis.active; }

  private updaters: { id: string; fn: (dt: number) => void }[] = [];
  private listeners = new Map<string, ((payload: unknown) => void)[]>();
  /** Game event bus (cache, component, weapon, takedown, lockdown...). Story scripts listen here. */
  on(type: string, fn: (payload: unknown) => void): () => void { const a = this.listeners.get(type) ?? []; a.push(fn); this.listeners.set(type, a); return () => this.listeners.set(type, (this.listeners.get(type) ?? []).filter((f) => f !== fn)); }
  emit(type: string, payload?: unknown): void { for (const fn of [...(this.listeners.get(type) ?? [])]) fn(payload); }
  clearListeners(): void { this.listeners.clear(); }

  constructor() {
    this.fx = new Fx(this.scene);
    this.atmo = new Atmosphere(this.scene);
    this.voice.addSpeakers(SPEAKERS);
    this.dialogue = new DialogueDirector(this.voice);
    this.checkpoint = new StoryCheckpoint(this.graph, this.state, this.triggers);
    this.perception = new PerceptionSystem({
      occluded: (a, b) => this.collision.blocked(new THREE.Vector3(a.x, a.y, a.z), new THREE.Vector3(b.x, b.y, b.z), 'sight'),
      visionBlocked: (a, b) => this.hazards?.visionBlocked(a, b) ?? false,
    }, { radioDelay: ALERT.radio.delay });
  }

  get difficulty() { return DIFFICULTY[this.difficultyId]; }

  /** Register a per-step updater (chapter scripts, set pieces). */
  onStep(id: string, fn: (dt: number) => void): void { this.updaters = this.updaters.filter((u) => u.id !== id); this.updaters.push({ id, fn }); }
  offStep(id: string): void { this.updaters = this.updaters.filter((u) => u.id !== id); }
  runUpdaters(dt: number): void { for (const u of [...this.updaters]) u.fn(dt); }
  clearUpdaters(): void { this.updaters = []; }

  /** Post-processing hook set once by the app (not cleared between chapters). */
  postFx: ((kind: 'radialBlur' | 'flash' | 'chromatic', amount: number) => void) | null = null;

  addShake(amount: number): void {
    const capped = Math.min(this.shakeCap, amount);
    this.shake.trauma = Math.min(this.shakeCap, Math.max(this.shake.trauma, 0) + capped);
  }

  hitstop(ms: number): void { this.time.hitstop(ms); }

  /** Position the player character/mech occupies (story triggers, collapse targets). */
  focusPos(out = new THREE.Vector3()): THREE.Vector3 {
    if (this.inMech) return out.copy(this.aegis!.frame.pos);
    if (this.player) return out.copy(this.player.pos);
    return out.set(0, 0, 0);
  }

  hasComponent(id: ComponentId): boolean { return this.inventory.components.includes(id); }
}
