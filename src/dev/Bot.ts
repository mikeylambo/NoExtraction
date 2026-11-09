import * as THREE from 'three';
import type { App } from '../game/App';
import type { BotStep } from '../world/Level';
import { LEVELS } from '../world/levels';

export interface BotStatus { chapter: string; step: number; total: number; done: boolean; failed: string | null; log: string[]; startedAt: number; seconds: number; mode: 'stealth' | 'loud' }

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * Headless critical-path bot. Drives the real game through scripted semantic input (the same
 * InputFrame path a player uses): steering, crouching, vaulting, interacting, takedowns, shooting
 * back, mech combat and the ascent. No teleports, no forced interactions, no god mode by default.
 */
export class Bot {
  status: BotStatus | null = null;
  private steps: BotStep[] = [];
  private i = 0;
  private t = 0;
  private stuckT = 0;
  private lastPos = new THREE.Vector3();
  private strafe = 0;
  private strafeDir = 1;
  private down = new Set<string>();
  private look: [number, number] = [0, 0];
  private move: [number, number] = [0, 0];
  private tdCool = 0;
  private boostT = 0;
  private lockT = 0;
  private tapBoost = false;
  private tapT = 0;
  mode: 'stealth' | 'loud' = 'stealth';
  private cpStep = new Map<unknown, number>();
  private skipped = new Set<string>();
  private target = '';
  private targetT = 0;
  private deaths = 0;

  constructor(private readonly app: App) {}

  start(chapter: string, mode: 'stealth' | 'loud' = 'stealth'): void {
    this.mode = mode;
    this.steps = LEVELS[chapter]!.bot;
    this.i = 0; this.t = 0; this.cpStep.clear(); this.deaths = 0;
    this.status = { chapter, step: 0, total: this.steps.length, done: false, failed: null, log: [], startedAt: performance.now(), seconds: 0, mode };
    this.app.input.scripted = { move: this.move, look: this.look, down: this.down };
  }
  stop(): void { this.app.input.scripted = null; this.status = null; }
  private log(s: string): void { this.status?.log.push(`[${this.app.session.chapterTime.toFixed(1)}] ${s}`); }

