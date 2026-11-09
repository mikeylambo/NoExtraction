import * as THREE from 'three';
import type { App } from '../game/App';
import { PALETTE } from '../../data/palette';

/** Live overlay: fps, frame time, draw calls, AI states, perception debug (cones, hearing, memory). */
export class Overlay {
  private el: HTMLDivElement;
  visible = new URLSearchParams(location.search).has('overlay');
  private frames: number[] = [];
  private lines: THREE.LineSegments;
  private acc = 0;
  stats = { fps: 0, frameMs: 0, p95: 0, draws: 0, tris: 0 };
  constructor(private readonly app: App) {
    this.el = document.createElement('div'); this.el.className = 'nx-overlay'; document.body.appendChild(this.el);
    this.lines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false, transparent: true }));
    this.lines.renderOrder = 99; this.lines.frustumCulled = false;
    addEventListener('keydown', (e) => { if (e.code === 'F3') this.visible = !this.visible; });
  }
  update(dt: number): void {
    this.frames.push(dt * 1000); if (this.frames.length > 120) this.frames.shift();
    const sorted = [...this.frames].sort((a, b) => a - b);
    const avg = this.frames.reduce((a, b) => a + b, 0) / this.frames.length;
    const info = this.app.renderer.info.render;
    this.stats = { fps: Math.round(1000 / avg), frameMs: +avg.toFixed(2), p95: +(sorted[Math.floor(sorted.length * 0.95)] ?? 0).toFixed(2), draws: info.calls, tris: info.triangles };
    const w = this.app.session.w;
    const debug = w.dev.perceptionDebug;
    if (debug && !this.lines.parent) w.scene.add(this.lines);
    if (!debug && this.lines.parent) this.lines.parent.remove(this.lines);
    if (debug) this.drawPerception();
    this.el.style.display = this.visible ? 'block' : 'none';
    if (!this.visible) return;
    this.acc += dt; if (this.acc < 0.25) return; this.acc = 0;
    const counts: Record<string, number> = {};
    for (const e of w.enemies) if (e.alive) { const k = `${e.def.id}:${e.awareness}`; counts[k] = (counts[k] ?? 0) + 1; }
    this.el.textContent = `fps ${this.stats.fps}  ${this.stats.frameMs} ms (p95 ${this.stats.p95})\ndraws ${info.calls}  tris ${(info.triangles / 1000).toFixed(0)}k  particles ${w.fx.activeParticles}\nenemies ${w.enemies.filter((e) => e.alive).length}  mechs ${w.mechHostiles.filter((m) => m.alive).length}  alert ${w.alert.level()}\n${Object.entries(counts).map(([k, v]) => `${k} ×${v}`).join('\n')}\nbeat ${w.graph.beatId}  core ${w.state.coreStability}%`;
  }
  private drawPerception(): void {
    const w = this.app.session.w; const pos: number[] = []; const col: number[] = [];
    const push = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Color) => { pos.push(a.x, a.y, a.z, b.x, b.y, b.z); col.push(c.r, c.g, c.b, c.r, c.g, c.b); };
    const red = new THREE.Color(PALETTE.red), yellow = new THREE.Color(0xffe080), white = new THREE.Color(0xffffff), grey = new THREE.Color(0x7a8a99);
    for (const s of w.perception.snapshot()) {
      if (!s.enabled) continue;
      const c = s.awareness === 'hunted' ? red : s.awareness === 'suspicious' ? yellow : grey;
      const o = new THREE.Vector3(s.pos.x, s.pos.y + 0.2, s.pos.z);
      const half = (s.fovDeg / 2) * Math.PI / 180, r = Math.min(s.range, 60);
      let prev: THREE.Vector3 | null = null;
      for (let i = 0; i <= 12; i++) { const a = s.yaw - half + (2 * half * i) / 12; const p = o.clone().add(new THREE.Vector3(-Math.sin(a) * r, 0, -Math.cos(a) * r)); if (i === 0 || i === 12) push(o, p, c); if (prev) push(prev, p, c); prev = p; }
      if (s.hearing > 0) { const hr = 12 * s.hearing; for (let i = 0; i < 24; i++) { const a0 = (i / 24) * Math.PI * 2, a1 = ((i + 1) / 24) * Math.PI * 2; push(o.clone().add(new THREE.Vector3(Math.cos(a0) * hr, 0, Math.sin(a0) * hr)), o.clone().add(new THREE.Vector3(Math.cos(a1) * hr, 0, Math.sin(a1) * hr)), grey); } }
      if (s.lastKnown) { const lk = new THREE.Vector3(s.lastKnown.x, s.lastKnown.y + 0.2, s.lastKnown.z); push(o, lk, white); push(lk.clone().add(new THREE.Vector3(-0.5, 0, 0)), lk.clone().add(new THREE.Vector3(0.5, 0, 0)), white); push(lk.clone().add(new THREE.Vector3(0, 0, -0.5)), lk.clone().add(new THREE.Vector3(0, 0, 0.5)), white); }
    }
    const g = this.lines.geometry; g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  }
}
