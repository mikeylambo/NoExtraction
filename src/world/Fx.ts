import * as THREE from 'three';
import { glowTexture } from './Materials';

const P_VERT = /* glsl */`
attribute vec4 aColor; attribute float aSize;
varying vec4 vColor;
void main(){ vColor = aColor; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = aSize * (300.0 / max(0.5, -mv.z)); }`;
const P_FRAG = /* glsl */`uniform sampler2D uMap; varying vec4 vColor; void main(){ vec4 t = texture2D(uMap, gl_PointCoord); gl_FragColor = vec4(vColor.rgb, vColor.a * t.a); }`;

interface Particle { alive: boolean; p: THREE.Vector3; v: THREE.Vector3; life: number; max: number; size: number; grow: number; r: number; g: number; b: number; a: number; drag: number; grav: number }

/** Particle cap per GDD §17 (4,000 total, snow excluded since it is a fixed field). */
export const PARTICLE_CAP = 2600;

/**
 * Pooled presentation effects: particles (one draw call each for additive/alpha), tracers, flashes
 * and ground markers. Purely cosmetic — nothing here affects the simulation.
 */
export class Fx {
  readonly group = new THREE.Group();
  private add: { pts: THREE.Points; data: Particle[]; pos: Float32Array; col: Float32Array; size: Float32Array };
  private alpha: { pts: THREE.Points; data: Particle[]; pos: Float32Array; col: Float32Array; size: Float32Array };
  private tracers: THREE.LineSegments;
  private tracerData: { a: THREE.Vector3; b: THREE.Vector3; life: number; max: number; color: THREE.Color }[] = [];
  private flashes: { s: THREE.Sprite; life: number; max: number; size: number }[] = [];
  private markers: { m: THREE.Mesh; life: number; max: number; pulse: boolean }[] = [];
  private markerPool: THREE.Mesh[] = [];
  /** Accessibility: scales bright flashes. */
  flashScale = 1;
  activeParticles = 0;

