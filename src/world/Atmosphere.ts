import * as THREE from 'three';
import { lookFor, type WorldLook } from '../../data/core';
import { WORLD_UNIFORMS } from './Materials';
import { PALETTE } from '../../data/palette';

const SKY_VERT = /* glsl */`varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`;
const SKY_FRAG = /* glsl */`
uniform vec3 uTop; uniform vec3 uBottom; uniform float uAurora; uniform float uTime; uniform float uFlicker; uniform float uFlare; uniform float uCore; uniform vec3 uCoreColor; uniform float uStars; uniform float uBreak;
varying vec3 vDir;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float a=0.5, s=0.0; for(int i=0;i<4;i++){ s+=a*n(p); p*=2.03; a*=0.5; } return s; }
void main(){
  vec3 d = normalize(vDir);
  float up = clamp(d.y, -0.2, 1.0);
  vec3 col = mix(uBottom, uTop, smoothstep(-0.05, 0.6, up));
  // stars
  vec2 sp = d.xz / max(0.15, d.y + 0.3) * 160.0;
  float st = step(0.9965, h(floor(sp))) * smoothstep(0.05, 0.4, d.y) * uStars;
  col += vec3(st) * (0.6 + 0.4 * sin(uTime * 3.0 + h(floor(sp)) * 40.0));
  // aurora curtains
  float az = atan(d.x, d.z);
  float band = fbm(vec2(az * 3.0 + uTime * 0.03, d.y * 3.0 - uTime * 0.05));
  float curtain = smoothstep(0.15, 0.55, d.y) * smoothstep(0.85, 0.35, d.y) * smoothstep(0.45, 0.8, band);
  float ripple = 0.6 + 0.4 * sin(az * 22.0 + uTime * 0.6 + band * 6.0);
  vec3 aur = mix(vec3(0.25, 0.9, 0.6), vec3(0.75, 0.6, 1.0), smoothstep(0.3, 0.75, d.y));
  col += aur * curtain * ripple * uAurora * (0.55 + uFlare * 2.5);
  // failing core: violet horizon glow + flicker
  float horizon = exp(-pow(d.y * 6.0, 2.0));
  float flick = 1.0 + uFlicker * 0.5 * (n(vec2(uTime * 7.0, 1.0)) - 0.5);
  col += uCoreColor * horizon * uCore * 0.9 * flick;
  // planet break: crack light from below
  col += uCoreColor * uBreak * smoothstep(0.0, -0.4, d.y) * (0.6 + 0.4 * fbm(d.xz * 8.0 + uTime * 0.2));
  col += vec3(uFlare * 0.25);
  gl_FragColor = vec4(col, 1.0);
}`;

const SNOW_VERT = /* glsl */`
attribute float aSeed; uniform float uTime; uniform vec3 uCenter; uniform float uWind; uniform float uSize; uniform float uBox;
varying float vA;
void main(){
  vec3 p = position;
  float t = uTime * (0.6 + aSeed * 0.8);
  p.y = mod(p.y - t * 2.2, uBox) - uBox * 0.5;
  p.x = mod(p.x + t * uWind * 6.0 + sin(t + aSeed * 30.0) * 0.6, uBox) - uBox * 0.5;
  p.z = mod(p.z + sin(t * 0.7 + aSeed * 11.0) * 0.5, uBox) - uBox * 0.5;
  vec4 mv = modelViewMatrix * vec4(p + uCenter, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * (0.5 + aSeed) * (40.0 / -mv.z);
  vA = smoothstep(uBox * 0.5, uBox * 0.2, length(p.xz));
}`;
const SNOW_FRAG = /* glsl */`varying float vA; uniform float uOpacity; void main(){ vec2 c = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.15, length(c)); gl_FragColor = vec4(vec3(0.93,0.96,1.0), a * vA * uOpacity); }`;

