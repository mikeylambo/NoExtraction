import * as THREE from 'three';
import { ASCENT } from '../../data/aegis';
import { PALETTE } from '../../data/palette';
import { FEEL } from '../../data/feel';
import { glowSprite, glowTexture } from '../world/Materials';
import { buildWrenShip } from '../world/Ships';
import type { World } from '../game/World';
import type { InputFrame } from '../game/Input';

interface Hazard { p: THREE.Vector3; v: THREE.Vector3; r: number; mesh: THREE.Object3D; kind: 'debris' | 'flak'; t: number; warned: boolean; hit: boolean }

const PLANET_R = 60000;

/**
 * Ascent mode (GDD §4.9): booster climb with steering, debris and AA fire, scripted damage forcing
 * jettisons (weapon → shoulder → armor → booster stage), each a speed burst; then the atmosphere
 * break, the mix drop to silence, the drift, the planet breaking, and Wren's ship.
 * Altitude is real metres (y), the planet is a sphere below.
 */
export class Ascent {
  active = false;
  phase: 'climb' | 'silence' | 'drift' | 'done' = 'climb';
  progress = 0;
  hull: number = ASCENT.hull;
  private speed: number = ASCENT.baseClimb;
  private burst = 0;
  private hazards: Hazard[] = [];
  private spawnT = 1;
  private flakT = 4;
  private jettisoned = 0;
  readonly planet: THREE.Mesh;
  private chunks: THREE.Mesh[] = [];
  private core: THREE.Sprite;
  private booster: THREE.Group;
  private ship: ReturnType<typeof buildWrenShip>;
  private camPos = new THREE.Vector3();
  private t = 0;
  private driftT = 0;
  private clouds: THREE.Points;
  onJettison: (index: number, part: string) => void = () => {};
  onBreak: () => void = () => {};
  readonly planetU = { uTime: { value: 0 }, uCrack: { value: 0.6 }, uBreak: { value: 0 } };