  constructor(scene: THREE.Scene) {
    this.add = this.makeSystem(THREE.AdditiveBlending, Math.floor(PARTICLE_CAP * 0.6));
    this.alpha = this.makeSystem(THREE.NormalBlending, Math.floor(PARTICLE_CAP * 0.4));
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(160 * 6), 3));
    tg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(160 * 6), 3));
    this.tracers = new THREE.LineSegments(tg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.tracers.frustumCulled = false;
    this.group.add(this.tracers);
    scene.add(this.group);
  }

  private makeSystem(blending: THREE.Blending, n: number) {
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 4), size = new Float32Array(n);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(col, 4));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    const pts = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: { uMap: { value: glowTexture() } }, vertexShader: P_VERT, fragmentShader: P_FRAG, transparent: true, depthWrite: false, blending }));
    pts.frustumCulled = false;
    this.group.add(pts);
    const data: Particle[] = [];
    for (let i = 0; i < n; i++) data.push({ alive: false, p: new THREE.Vector3(), v: new THREE.Vector3(), life: 0, max: 1, size: 1, grow: 0, r: 1, g: 1, b: 1, a: 1, drag: 0, grav: 0 });
    return { pts, data, pos, col, size };
  }

  /** Emit `count` particles. */
  burst(at: THREE.Vector3, o: { count?: number; speed?: number; spread?: number; up?: number; life?: number; size?: number; grow?: number; color?: number; alpha?: number; drag?: number; gravity?: number; additive?: boolean; dir?: THREE.Vector3 } = {}): void {
    const sys = o.additive === false ? this.alpha : this.add;
    const c = new THREE.Color(o.color ?? 0xffffff);
    let n = o.count ?? 12;
    for (const pt of sys.data) {
      if (n <= 0) break;
      if (pt.alive) continue;
      n--;
      pt.alive = true;
      pt.p.copy(at);
      const sp = (o.speed ?? 4) * (0.4 + Math.random() * 0.6);
      const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5 + (o.up ?? 0.3), Math.random() - 0.5).normalize();
      if (o.dir) dir.lerp(o.dir, 1 - (o.spread ?? 1)).normalize();
      pt.v.copy(dir).multiplyScalar(sp);
      pt.max = pt.life = (o.life ?? 0.6) * (0.6 + Math.random() * 0.6);
      pt.size = (o.size ?? 0.3) * (0.7 + Math.random() * 0.6);
      pt.grow = o.grow ?? 0;
      pt.r = c.r; pt.g = c.g; pt.b = c.b; pt.a = o.alpha ?? 1;
      pt.drag = o.drag ?? 1.5; pt.grav = o.gravity ?? 0;
    }
  }

  tracer(a: THREE.Vector3, b: THREE.Vector3, color: number, life = 0.07): void {
    if (this.tracerData.length >= 160) this.tracerData.shift();
    this.tracerData.push({ a: a.clone(), b: b.clone(), life, max: life, color: new THREE.Color(color) });
  }

  flash(at: THREE.Vector3, color: number, size = 1.5, life = 0.06): void {
    let f = this.flashes.find((x) => x.life <= 0);
    if (!f) {
      if (this.flashes.length > 48) return;
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      this.group.add(s);
      f = { s, life: 0, max: 0, size };
    }
    f.s.visible = true; f.s.position.copy(at); (f.s.material as THREE.SpriteMaterial).color.setHex(color);
    f.life = f.max = life; f.size = size * Math.max(0.3, this.flashScale);
    f.s.scale.setScalar(f.size);
  }

  /** Ground ring marker (debris impact zone, alarm pulse, objective). */
  marker(at: THREE.Vector3, radius: number, color: number, life: number, pulse = true): THREE.Mesh {
    let m = this.markerPool.pop();
    if (!m) {
      m = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 48), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
      m.rotation.x = -Math.PI / 2;
      this.group.add(m);
    }
    m.visible = true;
    m.position.copy(at).setY(at.y + 0.06);
    m.scale.setScalar(radius);
    (m.material as THREE.MeshBasicMaterial).color.setHex(color);
    this.markers.push({ m, life, max: life, pulse });
    return m;
  }

  explosion(at: THREE.Vector3, scale = 1, color = 0xffa040): void {
    this.flash(at, color, 6 * scale, 0.18);
    this.burst(at, { count: Math.round(40 * scale), speed: 12 * scale, life: 0.7, size: 0.9 * scale, color, drag: 2.5, up: 0.4 });
    this.burst(at, { count: Math.round(26 * scale), speed: 4 * scale, life: 1.8, size: 2.2 * scale, grow: 1.4 * scale, color: 0x3a3e44, alpha: 0.55, additive: false, drag: 1, up: 0.8 });
  }

  snowPuff(at: THREE.Vector3, scale = 1): void {
    this.burst(at, { count: Math.round(10 * scale), speed: 2.2 * scale, life: 0.8, size: 0.45 * scale, grow: 0.6 * scale, color: 0xe8eef3, alpha: 0.55, additive: false, up: 0.6, drag: 2 });
  }

  update(dt: number): void {
    let active = 0;
    for (const sys of [this.add, this.alpha]) {
      const { data, pos, col, size } = sys;
      for (let i = 0; i < data.length; i++) {
        const pt = data[i]!;
        if (pt.alive) {
          pt.life -= dt;
          if (pt.life <= 0) pt.alive = false;
          else {
            active++;
            pt.v.multiplyScalar(Math.exp(-pt.drag * dt));
            pt.v.y -= pt.grav * dt;
            pt.p.addScaledVector(pt.v, dt);
            pt.size += pt.grow * dt;
          }
        }
        const k = pt.alive ? pt.life / pt.max : 0;
        pos[i * 3] = pt.p.x; pos[i * 3 + 1] = pt.p.y; pos[i * 3 + 2] = pt.p.z;
        col[i * 4] = pt.r; col[i * 4 + 1] = pt.g; col[i * 4 + 2] = pt.b; col[i * 4 + 3] = pt.alive ? pt.a * Math.min(1, k * 2) : 0;
        size[i] = pt.alive ? pt.size : 0;
      }
      const g = sys.pts.geometry;
      (g.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (g.attributes.aColor as THREE.BufferAttribute).needsUpdate = true;
      (g.attributes.aSize as THREE.BufferAttribute).needsUpdate = true;
    }
    this.activeParticles = active;

    const tp = (this.tracers.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
    const tc = (this.tracers.geometry.attributes.color as THREE.BufferAttribute).array as Float32Array;
    tp.fill(0); tc.fill(0);
    this.tracerData = this.tracerData.filter((t) => (t.life -= dt) > 0);
    this.tracerData.forEach((t, i) => {
      const k = t.life / t.max;
      tp.set([t.a.x, t.a.y, t.a.z, t.b.x, t.b.y, t.b.z], i * 6);
      tc.set([t.color.r * k, t.color.g * k, t.color.b * k, t.color.r * k * 0.3, t.color.g * k * 0.3, t.color.b * k * 0.3], i * 6);
    });
    (this.tracers.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.tracers.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;

    for (const f of this.flashes) {
      if (f.life <= 0) continue;
      f.life -= dt;
      const k = Math.max(0, f.life / f.max);
      f.s.scale.setScalar(f.size * (0.6 + 0.4 * k));
      (f.s.material as THREE.SpriteMaterial).opacity = k * Math.max(0.2, this.flashScale);
      if (f.life <= 0) f.s.visible = false;
    }
    this.markers = this.markers.filter((mk) => {
      mk.life -= dt;
      const k = mk.life / mk.max;
      const mat = mk.m.material as THREE.MeshBasicMaterial;
      mat.opacity = mk.pulse ? (0.4 + 0.6 * Math.abs(Math.sin(mk.life * 9))) * Math.min(1, k * 3) : Math.min(1, k * 3);
      if (mk.life <= 0) { mk.m.visible = false; this.markerPool.push(mk.m); return false; }
      return true;
    });
  }

  clear(): void {
    for (const sys of [this.add, this.alpha]) for (const p of sys.data) p.alive = false;
    this.tracerData = [];
    for (const f of this.flashes) { f.life = 0; f.s.visible = false; }
    for (const mk of this.markers) { mk.m.visible = false; this.markerPool.push(mk.m); }
    this.markers = [];
  }
}