  /** Called once per simulation step, before the session steps. */
  beforeStep(dt: number): void {
    const st = this.status; if (!st || st.done || st.failed) return;
    const w = this.app.session.w;
    if (this.app.mode !== 'playing') {
      // results → continue; anything else waits
      return;
    }
    st.seconds = this.app.session.chapterTime;
    // checkpoint-aware: on death, rewind to the step we were on when that checkpoint was saved
    const cp = this.app.session.lastCheckpoint;
    if (cp && !this.cpStep.has(cp)) { this.cpStep.set(cp, this.i); this.log(`checkpoint ${cp.checkpointId} hp ${Math.round(cp.inventory.health)} armor ${cp.extra.aegis ? Math.round(cp.extra.aegis.armor) : '-'} at ${cp.extra.spawn.pos.map(Math.round)}`); }
    if (w.counters.deaths > this.deaths) { this.deaths = w.counters.deaths; if (cp && this.cpStep.has(cp)) { this.i = this.cpStep.get(cp)!; this.t = 0; this.log(`respawned; rewinding to step ${this.i}`); } }
    this.down.clear(); this.look[0] = 0; this.look[1] = 0; this.move[0] = 0; this.move[1] = 0;
    this.tdCool = Math.max(0, this.tdCool - dt);
    // cinematics: just let them play out (holding skip would also work)
    if (w.cinematic.controlLocked) { if (this.steps[this.i]?.do === 'skipCinematic') this.down.add('skip'); return; }
    const step = this.steps[this.i];
    if (!step) { st.done = true; this.log('critical path complete'); this.app.input.scripted = null; return; }
    this.t += dt;
    st.step = this.i;
    const next = (msg: string) => { this.log(msg); this.i++; this.t = 0; this.stuckT = 0; };
    const fail = (msg: string) => { st.failed = `${this.i}:${step.do} ${msg}`; this.log(`FAIL ${msg}`); this.app.input.scripted = null; };

    if (w.player && w.player.mode === 'dead') return;
    if (!w.inMech && w.player) this.selfDefense(dt);

    switch (step.do) {
      case 'wait': if (this.t >= step.s) next(`waited ${step.s}s`); break;
      case 'breach': {
        const p = w.player!;
        if (w.state.applied(`breach.${step.door}`)) { next(`breached ${step.door}`); break; }
        const sg = w.inventory.weapons.indexOf('shotgun');
        if (sg < 0) { fail('no shotgun'); break; }
        if (w.inventory.current !== sg) this.down.add(`weapon${sg + 1}`);
        const at = new THREE.Vector3(...step.at);
        this.aimAt(at); this.down.add('aim');
        if (this.aimedAt(at) && this.t % 0.9 < 0.05) this.down.add('fire');
        void p;
        if (this.t > 30) fail(`breach ${step.door} timeout`);
        break;
      }
      case 'passGate': {
        if (!w.gates.isSealed(step.gate)) { next(`gate ${step.gate} open`); break; }
        const it = w.interact.get(`hack:${step.gate}`);
        if (!it) { fail('no console'); break; }
        if (this.steer(it.pos, 0.9, false, false)) this.down.add('interact');
        if (this.t > 90) fail(`hack ${step.gate} timeout`);
        break;
      }
      case 'skipCinematic': next('no cinematic'); break;
      case 'waitFlag': if (w.state.has(step.flag)) next(`flag ${step.flag}`); else if (this.t > (step.timeout ?? 60)) fail(`flag ${step.flag} timeout`); break;
      case 'call': this.app.session.callHook(step.fn); next(`call ${step.fn}`); break;
      case 'goto': {
        const to = new THREE.Vector3(...step.to);
        if (this.steer(to, step.tol ?? 1.2, !!step.crouch, !!step.sprint && this.mode === 'stealth' ? true : !!step.sprint, !!step.jump)) next(`at ${step.to.map(Math.round).join(',')}`);
        else if (this.t > (step.timeout ?? 90)) fail(`goto ${step.to.join(',')} timeout`);
        break;
      }
      case 'interact': {
        const it = w.interact.get(step.id);
        if (!it) { fail(`no interactable ${step.id}`); break; }
        if (!it.enabled()) { next(`${step.id} done`); break; }
        if (this.steer(it.pos, Math.min(1.2, it.radius * 0.6), false, false)) {
          const p = w.player!; const to = it.pos.clone().sub(p.pos); this.faceYaw(Math.atan2(-to.x, -to.z), 0.3);
          this.down.add('interact');
        }
        if (this.t > 60) fail(`interact ${step.id} timeout`);
        break;
      }
      case 'takedowns': {
        const p = w.player!;
        const targets = w.enemies.filter((e) => e.alive && e.def.takedown !== 'none' && !this.skipped.has(e.key) && (!step.ids || step.ids.includes(e.key)) && (step.area ? e.spawn.area === step.area : e.pos.distanceTo(p.pos) < step.radius) && e.awareness !== 'hunted' && (step.area ? Math.abs(e.pos.y - p.pos.y) < 1.5 : true));
        if (!targets.length) { next('area clear'); break; }
        const e = targets.sort((a, b) => a.pos.distanceTo(p.pos) - b.pos.distanceTo(p.pos))[0]!;
        if (this.target !== e.key) { this.target = e.key; this.targetT = 0; }
        this.targetT += w.step;
        if (this.targetT > 30) { this.skipped.add(e.key); this.log(`skip unreachable ${e.key}`); break; }
        this.approachBehind(e);
        if (this.t > 200) fail('takedowns timeout');
        break;
      }
      case 'clearArea': {
        const alive = w.enemies.filter((e) => e.alive && e.spawn.area === step.area);
        if (!alive.length) { next(`cleared ${step.area}`); break; }
        const p = w.player!;
        const e = alive.sort((a, b) => a.pos.distanceTo(p.pos) - b.pos.distanceTo(p.pos))[0]!;
        if (step.loud) { this.aimAt(e.headPos()); this.down.add('aim'); if (this.aimedAt(e.headPos())) this.down.add('fire'); if (e.pos.distanceTo(p.pos) > 18) this.steer(e.pos, 10, false, false); }
        else this.approachBehind(e);
        if (this.t > 150) fail(`clear ${step.area} timeout`);
        break;
      }
      case 'mechGoto': {
        const a = w.aegis!; const to = new THREE.Vector3(...step.to);
        const d = Math.hypot(to.x - a.frame.pos.x, to.z - a.frame.pos.z);
        this.mechSteer(to, !!step.assault || d > 160, !!step.fly);
        this.mechCombat(dt);
        const outOfArena = !!a.bounds && Math.hypot(to.x - a.bounds.center.x, to.z - a.bounds.center.z) > a.bounds.radius;
        if (d < (step.tol ?? 20) || outOfArena) next(`mech at ${step.to.map(Math.round).join(',')}${outOfArena ? ' (arena-bounded)' : ''}`);
        else if (this.t > (step.timeout ?? 120)) fail(`mechGoto timeout (${Math.round(d)}m left)`);
        break;
      }
      case 'mechFight': {
        const hs = w.mechHostiles.filter((h) => h.alive && h.active);
        if (w.state.has(step.until)) { next(`fight done (${step.until})`); break; }
        const h = hs.sort((x, y) => x.pos.distanceTo(w.aegis!.frame.pos) - y.pos.distanceTo(w.aegis!.frame.pos))[0];
        if (h) {
          const a = w.aegis!; const d = h.pos.distanceTo(a.frame.pos);
          const side = new THREE.Vector3().subVectors(h.pos, a.frame.pos).setY(0).normalize();
          const orbit = a.frame.pos.clone().add(new THREE.Vector3(-side.z, 0, side.x).multiplyScalar(60 * this.strafeDir)).addScaledVector(side, d > 140 ? 80 : d < 60 ? -40 : 0);
          if (a.bounds) { const c = a.bounds.center; const rel = orbit.clone().sub(c).setY(0); const lim = a.bounds.radius * 0.6; if (rel.length() > lim) orbit.copy(c).add(rel.setLength(lim)); }
          this.mechSteer(orbit, d > 240, false, h.pos);
        }
        this.mechCombat(dt);
        if (this.t > (step.timeout ?? 600)) fail(`mechFight ${step.until} timeout (${w.mechHostiles.filter((m) => m.alive && m.active).map((m) => `${m.name} ${Math.round(m.hp)}hp @${Math.round(m.pos.distanceTo(w.aegis!.frame.pos))}m`).join(', ')}; aegis y ${Math.round(w.aegis!.frame.pos.y)})`);
        break;
      }
      case 'ascent': {
        const asc = (w as unknown as { ascent?: { botSteer(): [number, number] } }).ascent;
        if (asc) { const [x, z] = asc.botSteer(); this.move[0] = x; this.move[1] = z; }
        if (w.state.has('ascent.done')) next('ascent complete');
        else if (this.t > 600) fail('ascent timeout');
        break;
      }
    }
  }