/** Sky, aurora, stars, snow, moonlight, fog, and the Core Stability → world look mapping. */
export class Atmosphere {
  readonly group = new THREE.Group();
  readonly sky: THREE.Mesh;
  readonly sun = new THREE.DirectionalLight(0xc8d8ff, 1.2);
  readonly hemi = new THREE.HemisphereLight(0x8fa8c8, 0x1a2230, 0.6);
  readonly fog: THREE.Fog;
  private snow: THREE.Points;
  private skyU: Record<string, THREE.IUniform>;
  private snowU: Record<string, THREE.IUniform>;
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
    this.skyU = {
      uTop: { value: new THREE.Color() }, uBottom: { value: new THREE.Color() }, uAurora: { value: 0 }, uTime: { value: 0 }, uFlicker: { value: 0 },
      uFlare: { value: 0 }, uCore: { value: 0 }, uCoreColor: { value: new THREE.Color(PALETTE.violetDeep) }, uStars: { value: 1 }, uBreak: { value: 0 },
    };
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(5000, 32, 16), new THREE.ShaderMaterial({ uniforms: this.skyU, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false, fog: false }));
    this.sky.renderOrder = -10;
    this.sky.frustumCulled = false;
    this.group.add(this.sky);

    this.sun.position.set(-60, 120, 40);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera; sc.left = -60; sc.right = 60; sc.top = 60; sc.bottom = -60; sc.near = 1; sc.far = 400;
    this.sun.shadow.bias = -0.0006; this.sun.shadow.normalBias = 0.04;
    this.group.add(this.sun, this.sun.target, this.hemi);

    const N = 3500;
    const pos = new Float32Array(N * 3), seed = new Float32Array(N);
    for (let i = 0; i < N; i++) { const a = (i * 0.618034) % 1, b = (i * 0.754877) % 1, c = (i * 0.569840) % 1; pos[i * 3] = (a - 0.5) * 40; pos[i * 3 + 1] = (b - 0.5) * 40; pos[i * 3 + 2] = (c - 0.5) * 40; seed[i] = ((i * 0.3819) % 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    this.snowU = { uTime: { value: 0 }, uCenter: { value: new THREE.Vector3() }, uWind: { value: 0.2 }, uSize: { value: 2.2 }, uBox: { value: 40 }, uOpacity: { value: 0.8 } };
    this.snow = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: this.snowU, vertexShader: SNOW_VERT, fragmentShader: SNOW_FRAG, transparent: true, depthWrite: false }));
    this.snow.frustumCulled = false;
    this.group.add(this.snow);

    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(24 * 6), 3));
    this.streaks = new THREE.LineSegments(sg, new THREE.LineBasicMaterial({ color: 0xffe9d0, transparent: true, opacity: 0.85, fog: false, blending: THREE.AdditiveBlending }));
    this.streaks.frustumCulled = false;
    this.group.add(this.streaks);

    this.fog = new THREE.Fog(0x1a2a3c, 60, 340);
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
    const u = this.skyU;
    (u.uTop!.value as THREE.Color).setHex(L.sky[1]).multiplyScalar(1 - dark * 0.8);
    (u.uBottom!.value as THREE.Color).setHex(L.sky[0]).multiplyScalar(1 - dark * 0.8);
    u.uAurora!.value = L.aurora * (1 - dark);
    u.uTime!.value = this.time;
    u.uFlicker!.value = L.flicker;
    u.uFlare!.value = this.flare;
    u.uCore!.value = L.coreGlow * 0.6 + (this.core < 30 ? 0.3 : 0);
    u.uBreak!.value = this.breakAmount;
    u.uStars!.value = 1 - L.snow * 0.8;
    this.fog.color.setHex(L.fog).multiplyScalar(1 - dark * 0.7);
    this.fog.near = L.fogNear; this.fog.far = L.fogFar * (1 - dark * 0.4);
    this.sun.intensity = (L.sun * 1.25 + this.flare * 0.8) * (1 - dark * 0.92);
    this.hemi.intensity = (L.ambient * 0.9 + this.flare * 0.4) * (1 - dark * 0.75);
    this.sun.position.copy(focus).add(new THREE.Vector3(-50, 110, 35));
    this.sun.target.position.copy(focus);
    this.sky.position.copy(camPos);
    this.snowU.uTime!.value = this.time;
    (this.snowU.uCenter!.value as THREE.Vector3).copy(camPos);
    this.snowU.uWind!.value = L.wind;
    this.snowU.uOpacity!.value = Math.min(1, L.snow * 1.2) * this.snowScale;
    this.snow.visible = L.snow * this.snowScale > 0.02;
    this.snow.geometry.setDrawRange(0, Math.floor(3500 * Math.min(1, 0.25 + L.snow)));

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
