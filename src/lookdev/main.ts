import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { buildSet } from './set';
import { loadActors, type Actor } from './actors';
import { FilmPost } from './post';
import { Sky, Snowfall, BlowingSnow, installHeightFog, MOON_DIR, MOON_COLOR, FOG_COLOR } from './atmosphere';

/**
 * Lookdev scene (lookdev.html): one night courtyard pushed as far as the browser renderer goes,
 * to judge the MGS4-era target before committing to an engine. Keys: 1–4 shots, 0 auto-cycle,
 * O free camera, P toggle post (A/B), H hide help.
 */
const params = new URLSearchParams(location.search);
const quality: 'low' | 'high' = params.get('q') === 'low' ? 'low' : 'high';

installHeightFog(0, 0.1);

const still = params.has('still'); // screenshot tool: no RAF loop, frames rendered on demand
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: still });
renderer.setPixelRatio(Math.min(devicePixelRatio, quality === 'high' ? 1.5 : 1));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.35;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(FOG_COLOR.getHex(), 0.011);
const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 2000);

// environment: a dim sky dome plus a few warm and cold "lamp" cards, so metals catch believable highlights
{
  const env = new THREE.Scene();
  const dome = new THREE.SphereGeometry(50, 32, 16); const c = new Float32Array(dome.attributes.position.count * 3);
  for (let i = 0; i < dome.attributes.position.count; i++) { const y = dome.attributes.position.getY(i) / 50; const k = Math.max(0, y); const col = new THREE.Color().copy(FOG_COLOR).multiplyScalar(1.4).lerp(new THREE.Color(0x05080f), Math.min(1, k * 1.6)); if (y < 0) col.setRGB(0.14, 0.16, 0.19); c.set([col.r, col.g, col.b], i * 3); }
  dome.setAttribute('color', new THREE.BufferAttribute(c, 3));
  env.add(new THREE.Mesh(dome, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const card = (color: number, i: number, x: number, y: number, z: number, s: number) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(i), side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m); };
  card(0xffc890, 3, -20, 18, 10, 6); card(0xffc890, 3, 18, 16, -12, 5); card(0xdfe9ff, 6, 30, 25, -30, 8);
  card(0xb8cfff, 4, MOON_DIR.x * 45, MOON_DIR.y * 45, MOON_DIR.z * 45, 4);
  const pmrem = new THREE.PMREMGenerator(renderer); scene.environment = pmrem.fromScene(env, 0.02).texture; scene.environmentIntensity = 0.55;
}

// moonlight (key) + cold sky fill
const moon = new THREE.DirectionalLight(MOON_COLOR, 1.0);
moon.position.copy(MOON_DIR).multiplyScalar(80); moon.castShadow = true;
moon.shadow.mapSize.set(quality === 'high' ? 4096 : 2048, quality === 'high' ? 4096 : 2048);
Object.assign(moon.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 220 });
moon.shadow.bias = -0.0002; moon.shadow.normalBias = 0.04; moon.shadow.radius = 2;
scene.add(moon, moon.target);
scene.add(new THREE.HemisphereLight(0x3a4c6a, 0x1a1f26, 0.55));

const sky = new Sky(scene);
const set = buildSet(scene, quality);
const snow = new Snowfall(scene, innerHeight * renderer.getPixelRatio());
const drift = new BlowingSnow(scene, set.heightAt);

const transient = (): THREE.Object3D[] => {
  const out: THREE.Object3D[] = [];
  scene.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.Material | undefined; if ((o as THREE.Points).isPoints || (o as THREE.Sprite).isSprite || (m && m.blending === THREE.AdditiveBlending)) out.push(o); });
  return out;
};
let transientCache: THREE.Object3D[] | null = null;
const post = new FilmPost(renderer, scene, camera, innerWidth * renderer.getPixelRatio(), innerHeight * renderer.getPixelRatio(), quality, () => (transientCache ??= transient()));

let actors: Actor[] = []; let patroller: THREE.Object3D | null = null;

// ---- shots ----------------------------------------------------------------------------------
interface Shot { name: string; dur: number; frame(k: number, out: { pos: THREE.Vector3; look: THREE.Vector3 }): void; fov: number; focus: (() => number) | null; letterbox: number }
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const pTmp = new THREE.Vector3();
const shots: Shot[] = [
  { name: 'Establishing — perimeter at 02:40', dur: 12, fov: 38, focus: null, letterbox: 1,
    frame: (k, o) => { o.pos.copy(V(34, 8.5, 27)).lerp(V(29, 7.2, 23), k); o.look.copy(V(-1, 5.2, -7)).lerp(V(-3, 5.4, -8), k); } },
  { name: 'Patrol — over the shoulder', dur: 10, fov: 34, focus: () => (patroller ? camera.position.distanceTo(patroller.position) : 6), letterbox: 1,
    frame: (k, o) => {
      if (!patroller) { o.pos.set(0, 2, 18); o.look.set(0, 1, 0); return; }
      const yaw = patroller.rotation.y; const side = 1.4, back = 4.2;
      o.pos.set(patroller.position.x - Math.sin(yaw) * back + Math.cos(yaw) * side, patroller.position.y + 1.75, patroller.position.z - Math.cos(yaw) * back - Math.sin(yaw) * side);
      pTmp.set(Math.sin(yaw) * 6, 0, Math.cos(yaw) * 6); o.look.copy(patroller.position).add(pTmp).setY(patroller.position.y + 1.2); void k;
    } },
  { name: 'Ground level — against the floodlights', dur: 10, fov: 30, focus: () => 9, letterbox: 1,
    frame: (k, o) => { o.pos.copy(V(4.5, 0.5, 15.5)).lerp(V(5.2, 0.55, 14.6), k); o.look.copy(V(15, 5, -12)); } },
  { name: 'Container row — the door sentry', dur: 10, fov: 40, focus: () => camera.position.distanceTo(V(-5.4, 1.5, -8.6)), letterbox: 1,
    frame: (k, o) => { o.pos.copy(V(-15.5, 1.6, 9)).lerp(V(-14.5, 1.7, 6.5), k); o.look.copy(V(-5, 1.6, -8)); } },
];
let shotIx = Number(params.get('shot') ?? 1) - 1; let auto = !params.has('shot'); let shotT = Number(params.get('t') ?? 0);
let free = false;
const controls = new OrbitControls(camera, renderer.domElement); controls.enabled = false; controls.target.set(0, 1.5, 0);
const camState = { pos: new THREE.Vector3(), look: new THREE.Vector3() };

