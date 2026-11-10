import * as THREE from 'three';
import { lookFor, type WorldLook } from '../../data/core';
import { WORLD_UNIFORMS } from './Materials';
import { PALETTE } from '../../data/palette';
import { Sky, Snowfall, BlowingSnow, MOON_DIR, MOON_COLOR } from '../render/atmosphere';
import { tierSettings } from '../render/quality';

/**
 * Sky, aurora, stars, snow, moonlight, fog, and the Core Stability → world look mapping.
 * Sky, snowfall, blowing snow and height fog are the shared lookdev pieces (src/render); this class
 * drives them from the chapter's WorldLook.
 */
export class Atmosphere {
  readonly group = new THREE.Group();
  readonly sky: Sky;
  readonly sun = new THREE.DirectionalLight(MOON_COLOR, 1.0);
  readonly hemi = new THREE.HemisphereLight(0x3a4c6a, 0x1a1f26, 0.6);
  readonly fog: THREE.FogExp2;
  private readonly snow: Snowfall;
  private readonly drift: BlowingSnow;
  look: WorldLook;
  core = 72;
  flare = 0;
  breakAmount = 0;
  /** Override (darker interiors etc.). */
  darkness = 0;
  private time = 0;
  private streaks: THREE.LineSegments;
  private streakData: { p: THREE.Vector3; v: THREE.Vector3; life: number }[] = [];

  constructor(private readonly scene: THREE.Scene) {
    this.look = lookFor(72);
    this.sky = new Sky(this.group, 5000);
    this.sky.u.uCoreColor.value.setHex(PALETTE.violetDeep);

    const q = tierSettings();
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(q.shadowMap, q.shadowMap);
    const sc = this.sun.shadow.camera; sc.left = -60; sc.right = 60; sc.top = 60; sc.bottom = -60; sc.near = 1; sc.far = 400;
    this.sun.shadow.bias = -0.0003; this.sun.shadow.normalBias = 0.04; this.sun.shadow.radius = 2;
    this.group.add(this.sun, this.sun.target, this.hemi);

    const px = (typeof innerHeight === 'number' ? innerHeight : 720) * Math.min(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, q.maxPixelRatio);
    this.snow = new Snowfall(this.group, px, q.post === 'high' ? 1 : 0.6);
    this.drift = new BlowingSnow(this.group, () => 0, 50, q.post === 'high' ? 36 : 18);

    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(24 * 6), 3));
    this.streaks = new THREE.LineSegments(sg, new THREE.LineBasicMaterial({ color: 0xffe9d0, transparent: true, opacity: 0.85, fog: false, blending: THREE.AdditiveBlending }));
    this.streaks.frustumCulled = false;
    this.group.add(this.streaks);

    this.fog = new THREE.FogExp2(0x1a2a3c, 0.007);
    scene.fog = this.fog;
    scene.add(this.group);
    this.setCore(72);
  }

  setCore(pct: number): void {
    this.core = pct;
    this.look = lookFor(pct);
    WORLD_UNIFORMS.uCoreGlow.value = this.look.coreGlow;
  }

  /** Scale for snow density (interiors set 0). */
  snowScale = 1;
  /** Shadow follow scale (mech chapters use a wider frustum). */
  setShadowSize(half: number): void {
    const sc = this.sun.shadow.camera; sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half; sc.far = half * 8; sc.updateProjectionMatrix();
  }

  update(dt: number, camPos: THREE.Vector3, focus: THREE.Vector3): void {
    this.time += dt;
    const L = this.look; const dark = this.darkness;
    WORLD_UNIFORMS.uTime.value = this.time;
    this.flare = Math.max(0, this.flare - dt * 0.35);
    const u = this.sky.u;
    const skyK = 1 - dark * 0.8;
    u.uHorizon.value.setHex(L.fog).multiplyScalar(1.05 * skyK);
    u.uMid.value.setHex(L.sky[1]).multiplyScalar(0.75 * skyK);
    u.uZenith.value.setHex(L.sky[0]).multiplyScalar(0.6 * skyK);
    u.uAurora.value = L.aurora * (1 - dark) * 1.1;
    u.uFlicker.value = L.flicker;
    u.uFlare.value = this.flare;
    u.uCore.value = L.coreGlow * 0.5 + (this.core < 30 ? 0.25 : 0);
    u.uBreak.value = this.breakAmount;
    u.uStars.value = (1 - L.snow * 0.8) * (1 - dark);
    u.uMoonVis.value = (1 - Math.min(1, L.snow)) * 0.8 * (1 - dark) + 0.2 * (1 - dark);
    this.sky.update(this.time, { position: camPos } as THREE.Camera);
    // exponential height fog: density chosen so the authored far distance is ~90% fogged
    this.fog.color.setHex(L.fog).multiplyScalar(1 - dark * 0.7);
    this.fog.density = 2.3 / Math.max(10, L.fogFar * (1 - dark * 0.4));
    this.sun.intensity = (L.sun * 1.15 + this.flare * 0.8) * (1 - dark * 0.92);
    this.hemi.intensity = (L.ambient * 1.4 + 0.2 + this.flare * 0.4) * (1 - dark * 0.75);
    this.sun.position.copy(focus).addScaledVector(MOON_DIR, 140);
    this.sun.target.position.copy(focus);
    // snowfall + ground drift
    const amt = L.snow * this.snowScale;
    const windDir = 1.6 + L.wind * 7;
    this.snow.set(Math.min(1.4, 0.25 + amt * 1.2) * (amt > 0.02 ? 1 : 0), windDir, windDir * 0.3);
    this.snow.update(this.time, { position: camPos } as THREE.Camera);
    this.drift.follow(focus, focus.y);
    this.drift.update(this.time, Math.min(1.5, L.wind * 1.4 + amt * 0.5) * this.snowScale * (1 - dark));

    // orbital debris streaks
    if (L.debrisStreaks > 0 && this.streakData.length < 24 && Math.random() < dt * L.debrisStreaks * 1.2) {
      const a = Math.random() * Math.PI * 2;
      const p = camPos.clone().add(new THREE.Vector3(Math.cos(a) * 1500, 900 + Math.random() * 600, Math.sin(a) * 1500));
      const v = new THREE.Vector3(-Math.cos(a) * 400 + (Math.random() - 0.5) * 300, -500 - Math.random() * 300, -Math.sin(a) * 400);
      this.streakData.push({ p, v, life: 2.5 });
    }
    const arr = (this.streaks.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
    arr.fill(0);
    this.streakData = this.streakData.filter((s) => (s.life -= dt) > 0);
    this.streakData.forEach((s, i) => {
      s.p.addScaledVector(s.v, dt);
      const t = s.p.clone().addScaledVector(s.v, -0.18);
      arr.set([s.p.x, s.p.y, s.p.z, t.x, t.y, t.z], i * 6);
    });
    (this.streaks.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }

  dispose(): void { this.scene.remove(this.group); this.scene.fog = null; }
}
