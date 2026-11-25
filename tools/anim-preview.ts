/**
 * Motion Lab: the game's own animation code on a stage. `npm run dev`, open /anim-preview.html.
 * Characters, weapons, locomotion (sliders or WASD) and every gameplay cue, at gameplay durations.
 * ?style=ballast|trooper|spotter|heavy picks the start character. window.__anim drives it headless.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { loadModelOverrides } from '../src/world/ModelOverrides';
import { MODELS } from '../assets/manifest';
import { buildHumanoid, HumanAnimator, type HumanStyle, type HumanRig } from '../src/world/Humanoid';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const params = new URLSearchParams(location.search);

// The hosted build serves models as glTF JSON (same data; some hosts refuse binary .glb).
if (import.meta.env.VITE_MODELS_AS_JSON) for (const m of MODELS) m.path = m.path.replace(/\.glb$/, '.gltf.json');
await loadModelOverrides();
$('loading').hidden = true;

// ---------------------------------------------------------------- stage
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
$('stage').appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d1114);
scene.fog = new THREE.Fog(0x0d1114, 9, 22);
const cam = new THREE.PerspectiveCamera(38, 1, 0.05, 100);
cam.position.set(2.6, 1.6, 3.4);
const controls = new OrbitControls(cam, renderer.domElement);
controls.target.set(0, 1.0, 0); controls.enableDamping = true; controls.minDistance = 1.2; controls.maxDistance = 9;
controls.maxPolarAngle = Math.PI * 0.53;
scene.add(new THREE.HemisphereLight(0xcfe3ee, 0x1a2026, 1.1));
const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(3, 6, 3); key.castShadow = true;
key.shadow.mapSize.set(2048, 2048); key.shadow.camera.left = key.shadow.camera.bottom = -3; key.shadow.camera.right = key.shadow.camera.top = 3; key.shadow.bias = -0.0004;
scene.add(key);
const rim = new THREE.DirectionalLight(0x3fd6e8, 1.2); rim.position.set(-3, 2.5, -4); scene.add(rim);
// floor: a scrolling 1 m grid, so foot plant against ground speed is visible
const gridTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d')!; g.fillStyle = '#151b20'; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = '#2a3640'; g.lineWidth = 3; g.strokeRect(0, 0, 256, 256);
  g.strokeStyle = '#1e272e'; g.lineWidth = 1; for (let i = 64; i < 256; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.moveTo(0, i); g.lineTo(256, i); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(30, 30); t.anisotropy = 8; t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ map: gridTex, roughness: 0.95 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

// ---------------------------------------------------------------- character
let rig: HumanRig, anim: HumanAnimator, style: HumanStyle = (['ballast', 'trooper', 'spotter', 'heavy'].includes(params.get('style') ?? '') ? params.get('style') : 'ballast') as HumanStyle;
function spawn(s: HumanStyle) {
  if (rig) scene.remove(rig.root);
  style = s; rig = buildHumanoid(s); scene.add(rig.root);
  rig.root.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
  rig.root.rotation.y = Math.PI; // face the default camera
  anim = new HumanAnimator(rig);
  for (const b of document.querySelectorAll<HTMLButtonElement>('#chars button')) b.setAttribute('aria-pressed', String(b.dataset.style === s));
  $<HTMLButtonElement>('w-pistol').disabled = s !== 'ballast';
  if (s !== 'ballast') setWeapon('rifle');
}

// ---------------------------------------------------------------- state + UI
const st = { weapon: 'rifle' as 'rifle' | 'pistol', crouch: false, aim: false, aimHeld: false, stun: false, dead: false, manual: false, slow: 1 };
const toggle = (id: string, on: boolean) => $(id).setAttribute('aria-pressed', String(on));
function setWeapon(w: 'rifle' | 'pistol') { st.weapon = w; toggle('w-rifle', w === 'rifle'); toggle('w-pistol', w === 'pistol'); }
for (const b of document.querySelectorAll<HTMLButtonElement>('#chars button')) b.onclick = () => spawn(b.dataset.style as HumanStyle);
for (const b of document.querySelectorAll<HTMLButtonElement>('#weapons button')) b.onclick = () => { if (!b.disabled) setWeapon(b.dataset.weapon as 'rifle' | 'pistol'); };
$('crouch').onclick = () => { st.crouch = !st.crouch; toggle('crouch', st.crouch); };
$('aim').onclick = () => { st.aim = !st.aim; toggle('aim', st.aim); };
$('stun').onclick = () => { st.stun = !st.stun; toggle('stun', st.stun); };
$('dead').onclick = () => { st.dead = !st.dead; toggle('dead', st.dead); };
$<HTMLInputElement>('slow').oninput = (e) => { st.slow = Number((e.target as HTMLInputElement).value); $('slv').textContent = `${st.slow.toFixed(2)}×`; };

/** Gameplay verbs → cue names, as Weapons.ts / Ballast.ts fire them. */
function cue(name: string, dur?: number) {
  const pistol = st.weapon === 'pistol';
  const map: Record<string, [string, number | undefined]> = {
    fire: [pistol ? 'firePistol' : 'fireRifle', pistol ? 0.3 : 0.15],
    reload: [pistol ? 'reloadPistol' : 'reloadRifle', pistol ? 1.4 : 2.1],
    throw: ['throw', 0.45], melee: [pistol ? 'meleePistol' : 'melee', 0.7], interact: ['interact', 1.2], hit: ['hit', undefined],
  };
  const [c, d] = map[name] ?? [name, dur];
  anim.play(c, d);
}
for (const b of document.querySelectorAll<HTMLButtonElement>('#actions button[data-cue]')) b.onclick = () => cue(b.dataset.cue!, b.dataset.dur ? Number(b.dataset.dur) : undefined);

