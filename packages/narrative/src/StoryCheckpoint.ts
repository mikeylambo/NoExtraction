import type { WorldState, WorldStateSnapshot } from './WorldState';
import type { StoryGraph, StoryGraphSnapshot } from './StoryGraph';
import type { TriggerSystem } from './Triggers';

/** Checkpoint + inventory + flags + WorldState in one save payload. */
export interface StoryCheckpointPayload<Inv = unknown, Extra = unknown> {
  version: 1;
  checkpointId: string;
  createdAt: string;
  story: StoryGraphSnapshot;
  world: WorldStateSnapshot;
  triggers: string[];
  inventory: Inv;
  extra: Extra;
}

export class StoryCheckpoint<Inv = unknown, Extra = unknown> {
  constructor(private readonly graph: StoryGraph, private readonly world: WorldState, private readonly triggers: TriggerSystem) {}

  capture(checkpointId: string, inventory: Inv, extra: Extra): StoryCheckpointPayload<Inv, Extra> {
    return structuredClone({
      version: 1 as const, checkpointId, createdAt: new Date().toISOString(),
      story: this.graph.snapshot(), world: this.world.snapshot(), triggers: this.triggers.snapshot(), inventory, extra,
    });
  }

  /** Restores story/world/trigger state; returns inventory + extra for the game to apply. */
  restore(p: StoryCheckpointPayload<Inv, Extra>): { inventory: Inv; extra: Extra; checkpointId: string } {
    if (p.version !== 1) throw new Error(`Unsupported checkpoint version ${String(p.version)}`);
    const c = structuredClone(p);
    this.world.hydrate(c.world);
    this.graph.hydrate(c.story);
    this.triggers.hydrate(c.triggers);
    return { inventory: c.inventory, extra: c.extra, checkpointId: c.checkpointId };
  }
}