  constructor(private readonly w: World) {
    const geo = new THREE.SphereGeometry(PLANET_R, 128, 64);
    this.planet = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      uniforms: this.planetU, fog: false,
      vertexShader: 'varying vec3 vN; varying vec3 vP; void main(){ vN = normalize(normalMatrix*normal); vP = position/60000.0; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: `uniform float uTime; uniform float uCrack; uniform float uBreak; varying vec3 vN; varying vec3 vP;
        float h(vec3 p){ return fract(sin(dot(p, vec3(127.1,311.7,74.7))) * 43758.5453); }
        float n(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z); }
        void main(){ float d = max(0.0, dot(vN, normalize(vec3(-0.4,0.6,0.5))));
          float ice = n(vP*6.0)*0.5 + n(vP*20.0)*0.25;
          vec3 col = mix(vec3(0.32,0.40,0.50), vec3(0.80,0.86,0.92), ice) * (0.03 + d*0.75);
          float cr = abs(n(vP*8.0) - 0.5); float crack = smoothstep(0.008 + 0.03*uBreak, 0.0, cr) * uCrack;
          col += vec3(0.78,0.66,1.0) * crack * (0.9 + uBreak * 2.4);
          col = mix(col, vec3(0.6,0.4,1.0), uBreak * 0.25 * crack);
          gl_FragColor = vec4(col, 1.0); }`,
    }));
    this.planet.position.set(0, -PLANET_R, 0);
    this.planet.visible = false;
    this.core = glowSprite(PALETTE.violet, PLANET_R * 0.9, 0);
    (this.core.material as THREE.SpriteMaterial).fog = false;
    this.core.position.copy(this.planet.position);
    this.booster = new THREE.Group();
    const bm = new THREE.MeshStandardMaterial({ color: 0x3a4048, metalness: 0.6, roughness: 0.4 });
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.6, 22, 12), bm); tube.position.y = -9; this.booster.add(tube);
    const flame = glowSprite(0xfff0d8, 26, 1); flame.position.y = -24; this.booster.add(flame);
    this.ship = buildWrenShip();
    this.ship.root.scale.setScalar(3);
    this.ship.root.visible = false;
    const n = 600; const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = ((i * 0.618) % 1 - 0.5) * 900; pos[i * 3 + 1] = ((i * 0.381) % 1) * 3000; pos[i * 3 + 2] = ((i * 0.7548) % 1 - 0.5) * 900; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.clouds = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xdfe8f0, size: 60, map: glowTexture(), transparent: true, opacity: 0.35, depthWrite: false, fog: false }));
    this.clouds.frustumCulled = false;
  }

  get altitude(): number { return this.w.aegis!.frame.pos.y; }

  start(fromProgress = 0, jettisoned = 0): void {
    const w = this.w, a = w.aegis!;
    this.active = true; this.phase = 'climb'; this.progress = fromProgress; this.jettisoned = jettisoned; this.hull = ASCENT.hull;
    a.frame.reset(new THREE.Vector3(0, fromProgress * ASCENT.targetAltitude, 0), 0);
    a.frame.locked = true;
    a.rig.root.add(this.booster);
    this.booster.visible = jettisoned < 4;
    for (let i = 0; i < jettisoned; i++) this.applyJettison(i, true);
    w.scene.add(this.planet, this.core, this.ship.root, this.clouds);
    this.planet.visible = true;
    w.atmo.snowScale = 0;
    w.audio.music('ascent');
    w.audio.sfx('ascent.roar', null, 1);
  }

  /** Steering input: stay out of the debris; bounded lateral plane. */
  update(dt: number, f: InputFrame): void {
    if (!this.active) return;
    const w = this.w, a = w.aegis!, fr = a.frame;
    this.t += dt;
    if (this.phase === 'climb') {
      const k = this.progress;
      // steering
      const lim = ASCENT.steerBounds;
      fr.pos.x = Math.max(-lim, Math.min(lim, fr.pos.x + f.moveX * ASCENT.steerSpeed * dt));
      fr.pos.z = Math.max(-lim, Math.min(lim, fr.pos.z - f.moveZ * ASCENT.steerSpeed * dt));
      this.burst = Math.max(0, this.burst - this.burst * ASCENT.burstDecay * dt);
      this.speed = ASCENT.baseClimb * (0.55 + 0.45 * Math.min(1, this.t / 6)) + this.burst;
      fr.pos.y += this.speed * dt;
      this.progress = Math.min(1, fr.pos.y / ASCENT.targetAltitude);
      // atmosphere: the sky darkens with altitude; the core value runs 2% → 0%
      const core = Math.max(0, 2 - k * 2);
      w.atmo.setCore(core); w.state.coreStability = Math.round(core * 10) / 10;
      w.atmo.darkness = Math.min(0.95, k * 1.1);
      (this.clouds.material as THREE.PointsMaterial).opacity = Math.max(0, 0.35 * (1 - k * 3));
      this.clouds.position.set(0, fr.pos.y - ((this.t * this.speed) % 3000), 0);
      if (Math.floor(this.t * 3) !== Math.floor((this.t - dt) * 3)) { w.addShake(0.08 * (1 - k)); }
      this.spawnHazards(dt, k);
      // scripted damage forces each jettison
      const next = ASCENT.jettisons[this.jettisoned];
      if (next && k >= next.at) this.scriptedHit();
      if (k >= 1) this.atmosphereBreak();
    }
    this.updateHazards(dt);
    if (this.phase === 'drift' || this.phase === 'done') this.updateDrift(dt);
    this.planetU.uTime.value = this.t;
  }

  private spawnHazards(dt: number, k: number): void {
    const w = this.w, fr = w.aegis!.frame;
    this.spawnT -= dt; this.flakT -= dt;
    if (this.spawnT <= 0 && k < 0.95) {
      this.spawnT = 0.9 - k * 0.4 + w.rng.next() * 0.5;
      const mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(4 + w.rng.next() * 6), new THREE.MeshStandardMaterial({ color: 0x6a5f72, roughness: 0.9, emissive: PALETTE.violetDeep, emissiveIntensity: 0.15 }));
      const p = new THREE.Vector3((w.rng.next() - 0.5) * ASCENT.steerBounds * 2.4, fr.pos.y + 1400 + w.rng.next() * 600, (w.rng.next() - 0.5) * ASCENT.steerBounds * 2.4);
      mesh.position.copy(p); w.scene.add(mesh);
      this.hazards.push({ p, v: new THREE.Vector3(0, -260 - w.rng.next() * 200, 0), r: 10, mesh, kind: 'debris', t: 0, warned: false, hit: false });
    }
    if (this.flakT <= 0 && k < 0.5) {
      // Sable AA from the yard: telegraphed by a red tracer line and a ground marker, then the burst
      this.flakT = 2.5 + w.rng.next() * 2;
      const at = new THREE.Vector3(fr.pos.x + (w.rng.next() - 0.5) * 50, fr.pos.y + this.speed * 1.2, fr.pos.z + (w.rng.next() - 0.5) * 50);
      const mesh = glowSprite(PALETTE.red, 30, 0.9);
      mesh.position.copy(at); w.scene.add(mesh);
      this.hazards.push({ p: at, v: new THREE.Vector3(), r: 22, mesh, kind: 'flak', t: 0, warned: false, hit: false });
      w.fx.tracer(at.clone().setY(at.y - 3000), at, PALETTE.red, 1.2);
    }
  }

  private updateHazards(dt: number): void {
    const w = this.w, fr = w.aegis!.frame;
    for (const h of this.hazards) {
      h.t += dt;
      h.p.addScaledVector(h.v, dt); h.mesh.position.copy(h.p); h.mesh.rotation.x += dt; h.mesh.rotation.y += dt * 0.7;
      if (h.kind === 'flak') {
        const s = h.mesh as THREE.Sprite; s.material.opacity = h.t < 1.2 ? 0.4 + 0.5 * Math.abs(Math.sin(h.t * 12)) : 0;
        if (!h.hit && h.t >= 1.2) { h.hit = true; w.fx.explosion(h.p, 3, 0xff8060); if (Math.hypot(h.p.x - fr.pos.x, h.p.y - fr.pos.y, h.p.z - fr.pos.z) < h.r) this.damage(ASCENT.aaDamage * 3); }
      } else if (!h.hit && this.phase === 'climb' && Math.hypot(h.p.x - fr.pos.x, h.p.y - (fr.pos.y + 5), h.p.z - fr.pos.z) < h.r + 4) {
        h.hit = true; this.damage(ASCENT.debrisDamage * 2); w.fx.explosion(h.p, 1.5, PALETTE.violet); w.audio.sfx('ascent.debris', null, 1);
      }
    }
    this.hazards = this.hazards.filter((h) => { const keep = h.p.y > fr.pos.y - 300 && h.t < 8; if (!keep) w.scene.remove(h.mesh); return keep; });
  }

  private damage(amount: number): void {
    if (this.w.dev.god) return;
    this.hull = Math.max(0, this.hull - amount * this.w.difficulty.enemyDamage);
    this.w.addShake(FEEL.shake.mechHit);
    this.w.hud.hurt(null, this.w.aegis!.frame.pos, 0);
    if (this.hull <= 0) { this.w.aegis!.armor = 0; this.w.counters.deaths++; }
  }

  /** Authored: a hit lands regardless, the frame dumps mass. */
  private scriptedHit(): void {
    const w = this.w;
    const i = this.jettisoned;
    w.addShake(FEEL.shake.jettison);
    w.fx.explosion(w.aegis!.frame.pos.clone().setY(w.aegis!.frame.pos.y + 8), 2, 0xffa060);
    if (i === 0) w.dialogue.say('c6.aegis.damage');
    this.applyJettison(i, false);
    this.jettisoned++;
    this.burst += ASCENT.jettisonBurst;
    this.onJettison(i, ASCENT.jettisons[i]!.part);
  }

  private applyJettison(i: number, silent: boolean): void {
    const w = this.w, r = w.aegis!.rig;
    const part = ASCENT.jettisons[i]!.part;
    const drop = (o: THREE.Object3D) => {
      if (!o.visible) return;
      o.visible = false;
      if (silent) return;
      const ghost = o.clone(); const wp = new THREE.Vector3(); o.getWorldPosition(wp); ghost.position.copy(wp); ghost.visible = true;
      ghost.scale.setScalar(1);
      w.scene.add(ghost);
      let v = -40; const id = `jet-${i}-${o.id}`;
      w.onStep(id, (dt) => { v -= 60 * dt; ghost.position.y += v * dt; ghost.rotation.x += dt * 2; if (ghost.position.y < w.aegis!.frame.pos.y - 800) { w.scene.remove(ghost); w.offStep(id); } });
    };
    if (part === 'weapons') { drop(r.weaponR); drop(r.weaponL); w.aegis!.loseSystem('weapons'); }
    if (part === 'shoulders') { drop(r.shoulderWeaponL); drop(r.shoulderWeaponR); w.aegis!.loseSystem('shoulders'); }
    if (part === 'armor') { for (const m of r.meshes) if (m.material === r.mats.armor && Math.abs(m.position.x) > 0.6) drop(m); w.aegis!.loseSystem('armor'); }
    if (part === 'booster') { drop(this.booster); w.aegis!.loseSystem('booster'); }
    if (!silent) w.audio.sfx('ascent.jettison', null, 1);
  }

  /** Atmosphere break: the mix drops to −60 dB over 0.4 s; only breathing and the reactor tick remain. */
  private atmosphereBreak(): void {
    if (this.phase !== 'climb') return;
    this.phase = 'silence';
    const w = this.w;
    w.audio.mix('silence');
    w.atmo.setCore(0); w.atmo.darkness = 1; w.state.coreStability = 0;
    for (const h of this.hazards) w.scene.remove(h.mesh);
    this.hazards = [];
    this.clouds.visible = false;
    this.speed = 0;
    w.state.set('ascent.broken');
    this.onBreak();
    this.phase = 'drift';
  }

  private updateDrift(dt: number): void {
    const w = this.w, fr = w.aegis!.frame;
    this.driftT += dt;
    fr.pos.y += Math.max(0, 40 - this.driftT * 4) * dt;
    // the reactor tick and breathing are all that's left
    if (Math.floor(this.driftT / 1.6) !== Math.floor((this.driftT - dt) / 1.6)) w.audio.sfx('reactor.tick', null, 0.5);
    if (Math.floor(this.driftT / 5.5) !== Math.floor((this.driftT - dt) / 5.5)) w.audio.sfx('cockpit.breath', null, 0.6);
  }

  /** The planet breaks (driven by the end sequence). */
  breakPlanet(amount: number): void {
    this.planetU.uBreak.value = amount; this.planetU.uCrack.value = 0.6 + amount * 1.4;
    (this.core.material as THREE.SpriteMaterial).opacity = Math.min(0.9, amount * 0.8);
    if (amount > 0.4 && this.chunks.length === 0) {
      for (let i = 0; i < 7; i++) {
        const m = new THREE.Mesh(new THREE.DodecahedronGeometry(PLANET_R * (0.08 + (i % 3) * 0.04)), new THREE.MeshStandardMaterial({ color: 0x8090a0, emissive: PALETTE.violetDeep, emissiveIntensity: 0.6, roughness: 0.8 }));
        const a = (i / 7) * Math.PI * 2; m.userData.dir = new THREE.Vector3(Math.cos(a), 0.3 + (i % 2) * 0.4, Math.sin(a)).normalize();
        m.position.copy(this.planet.position).addScaledVector(m.userData.dir, PLANET_R * 0.85);
        this.w.scene.add(m); this.chunks.push(m);
      }
    }
    for (const c of this.chunks) c.position.copy(this.planet.position).addScaledVector(c.userData.dir as THREE.Vector3, PLANET_R * (0.85 + (amount - 0.4) * 0.5));
    this.w.atmo.breakAmount = amount;
  }

  /** Wren's ship rounds the planet and comes to him. k 0..1. */
  shipApproach(k: number): void {
    const fr = this.w.aegis!.frame;
    this.ship.root.visible = k > 0;
    const from = new THREE.Vector3(fr.pos.x - 2600, fr.pos.y - 900, fr.pos.z - 4200);
    const to = new THREE.Vector3(fr.pos.x - 60, fr.pos.y + 10, fr.pos.z - 140);
    const e = 1 - Math.pow(1 - k, 3);
    this.ship.root.position.lerpVectors(from, to, e);
    this.ship.root.lookAt(fr.pos);
    for (const l of this.ship.lights) l.visible = Math.sin(this.t * 4 + l.position.x) > -0.2;
  }

  /** Camera: behind and below during the climb (the planet falling away), wide in the drift. */
  camera(cam: THREE.PerspectiveCamera, dt: number, look: 'climb' | 'planet' | 'ship' | 'cockpit'): void {
    const fr = this.w.aegis!.frame;
    let want: THREE.Vector3, target: THREE.Vector3, fov = 70;
    if (look === 'climb' || this.phase === 'climb') { want = fr.pos.clone().add(new THREE.Vector3(0, -24, 38)); target = fr.pos.clone().add(new THREE.Vector3(0, 30, 0)); fov = 72 + Math.min(14, this.burst / 80); }
    else if (look === 'planet') { want = fr.pos.clone().add(new THREE.Vector3(14, 22, 30)); target = this.planet.position.clone().add(new THREE.Vector3(0, PLANET_R * 0.7, 0)); fov = 50; }
    else if (look === 'ship') { want = fr.pos.clone().add(new THREE.Vector3(18, 6, 30)); target = this.ship.root.position.clone(); fov = 46; }
    else { want = fr.pos.clone().add(new THREE.Vector3(0, 9.2, 1.2)); target = fr.pos.clone().add(new THREE.Vector3(0, 9, -40)); fov = 60; }
    if (this.camPos.lengthSq() === 0) this.camPos.copy(want);
    this.camPos.lerp(want, 1 - Math.exp(-3 * dt));
    const s = this.w.shake.update(dt);
    cam.position.copy(this.camPos).add(new THREE.Vector3(s.x, s.y, s.z));
    cam.lookAt(target);
    cam.fov += (fov - cam.fov) * (1 - Math.exp(-3 * dt)); cam.far = 400000; cam.updateProjectionMatrix();
  }

  /** Bot steering: move away from the nearest incoming hazard in the lateral plane. */
  botSteer(): [number, number] {
    const fr = this.w.aegis!.frame;
    let best: Hazard | null = null, bd = Infinity;
    for (const h of this.hazards) { const dy = h.p.y - fr.pos.y; if (dy < -10 || dy > 900) continue; const d = Math.hypot(h.p.x - fr.pos.x, h.p.z - fr.pos.z); if (d < h.r + 14 && dy < bd) { bd = dy; best = h; } }
    if (!best) return [-fr.pos.x * 0.02, fr.pos.z * 0.02];
    const ax = fr.pos.x - best.p.x, az = fr.pos.z - best.p.z; const l = Math.hypot(ax, az) || 1;
    return [ax / l, -az / l];
  }

  dispose(): void {
    const w = this.w;
    for (const h of this.hazards) w.scene.remove(h.mesh);
    for (const c of this.chunks) w.scene.remove(c);
    w.scene.remove(this.planet, this.core, this.ship.root, this.clouds);
  }
}
