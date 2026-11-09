import * as THREE from 'three';
import type { World } from '../game/World';
import type { InputFrame } from '../game/Input';

export type PromptColor = 'cyan' | 'amber';
export interface Interactable {
  id: string;
  pos: THREE.Vector3;
  radius: number;
  prompt: string;
  color?: PromptColor;
  /** Seconds to hold; 0 = instant. */
  hold: number;
  enabled: () => boolean;
  onComplete: () => void;
  onTick?: (t: number) => void;
  onCancel?: () => void;
  /** Taking damage cancels (gate hacks). */
  interruptible?: boolean;
}

/** Interaction prompts with hold progress. Interact (E) or the pad's A button. */
export class Interactables {
  private list = new Map<string, Interactable>();
  focused: Interactable | null = null;
  progress = 0;
  private lastHealth = 100;
  constructor(private readonly w: World) {}

  add(i: Interactable): void { this.list.set(i.id, i); }
  remove(id: string): void { this.list.delete(id); if (this.focused?.id === id) { this.focused = null; this.progress = 0; } }
  get(id: string): Interactable | undefined { return this.list.get(id); }
  clear(): void { this.list.clear(); this.focused = null; this.progress = 0; }
  all(): Interactable[] { return [...this.list.values()]; }

  /** Complete an interactable instantly (bot / dev). */
  force(id: string): boolean { const i = this.list.get(id); if (!i || !i.enabled()) return false; i.onComplete(); return true; }

  update(dt: number, f: InputFrame, canAct: boolean): void {
    const p = this.w.player;
    if (!p || !canAct || p.busy) { this.cancel(); this.focused = null; return; }
    const fwd = p.cam.forward();
    let best: Interactable | null = null; let bs = Infinity;
    for (const i of this.list.values()) {
      if (!i.enabled()) continue;
      const to = i.pos.clone().sub(p.pos); const d = Math.hypot(to.x, to.z);
      if (d > i.radius || Math.abs(to.y) > 2.2) continue;
      const s = d - to.setY(0).normalize().dot(fwd) * 0.6;
      if (s < bs) { bs = s; best = i; }
    }
    if (best !== this.focused) { this.cancel(); this.focused = best; }
    const i = this.focused; if (!i) return;
    const holding = f.down.has('interact') || (f.down.has('jump') && f.pad);
    const tapped = f.pressed.has('interact') || (f.pressed.has('jump') && f.pad);
    if (i.interruptible && p.health < this.lastHealth - 0.5) this.cancel();
    this.lastHealth = p.health;
    if (i.hold <= 0) { if (tapped) { i.onComplete(); this.focused = null; } return; }
    if (holding) {
      this.progress += dt / i.hold;
      i.onTick?.(this.progress * i.hold);
      if (this.progress >= 1) { this.progress = 0; const done = i; this.focused = null; done.onComplete(); }
    } else this.cancel();
  }

  private cancel(): void { if (this.progress > 0) this.focused?.onCancel?.(); this.progress = 0; }
}