// ---------------------------------------------------------------- keyboard / mouse
const keys = new Set<string>();
const KEYCUE: Record<string, [string, number?]> = { KeyF: ['fire'], KeyR: ['reload'], KeyG: ['throw'], KeyQ: ['slide', 0.6], Space: ['vault', 0.3], KeyE: ['mantle', 0.45], KeyT: ['takedown', 0.55], KeyV: ['melee'], KeyH: ['hit'], KeyX: ['interact'] };
addEventListener('keydown', (e) => {
  if ((e.target as HTMLElement).tagName === 'INPUT') return;
  if (e.repeat) return;
  keys.add(e.code);
  const k = KEYCUE[e.code]; if (k) { e.preventDefault(); cue(k[0], k[1]); }
  if (e.code === 'KeyC') $('crouch').click();
  if (e.code === 'KeyB') $('stun').click();
  if (e.code === 'KeyK') $('dead').click();
  if (e.code === 'Digit1') setWeapon('rifle');
  if (e.code === 'Digit2' && style === 'ballast') setWeapon('pistol');
});
addEventListener('keyup', (e) => keys.delete(e.code));
renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
renderer.domElement.addEventListener('pointerdown', (e) => { if (e.button === 2) st.aimHeld = true; });
addEventListener('pointerup', (e) => { if (e.button === 2) st.aimHeld = false; });
controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: null as unknown as THREE.MOUSE };

// ---------------------------------------------------------------- loop
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h); cam.aspect = w / h; cam.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

let speedNow = 0, dirNow = 0;
const scroll = new THREE.Vector2();
function step(dt: number) {
  const p = anim.pose;
  // WASD overrides the sliders while held
  const kx = (keys.has('KeyA') ? 1 : 0) - (keys.has('KeyD') ? 1 : 0), kz = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
  let speed = Number($<HTMLInputElement>('speed').value), dir = THREE.MathUtils.degToRad(Number($<HTMLInputElement>('dir').value));
  if (kx || kz) { dir = Math.atan2(kx, kz); speed = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 7 : st.crouch ? 2 : 4.5; }
  speedNow += (speed - speedNow) * Math.min(1, dt * 8);
  dirNow += Math.atan2(Math.sin(dir - dirNow), Math.cos(dir - dirNow)) * Math.min(1, dt * 10);
  p.speed = st.dead ? 0 : speedNow; p.dir = dirNow; p.weapon = st.weapon;
  p.crouch += ((st.crouch ? 1 : 0) - p.crouch) * Math.min(1, dt * 12);
  p.aim += ((st.aim || st.aimHeld ? 1 : 0) - p.aim) * Math.min(1, dt * 14);
  p.stun = st.stun ? 1 : 0;
  p.dead += ((st.dead ? 1 : 0) - p.dead) * Math.min(1, dt * 8);
  anim.update(dt);
  // ground slides under the feet (1 tile = 1 m). The body faces +Z here, so its left is +X.
  scroll.x += Math.sin(dirNow) * p.speed * dt; scroll.y += Math.cos(dirNow) * p.speed * dt;
  gridTex.offset.set(scroll.x, -scroll.y);
  $('sv').textContent = `${speedNow.toFixed(1)} m/s`; $('dv').textContent = `${Math.round(THREE.MathUtils.radToDeg(dirNow))}°`;
  $('gait').textContent = p.dead > 0.5 ? 'down' : p.speed < 0.2 ? 'idle' : p.crouch > 0.5 ? 'crouch' : p.speed < 3 ? 'walk' : p.speed < 6 ? 'run' : 'sprint';
  controls.update();
  renderer.render(scene, cam);
}
let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000) * st.slow; last = now;
  if (!st.manual) step(dt);
  $('status').textContent = `${style.toUpperCase()} · ${st.weapon}\n`;
  requestAnimationFrame(frame);
}
spawn(style);
requestAnimationFrame(frame);

/** Headless hook for screenshots: stop the clock and step deterministically. */
(window as unknown as { __anim: unknown }).__anim = {
  get anim() { return anim; }, get rig() { return rig; }, cam, ready: true,
  manual(on: boolean) { st.manual = on; },
  set(o: Record<string, number | string | boolean>) {
    for (const [k, v] of Object.entries(o)) {
      if (k === 'weapon') setWeapon(v as 'rifle' | 'pistol');
      else if (k === 'crouch' || k === 'aim' || k === 'stun' || k === 'dead') { (st as unknown as Record<string, boolean>)[k] = !!v; toggle(k, !!v); }
      else if (k === 'style') spawn(v as HumanStyle);
      else { const el = $<HTMLInputElement>(k); el.value = String(v); }
    }
    speedNow = Number($<HTMLInputElement>('speed').value); dirNow = THREE.MathUtils.degToRad(Number($<HTMLInputElement>('dir').value));
  },
  step(dt: number, n = 1) { for (let i = 0; i < n; i++) step(dt); },
  view(y: number, h = 1.5, d = 4) { controls.target.set(0, 0.95, 0); cam.position.set(Math.sin(y) * d, h, Math.cos(y) * d); cam.lookAt(0, 0.95, 0); controls.update(); },
};