  /** Shoot back when hunted (survival), take any free takedown on the way. */
  private selfDefense(dt: number): void {
    const w = this.app.session.w; const p = w.player!;
    if (p.mode !== 'move') return;
    const cand = p.chainCandidate ?? p.takedownCandidate;
    if (cand && this.tdCool <= 0) { this.down.add('takedown'); this.tdCool = 0.3; return; }
    const hunting = w.enemies.filter((e) => e.alive && e.awareness === 'hunted' && e.pos.distanceTo(p.pos) < 35 && !w.collision.blocked(p.eye, e.headPos(), 'bullet'));
    if (hunting.length || this.mode === 'loud') {
      const vis = (hunting.length ? hunting : w.enemies.filter((e) => e.alive && e.pos.distanceTo(p.pos) < 30 && !w.collision.blocked(p.eye, e.headPos(), 'bullet')));
      const e = vis.sort((a, b) => a.pos.distanceTo(p.pos) - b.pos.distanceTo(p.pos))[0];
      if (e) {
        this.aimAt(e.headPos()); this.down.add('aim');
        if (this.aimedAt(e.headPos())) { this.down.add('fire'); if (w.inventory.weapons.length > 1 && hunting.length && w.inventory.current === 0) this.down.add('weapon2'); }
      }
    }
    if (p.health < 45 && w.inventory.stims > 0) this.down.add('stim');
    void dt;
  }

