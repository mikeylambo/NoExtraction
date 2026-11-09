import * as THREE from 'three';
import { PLAYER } from '../../data/player';
import { WORLD_UNIFORMS } from '../world/Materials';
import type { World } from '../game/World';
import type { InputFrame } from '../game/Input';
import type { Ballast } from './Ballast';

const VZ = PLAYER.visor;

/** Recon visor: 1.2 s pulse marks enemies within 30 m through walls for 8 s; 12 s cooldown. */
export class Visor {
  cooldown = 0;
  private pulseT = -1;
  /** Seconds the visor is knocked offline (aurora flare). */
  offline = 0;
  uses = 0;
  constructor(private readonly w: World, private readonly p: Ballast) {}

  get ready(): boolean { return this.cooldown <= 0 && this.offline <= 0; }
  get cooldown01(): number { return 1 - this.cooldown / VZ.cooldown; }

  update(dt: number, f: InputFrame, canAct: boolean): void {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.offline = Math.max(0, this.offline - dt);
    if (canAct && f.pressed.has('scan')) {
      if (this.ready) this.pulse();
      else this.w.audio?.sfx('empty', this.p.pos, 0.3);
    }
    if (this.pulseT >= 0) {
      this.pulseT += dt;
      const k = Math.min(1, this.pulseT / VZ.pulse);
      WORLD_UNIFORMS.uScanRadius.value = k * VZ.radius * 1.25;
      WORLD_UNIFORMS.uScanStrength.value = k < 0.85 ? 1 : (1 - k) / 0.15;
      for (const e of this.w.enemies) {
        if (!e.alive || e.marked > 0) continue;
        if (e.pos.distanceTo(this.origin) <= k * VZ.radius) e.mark(VZ.markDuration);
      }
      if (k >= 1) { this.pulseT = -1; WORLD_UNIFORMS.uScanStrength.value = 0; WORLD_UNIFORMS.uScanRadius.value = -100; }
    }
  }

  private origin = new THREE.Vector3();
  pulse(): void {
    this.cooldown = VZ.cooldown; this.pulseT = 0; this.uses++;
    this.origin = this.p.pos.clone();
    WORLD_UNIFORMS.uScanOrigin.value.copy(this.origin);
    this.w.audio?.sfx('visor.pulse', this.p.pos, 0.9);
    this.w.hud?.scanPulse();
  }

  dispose(): void { WORLD_UNIFORMS.uScanStrength.value = 0; WORLD_UNIFORMS.uScanRadius.value = -100; }
}
