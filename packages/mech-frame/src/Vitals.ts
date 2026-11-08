export type HitResult = 0 | 1 | 2; // 0 = no effect, 1 = damage, 2 = damage + stagger

export interface VitalsTuning { impactDecay: number; staggerDmgMult: number; impactHoldAfterHit: number; exposedMult: number }

/**
 * Structure / Impact / Stagger — AlphaMech `frame/Vitals.ts`, with tuning passed in instead of
 * read from a global. Agnostic about what it is attached to.
 */
export class Vitals {
  structure: number;
  structureMax: number;
  impact = 0;
  impactMax: number;
  stagger = 0;
  staggerDur: number;
  exposed = 0;
  private holdT = 0;
  damageTaken = 0;
  impactFrozenFor = 0;
  noDecay = false;
  staggersTaken = 0;
  lastStaggerAt = -999;

  constructor(structure: number, impactMax: number, staggerDur: number, readonly tune: VitalsTuning) {
    this.structure = this.structureMax = structure;
    this.impactMax = impactMax;
    this.staggerDur = staggerDur;
  }

  get alive() { return this.structure > 0; }
  get staggered() { return this.stagger > 0; }
  get isExposed() { return this.exposed > 0; }
  get structure01() { return this.structure / this.structureMax; }
  get impact01() { return this.impact / this.impactMax; }

  tick(dt: number) {
    this.stagger = Math.max(0, this.stagger - dt);
    this.exposed = Math.max(0, this.exposed - dt);
    this.holdT = Math.max(0, this.holdT - dt);
    this.impactFrozenFor = Math.max(0, this.impactFrozenFor - dt);
    if (this.holdT <= 0 && this.stagger <= 0 && this.impactFrozenFor <= 0 && !this.noDecay)
      this.impact = Math.max(0, this.impact - this.tune.impactDecay * dt);
  }

  hit(damage: number, impact: number, now = 0): HitResult {
    if (!this.alive) return 0;
    const vulnerable = this.staggered;
    const dealt = damage * (vulnerable ? this.tune.staggerDmgMult : 1);
    this.structure = Math.max(0, this.structure - dealt);
    this.damageTaken += Math.min(dealt, this.structure + dealt);
    this.holdT = this.tune.impactHoldAfterHit;
    if (!vulnerable && impact > 0) {
      this.impact += impact * (this.exposed > 0 ? this.tune.exposedMult : 1);
      if (this.impact >= this.impactMax) {
        this.impact = 0; this.stagger = this.staggerDur; this.staggersTaken++; this.lastStaggerAt = now;
        return 2;
      }
    }
    return 1;
  }

  heal(amount: number) { this.structure = Math.min(this.structureMax, this.structure + amount); }

  reset(structure = this.structureMax) {
    this.structureMax = structure; this.structure = structure;
    this.impact = 0; this.stagger = 0; this.exposed = 0; this.holdT = 0; this.damageTaken = 0;
  }
}