  /** Sneak up from behind: flank first if in front, freeze/back off while a cone is filling. */
  private approachBehind(e: import('../ai/Enemy').Enemy): void {
    const p = this.app.session.w.player!;
    const back = new THREE.Vector3(Math.sin(e.yaw), 0, Math.cos(e.yaw));
    const toMe = p.pos.clone().sub(e.pos).setY(0);
    const dist = toMe.length();
    const inFront = toMe.normalize().dot(back) < -0.2;
    let goal = e.pos.clone().addScaledVector(back, 1.2);
    if (inFront && dist < 18) { const side = new THREE.Vector3(back.z, 0, -back.x); if (side.dot(toMe) < 0) side.negate(); goal = e.pos.clone().addScaledVector(side, 7).addScaledVector(back, 4); }
    this.steer(goal, 0.5, true, false);
  }

  /** A cone is filling on us: stop and step back out of it. */
  private noticed(): boolean {
    const w = this.app.session.w;
    return w.enemies.some((e) => e.alive && e.awareness === 'unaware' && e.perceiver.seesTarget && e.perceiver.suspicion > 0.15);
  }

  private faceYaw(yaw: number, gain = 0.25): void {
    const w = this.app.session.w;
    const cur = w.inMech ? w.aegis!.frame.yaw : w.player!.cam.yaw;
    this.look[0] = wrap(yaw - cur) * gain;
  }
  private aimAt(t: THREE.Vector3): void {
    const w = this.app.session.w; const c = w.player!.cam;
    const from = c.position; const d = t.clone().sub(from);
    // the camera ray (not the pivot) is what fires: solve against the actual view direction
    const cam = w.camera; const dir = new THREE.Vector3(); cam.getWorldDirection(dir);
    const want = t.clone().sub(cam.position).normalize();
    const yawErr = wrap(Math.atan2(-want.x, -want.z) - Math.atan2(-dir.x, -dir.z));
    const pitchErr = Math.asin(Math.max(-1, Math.min(1, want.y))) - Math.asin(Math.max(-1, Math.min(1, dir.y)));
    this.look[0] = yawErr * 0.8; this.look[1] = pitchErr * 0.8;
    void c; void d;
  }
  private aimedAt(t: THREE.Vector3): boolean {
    const cam = this.app.session.w.camera; const dir = new THREE.Vector3(); cam.getWorldDirection(dir);
    return dir.dot(t.clone().sub(cam.position).normalize()) > 0.99985;
  }

  /** Walk toward a point. Returns true on arrival. */
  private steer(to: THREE.Vector3, tol: number, crouch: boolean, sprint: boolean, jump = false): boolean {
    const w = this.app.session.w; const p = w.player!;
    const d = to.clone().sub(p.pos); const dist = Math.hypot(d.x, d.z);
    if (dist <= tol) return true;
    if (!this.down.has('aim')) this.faceYaw(Math.atan2(-d.x, -d.z));
    const rel = wrap(Math.atan2(-d.x, -d.z) - p.cam.yaw);
    this.move[0] = -Math.sin(rel); this.move[1] = Math.cos(rel);
    if (this.strafe > 0) { this.strafe -= this.app.session.w.step; this.move[0] = this.strafeDir; this.move[1] = 0.3; }
    if (crouch && this.noticed()) { this.move[0] = -this.move[0]; this.move[1] = -this.move[1]; this.lastPos.copy(p.pos); return false; }
    if (crouch && !p.crouched) this.down.add('crouch');
    if (!crouch && p.crouched && this.t % 1 < 0.02) this.down.add('crouch');
    if (sprint && dist > 4) this.down.add('sprint');
    const moved = p.pos.distanceTo(this.lastPos);
    this.lastPos.copy(p.pos);
    if (moved < 0.01) { this.stuckT += w.step; if (this.stuckT > 0.5) this.down.add('jump'); if (this.stuckT > 1.4) { this.strafe = 0.7; this.strafeDir *= -1; this.stuckT = 0; } }
    else this.stuckT = Math.max(0, this.stuckT - w.step * 0.5);
    if (jump && this.t % 0.5 < 0.02) this.down.add('jump');
    return false;
  }

