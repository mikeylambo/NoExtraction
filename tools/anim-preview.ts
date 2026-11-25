/**
 * Dev page for the clip rig: `npm run dev`, open /anim-preview.html. Drive locomotion with the
 * sliders and fire any CUES entry; used to tune the cue windows. ?style=ballast|trooper|spotter|heavy window.__anim exposes
 * the animator for headless checks.
 */
import * as THREE from 'three';
import { loadModelOverrides } from '../src/world/ModelOverrides';
import { buildHumanoid, HumanAnimator } from '../src/world/Humanoid';
import { CUES } from '../src/world/ClipAnimator';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

await loadModelOverrides();
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x1b2126);
const cam = new THREE.PerspectiveCamera(40, 1, 0.05, 100);
scene.add(new THREE.HemisphereLight(0xdde6ee, 0x2a2f34, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(3, 6, 4); scene.add(sun);
const grid = new THREE.GridHelper(20, 20, 0x3a4650, 0x2a333b); scene.add(grid);

const rig = buildHumanoid((new URLSearchParams(location.search).get('style') as 'ballast') ?? 'trooper');
scene.add(rig.root);
const anim = new HumanAnimator(rig);
const yaw = Number(new URLSearchParams(location.search).get('yaw') ?? 2.4);
cam.position.set(Math.sin(yaw) * 4, 1.5, Math.cos(yaw) * 4); cam.lookAt(0, 0.95, 0);

const cueSel = $<HTMLSelectElement>('cue');
for (const k of Object.keys(CUES)) cueSel.add(new Option(k));
$('go').onclick = () => anim.play(cueSel.value);

function resize() { renderer.setSize(innerWidth, innerHeight); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

const state = { manual: false };
let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (!state.manual) step(dt);
  requestAnimationFrame(frame);
}
function step(dt: number) {
  const p = anim.pose;
  p.weapon = $<HTMLSelectElement>('weapon').value as 'rifle' | 'pistol';
  p.speed = Number($<HTMLInputElement>('speed').value); $('sv').textContent = p.speed.toFixed(1);
  p.dir = THREE.MathUtils.degToRad(Number($<HTMLInputElement>('dir').value)); $('dv').textContent = $<HTMLInputElement>('dir').value;
  p.crouch = $<HTMLInputElement>('crouch').checked ? 1 : 0;
  p.aim = $<HTMLInputElement>('aim').checked ? 1 : 0;
  p.stun = $<HTMLInputElement>('stun').checked ? 1 : 0;
  p.dead = $<HTMLInputElement>('dead').checked ? 1 : 0;
  anim.update(dt);
  renderer.render(scene, cam);
}
requestAnimationFrame(frame);

/** Headless hook: stop the RAF clock and step deterministically. */
(window as unknown as { __anim: unknown }).__anim = {
  anim, rig, cam, ready: !!rig.skin?.clips,
  manual(on: boolean) { state.manual = on; },
  set(o: Partial<Record<string, number | string | boolean>>) {
    for (const [k, v] of Object.entries(o)) { const el = $<HTMLInputElement>(k); if (el.type === 'checkbox') el.checked = !!v; else el.value = String(v); }
  },
  step(dt: number, n = 1) { for (let i = 0; i < n; i++) step(dt); },
  view(y: number, h = 1.5, d = 4) { cam.position.set(Math.sin(y) * d, h, Math.cos(y) * d); cam.lookAt(0, 0.95, 0); },
};