// ---- help / A-B ---------------------------------------------------------------------------
const help = document.createElement('div'); help.className = 'ld-help';
const title = document.createElement('div'); title.className = 'ld-title';
document.body.append(help, title);
const drawHelp = () => {
  help.innerHTML = `<b>1–4</b> shots &nbsp; <b>0</b> auto ${auto ? '●' : '○'} &nbsp; <b>O</b> free cam ${free ? '●' : '○'} &nbsp; <b>P</b> post ${post.enabled ? 'on' : 'OFF'} &nbsp; <b>H</b> hide`;
};
addEventListener('keydown', (e) => {
  if (e.key >= '1' && e.key <= String(shots.length)) { shotIx = Number(e.key) - 1; shotT = 0; auto = false; free = false; }
  if (e.key === '0') { auto = !auto; free = false; }
  if (e.key === 'o' || e.key === 'O') { free = !free; controls.enabled = free; if (free) controls.target.copy(camState.look); }
  if (e.key === 'p' || e.key === 'P') post.setEnabled(!post.enabled);
  if (e.key === 'h' || e.key === 'H') { help.hidden = !help.hidden; title.hidden = help.hidden; }
  drawHelp();
});
if (params.has('raw')) post.setEnabled(false);
if (params.has('clean')) { help.hidden = true; title.hidden = true; }
drawHelp();

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  post.setSize(innerWidth * renderer.getPixelRatio(), innerHeight * renderer.getPixelRatio());
});

// ---- loop -----------------------------------------------------------------------------------
const clock = new THREE.Clock(); let time = Number(params.get('time') ?? 0);
function step(dt: number): void {
  time += dt;
  for (const a of actors) a.update(dt);
  const shot = shots[shotIx];
  if (!free) {
    shotT += dt; if (shotT > shot.dur) { shotT = 0; if (auto) shotIx = (shotIx + 1) % shots.length; }
    const k = Math.min(1, shotT / shots[shotIx].dur); const e = k * k * (3 - 2 * k);
    shots[shotIx].frame(e, camState); camera.position.copy(camState.pos); camera.lookAt(camState.look);
    if (camera.fov !== shots[shotIx].fov) { camera.fov = shots[shotIx].fov; camera.updateProjectionMatrix(); }
    title.textContent = shots[shotIx].name;
  } else { controls.update(); title.textContent = 'Free camera'; }
  sky.update(time, camera); snow.update(time, camera); drift.update(time);
  for (const b of set.beams) b.uniforms.uTime.value = time;
  for (const bl of set.blinkers) (bl.material as THREE.MeshStandardMaterial).emissiveIntensity = Math.sin(time * 3.2) > 0.6 ? 7 : 0.2;
  for (const w of set.windows) w.emissiveIntensity = 2.0 + Math.sin(time * 23.0) * 0.04 + (Math.sin(time * 0.7) > 0.98 ? -0.8 : 0);
}
function draw(): void { const s = shots[shotIx]; post.render(time, free ? null : (s.focus ? s.focus() : null), free ? 0 : s.letterbox); }
function frame(): void {
  if (!still) requestAnimationFrame(frame);
  step(Math.min(clock.getDelta(), 1 / 20));
  draw();
}

// headless hooks for the screenshot tool
declare global { interface Window { __look?: { ready: boolean; draw(): void; advance(sec: number): void; shot(n: number, t: number): void; post(on: boolean): void; info(): unknown } } }
window.__look = {
  ready: false,
  draw,
  advance(sec) { const n = Math.ceil(sec * 30); for (let i = 0; i < n; i++) step(1 / 30); },
  shot(n, t) { shotIx = n - 1; shotT = t; auto = false; free = false; step(0); },
  post(on) { post.setEnabled(on); drawHelp(); },
  info() { return { calls: renderer.info.render.calls, tris: renderer.info.render.triangles, programs: renderer.info.programs?.length }; },
};

loadActors(scene, `${import.meta.env.BASE_URL}lookdev/soldier.glb`, set.patrol, set.heightAt, quality === 'high' ? 1024 : 512)
  .then((r) => { actors = r.actors; patroller = r.patroller; })
  .catch((e) => console.error('actors failed', e))
  .finally(() => { transientCache = null; window.__look!.ready = true; });
frame();