  private mechSteer(to: THREE.Vector3, assault: boolean, fly: boolean, face?: THREE.Vector3): void {
    const w = this.app.session.w; const a = w.aegis!;
    const d = to.clone().sub(a.frame.pos);
    const look = face ? face.clone().sub(a.frame.pos) : d;
    this.faceYaw(Math.atan2(-look.x, -look.z), 0.2);
    const rel = wrap(Math.atan2(-d.x, -d.z) - a.frame.yaw);
    this.move[0] = -Math.sin(rel); this.move[1] = Math.cos(rel);
    if (assault && a.frame.energy > 25) this.down.add('m_boost');
    let gapAhead = false;
    const sp = Math.max(30, a.frame.speed);
    for (const k of [0.15, 0.3, 0.45]) { const d2 = sp * k + 8; const g = w.collision.mechGroundAt(a.frame.pos.x - Math.sin(a.frame.yaw) * d2, a.frame.pos.z - Math.cos(a.frame.yaw) * d2, a.frame.pos.y + 10); if (g === -Infinity || g > a.frame.pos.y + 3) gapAhead = true; }
    if (fly || gapAhead || (!a.frame.grounded && a.frame.caps.sustainedFlight && w.collision.mechGroundAt(a.frame.pos.x, a.frame.pos.z, a.frame.pos.y + 10) === -Infinity)) this.down.add('m_jets');
    const moved = a.frame.pos.distanceTo(this.lastPos); this.lastPos.copy(a.frame.pos);
    if (moved < 0.05) { this.stuckT += w.step; if (this.stuckT > 0.6) this.down.add('m_jets'); } else this.stuckT = 0;
  }

  private mechCombat(dt: number): void {
    const w = this.app.session.w; const a = w.aegis!;
    this.boostT -= dt; this.lockT -= dt;
    const t = a.lock.primary;
    if (!t) return;
    if (!a.lock.hard && a.hardLockOnline && this.lockT <= 0) { this.down.add('m_lock'); this.lockT = 1; }
    if (a.lock.hard || !a.hardLockOnline) {
      if (!a.hardLockOnline) { const d = t.aimPoint().sub(w.camera.position); this.faceYaw(Math.atan2(-d.x, -d.z), 0.3); }
      this.down.add('m_rifle');
      if (a.cannonShells > 0) this.down.add('m_cannon');
      if (a.hasMissiles && a.missileCD <= 0) this.down.add('m_missiles');
      if (t.pos.distanceTo(a.frame.pos) < 40) this.down.add('m_blade');
    }
    // read telegraphs: sidestep with a quick boost just before they land (the designed counterplay)
    const boss = w.mechHostiles.find((m) => m.alive && (m as unknown as { telegraphLeft?: number | null }).telegraphLeft != null) as unknown as { telegraphLeft: number; telegraphKind: string } | undefined;
    if (boss && boss.telegraphLeft < 0.3 && this.boostT <= 0) { this.boostT = 0.8; this.strafeDir *= -1; this.move[0] = this.strafeDir; this.move[1] = 0; this.down.delete('m_boost'); this.tapBoost = true; }
    if (this.tapBoost) { this.tapT += dt; if (this.tapT < 0.05) this.down.add('m_boost'); else { this.tapBoost = false; this.tapT = 0; } }
    // dodge telegraphed attacks with quick boosts
    if (this.boostT <= 0 && w.rng.chance(dt * 0.6)) { this.boostT = 1.5; this.strafeDir *= -1; }
  }
}
