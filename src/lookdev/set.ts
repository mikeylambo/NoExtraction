import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { PALETTE } from '../../data/palette';
import { fbm, snowSet, packedSnowSet, concreteSet, paintedMetalSet, rockSet, chainLinkTexture, pbrMaterial } from '../render/textures';
import { lightBeam, glare } from '../render/atmosphere';

/**
 * The lookdev set: a Sable perimeter courtyard on the ice shelf at night. Everything here is built
 * in code from generated textures — it is the floor of what the renderer can do before authored
 * assets arrive, not a replacement for them.
 */

export interface SetPiece {
  heightAt(x: number, z: number): number;
  patrol: THREE.Vector3[];
  /** Bright light sources the post stack / beams animate. */
  beams: { uniforms: Record<string, THREE.IUniform> }[];
  blinkers: THREE.Mesh[];
  windows: THREE.MeshStandardMaterial[];
}

const YARD = { x0: -26, x1: 26, z0: -22, z1: 20 };
const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Wall footprints (x, z, halfW, halfD) used to pile drifts against structures. */
const WALLS: [number, number, number, number][] = [];

function rawHeight(x: number, z: number): number {
  const u = x / 400 + 0.5, v = z / 400 + 0.5;
  const hills = (fbm(u, v, 3, 5, 3) - 0.5) * 9 + (fbm(u, v, 12, 3, 7) - 0.5) * 1.2;
  // the yard is graded flat; terrain rises out of it
  const dx = Math.max(YARD.x0 - x, 0, x - YARD.x1), dz = Math.max(YARD.z0 - z, 0, z - YARD.z1);
  const outside = smooth(0, 18, Math.hypot(dx, dz));
  let h = hills * outside + (fbm(u, v, 40, 2, 11) - 0.5) * 0.12;
  // drifts: wind from +x piles snow on the -x (leeward) side of walls and a little on the windward face
  for (const [wx, wz, hw, hd] of WALLS) {
    const lx = x - wx, lz = z - wz;
    const along = smooth(hd + 1.5, hd - 0.5, Math.abs(lz));
    const lee = smooth(-hw - 7, -hw - 0.2, lx) * smooth(-hw + 0.5, -hw - 0.1, lx);
    const wind = smooth(hw + 2.5, hw + 0.1, lx) * smooth(hw - 0.5, hw + 0.1, lx);
    h += (lee * 1.1 + wind * 0.45) * along * (0.8 + fbm(u, v, 30, 2, 13) * 0.4);
  }
  return h;
}

function terrain(scene: THREE.Scene, heightAt: (x: number, z: number) => number): void {
  const size = 260, seg = 300;
  const g = new THREE.PlaneGeometry(size, size, seg, seg); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) p.setY(i, heightAt(p.getX(i), p.getZ(i)));
  g.computeVertexNormals();
  const set = snowSet(size / 7);
  const m = pbrMaterial(set, { normalScale: 0.9, envIntensity: 0.6 });
  addSparkle(m);
  const mesh = new THREE.Mesh(g, m); mesh.receiveShadow = true; scene.add(mesh);

  // far ring: mountains and ice cliffs, vertex-coloured (fog swallows most texture detail at that range)
  const rg = new THREE.RingGeometry(150, 700, 360, 70); rg.rotateX(-Math.PI / 2);
  const rp = rg.attributes.position as THREE.BufferAttribute; const col = new Float32Array(rp.count * 3);
  for (let i = 0; i < rp.count; i++) {
    const x = rp.getX(i), z = rp.getZ(i); const r = Math.hypot(x, z); const a = Math.atan2(z, x);
    const au = a / (Math.PI * 2) + 0.5; const ridge = Math.pow(1 - Math.abs(fbm(au, r / 1400, 6, 6, 201) * 2 - 1), 1.5) + (1 - Math.abs(fbm(au, r / 1400, 24, 4, 207) * 2 - 1)) * 0.25;
    const h = Math.pow(smooth(190, 430, r), 1.4) * (10 + ridge * ridge * 48) * (0.6 + fbm(a / (Math.PI * 2) + 0.5, 0.3, 3, 2, 205) * 0.8);
    rp.setY(i, h - 2);
  }
  rg.computeVertexNormals();
  const rn = rg.attributes.normal as THREE.BufferAttribute;
  for (let i = 0; i < rp.count; i++) { const steep = smooth(0.55, 0.8, 1 - rn.getY(i)); const c = 0.85 - steep * 0.7; col[i * 3] = c * 0.92; col[i * 3 + 1] = c * 0.96; col[i * 3 + 2] = c; }
  rg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  scene.add(new THREE.Mesh(rg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 })));
}

/** View-dependent glints on snow (hash per world cell, re-rolled by view direction so it twinkles). */
function addSparkle(m: THREE.MeshStandardMaterial): void {
  m.onBeforeCompile = (s) => {
    s.fragmentShader = s.fragmentShader.replace('#include <dithering_fragment>', `#include <dithering_fragment>
#ifdef USE_FOG
{
  vec3 vd = normalize(cameraPosition - vFogWorld);
  vec3 cell = floor(vFogWorld * 28.0) + floor(vd * 14.0);
  float hs = fract(sin(dot(cell, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
  float d = length(vFogWorld - cameraPosition);
  float glint = step(0.9975, hs) * (1.0 - smoothstep(4.0, 30.0, d));
  gl_FragColor.rgb += vec3(0.9, 0.95, 1.0) * glint * 1.6 * (0.3 + dot(gl_FragColor.rgb, vec3(0.33)) * 2.0);
}
#endif`);
  };
}

/** A box whose four side faces are corrugated sheet (sine displacement along the face normal). */
function corrugatedBox(w: number, h: number, d: number, pitch: number, amp: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const side = (len: number, ht: number, rotY: number, off: THREE.Vector3) => {
    const segs = Math.max(4, Math.round(len / pitch) * 4);
    const g = new THREE.PlaneGeometry(len, ht, segs, 1); const pp = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pp.count; i++) pp.setZ(i, Math.sin((pp.getX(i) / pitch) * Math.PI * 2) * amp);
    g.computeVertexNormals(); g.rotateY(rotY); g.translate(off.x, off.y, off.z); parts.push(g);
  };
  side(w, h, 0, new THREE.Vector3(0, 0, d / 2)); side(w, h, Math.PI, new THREE.Vector3(0, 0, -d / 2));
  side(d, h, Math.PI / 2, new THREE.Vector3(w / 2, 0, 0)); side(d, h, -Math.PI / 2, new THREE.Vector3(-w / 2, 0, 0));
  const top = new THREE.PlaneGeometry(w, d); top.rotateX(-Math.PI / 2); top.translate(0, h / 2, 0); parts.push(top);
  return mergeSimple(parts);
}

function mergeSimple(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], idx: number[] = []; let base = 0;
  for (const g of parts) {
    const p = g.attributes.position as THREE.BufferAttribute, n = g.attributes.normal as THREE.BufferAttribute, u = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); uv.push(u.getX(i), u.getY(i)); }
    const ix = g.index; if (ix) for (let i = 0; i < ix.count; i++) idx.push(ix.getX(i) + base); else for (let i = 0; i < p.count; i++) idx.push(i + base);
    base += p.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); out.setIndex(idx); return out;
}

/** World-scaled UVs for boxes so texel density is consistent (1 UV unit = `metres`). */
function boxUV(g: THREE.BufferGeometry, metres: number): THREE.BufferGeometry {
  const p = g.attributes.position as THREE.BufferAttribute, n = g.attributes.normal as THREE.BufferAttribute, u = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i));
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (ay > 0.6) u.setXY(i, x / metres, z / metres); else if (ax > 0.6) u.setXY(i, z / metres, y / metres); else u.setXY(i, x / metres, y / metres);
  }
  u.needsUpdate = true; return g;
}

export function buildSet(scene: THREE.Scene, quality: 'low' | 'high'): SetPiece {
  const beams: SetPiece['beams'] = []; const blinkers: THREE.Mesh[] = []; const windows: THREE.MeshStandardMaterial[] = [];
  const shadowRes = quality === 'high' ? 1024 : 512;

  // materials
  const concrete = pbrMaterial(concreteSet(1), { envIntensity: 0.5 });
  const concreteDark = pbrMaterial(concreteSet(1), { color: 0x8a8f96, envIntensity: 0.4 });
  const snowCap = pbrMaterial(snowSet(1), { envIntensity: 0.6 }); addSparkle(snowCap);
  const sableGrey = pbrMaterial(paintedMetalSet([0.17, 0.19, 0.2], 1, 1), { envIntensity: 0.9 });
  const olive = pbrMaterial(paintedMetalSet([0.2, 0.21, 0.15], 1, 2), { envIntensity: 0.9 });
  const teal = pbrMaterial(paintedMetalSet([0.12, 0.2, 0.22], 1, 3), { envIntensity: 0.9 });
  const rust = pbrMaterial(paintedMetalSet([0.28, 0.14, 0.08], 1, 4), { envIntensity: 0.9 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x5b6168, roughness: 0.42, metalness: 0.9 });
  const darkSteel = new THREE.MeshStandardMaterial({ color: 0x24282c, roughness: 0.55, metalness: 0.8 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x111214, roughness: 0.85, metalness: 0 });
  const rockMat = pbrMaterial(rockSet(1), { envIntensity: 0.4 });

  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, ry = 0, cast = true) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = cast; m.receiveShadow = true; scene.add(m); return m;
  };
  const rbox = (w: number, h: number, d: number, r = 0.04, uvm = 2.5) => boxUV(new RoundedBoxGeometry(w, h, d, 2, r), uvm);

  // ---- footprints for drifts (declared before terrain is built) -----------------------------
  WALLS.push([0, -15, 10, 5], [-19, 2, 3.1, 6.5], [17.5, 4, 4, 3], [0, 21, 26, 0.3]);
  const heightAt = (x: number, z: number) => rawHeight(x, z);
  terrain(scene, heightAt);

  // ---- command bunker -------------------------------------------------------------------------
  const B = { x: 0, z: -15, w: 20, h: 6.2, d: 10 };
  add(rbox(B.w, B.h, B.d, 0.08, 3), concrete, B.x, B.h / 2 - 0.3, B.z);
  add(rbox(B.w + 0.6, 0.45, B.d + 0.6, 0.06, 3), concreteDark, B.x, B.h - 0.1, B.z);                       // roof lip
  add(rbox(B.w + 0.4, 0.5, B.d + 0.4, 0.22, 3), snowCap, B.x, B.h + 0.3, B.z, 0, false);                   // snow load
  add(rbox(B.w + 0.2, 0.6, 0.5, 0.05, 3), concreteDark, B.x, 0.0, B.z + B.d / 2 + 0.1);                    // plinth
  // blast door: recess, frame, painted door, hazard-free (no gameplay meaning), handle wheel
  add(rbox(4.2, 4.0, 0.6, 0.03), concreteDark, -3, 2.0, B.z + B.d / 2 + 0.15);
  add(rbox(3.4, 3.4, 0.25, 0.02, 1.5), sableGrey, -3, 1.75, B.z + B.d / 2 + 0.38);
  for (const dy of [0.6, 2.9]) add(rbox(3.5, 0.12, 0.08, 0.02), darkSteel, -3, dy, B.z + B.d / 2 + 0.53);
  {
    const housing = add(rbox(0.5, 0.22, 0.3, 0.05), darkSteel, -3, 4.35, B.z + B.d / 2 + 0.45);
    const lens = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.04, 0.2), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xdfe8ff, emissiveIntensity: 8 })); lens.position.set(0, -0.12, 0.02); housing.add(lens);
    const sl = new THREE.SpotLight(0xd6e2ff, 40, 14, 1.0, 0.7, 2); sl.position.set(-3, 4.15, B.z + B.d / 2 + 0.55); const t = new THREE.Object3D(); t.position.set(-3, 0, B.z + B.d / 2 + 3.5); scene.add(sl, t); sl.target = t;
    sl.castShadow = true; sl.shadow.mapSize.set(shadowRes, shadowRes); sl.shadow.bias = -0.0004; sl.shadow.normalBias = 0.02;
    const gl = glare(0xdfe8ff, 0.9); gl.position.set(-3, 4.15, B.z + B.d / 2 + 0.6); scene.add(gl);
  }
  const wheel = add(new THREE.TorusGeometry(0.32, 0.04, 8, 24), steel, -2.1, 1.7, B.z + B.d / 2 + 0.56); wheel.rotation.y = 0;
  // windows: slit windows with warm interior glow behind louvres
  for (const wx of [3.5, 6.5]) {
    add(rbox(2.2, 0.9, 0.4, 0.02), concreteDark, wx, 3.6, B.z + B.d / 2 + 0.05);
    const glow = new THREE.MeshStandardMaterial({ color: 0x050505, emissive: 0xffc890, emissiveIntensity: 5, roughness: 0.3 }); windows.push(glow);
    add(new THREE.BoxGeometry(1.9, 0.6, 0.05), glow, wx, 3.6, B.z + B.d / 2 + 0.27, 0, false);
    for (let i = 0; i < 2; i++) add(new THREE.BoxGeometry(1.95, 0.03, 0.06), darkSteel, wx, 3.45 + i * 0.3, B.z + B.d / 2 + 0.32);
  }
  // pipes and conduit along the facade
  const pipe = (len: number, r: number, mat: THREE.Material, x: number, y: number, z: number, horizontal: boolean) => {
    const g = new THREE.CylinderGeometry(r, r, len, 12); if (horizontal) g.rotateZ(Math.PI / 2); return add(g, mat, x, y, z);
  };
  pipe(18, 0.12, rust, 0.5, 5.2, B.z + B.d / 2 + 0.35, true);
  pipe(18, 0.06, darkSteel, 0.5, 4.9, B.z + B.d / 2 + 0.3, true);
  pipe(5.2, 0.12, rust, 9.2, 2.6, B.z + B.d / 2 + 0.35, false);
  for (let i = 0; i < 6; i++) add(rbox(0.1, 0.3, 0.3, 0.01), darkSteel, -8 + i * 3.4, 5.05, B.z + B.d / 2 + 0.25);
  // roof gear: HVAC box, vent stacks, antenna
  add(rbox(2.6, 1.4, 1.8, 0.05, 1.5), olive, 5, B.h + 1.1, B.z - 1);
  add(rbox(2.7, 0.15, 1.9, 0.06), snowCap, 5, B.h + 1.86, B.z - 1, 0, false);
  for (const vx of [-6, -4.5]) { pipe(1.6, 0.25, steel, vx, B.h + 1.1, B.z + 1, false); }
  // mast with aviation light
  const mast = new THREE.Group(); mast.position.set(-7, B.h + 0.3, B.z - 2); scene.add(mast);
  for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 14, 6), steel); leg.position.set(Math.cos(a) * 0.35, 7, Math.sin(a) * 0.35); leg.castShadow = true; mast.add(leg); }
  for (let i = 0; i < 14; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.015, 4, 3), steel); r.rotation.x = Math.PI / 2; r.position.y = i + 0.5; mast.add(r); }
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), new THREE.MeshStandardMaterial({ color: 0x110000, emissive: PALETTE.red, emissiveIntensity: 6 }));
  beacon.position.y = 14.2; mast.add(beacon); blinkers.push(beacon);
  // sagging cable from mast to floodlight tower
  const cable = (a: THREE.Vector3, b: THREE.Vector3, sag: number) => {
    const pts: THREE.Vector3[] = []; for (let i = 0; i <= 24; i++) { const t = i / 24; const p = a.clone().lerp(b, t); p.y -= Math.sin(t * Math.PI) * sag; pts.push(p); }
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.025, 5, false), rubber, 0, 0, 0, 0, true);
  };

  // ---- shipping containers (corrugated) -------------------------------------------------------
  const container = (x: number, y: number, z: number, ry: number, mat: THREE.Material, snowTop: boolean) => {
    const g = boxUV(corrugatedBox(6.06, 2.59, 2.44, 0.28, 0.035), 3);
    const c = add(g, mat, x, y + 1.295, z, ry);
    // corner castings + door bars
    const frame = new THREE.Group(); frame.position.copy(c.position); frame.rotation.y = ry; scene.add(frame);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.6, 0.16), darkSteel); post.position.set(sx * 2.97, 0, sz * 1.16); post.castShadow = true; frame.add(post); }
    for (const sy of [-1, 1]) for (const sz of [-1, 1]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(6.06, 0.14, 0.12), darkSteel); rail.position.set(0, sy * 1.25, sz * 1.18); frame.add(rail); }
    for (let i = 0; i < 4; i++) { const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.4, 6), steel); bar.position.set(3.08, 0, -0.9 + i * 0.6); frame.add(bar); }
    if (snowTop) { const s = new THREE.Mesh(new RoundedBoxGeometry(5.9, 0.28, 2.3, 2, 0.12), snowCap); s.position.set(0, 1.4, 0); s.receiveShadow = true; frame.add(s); }
  };
  container(-19, 0, -2, Math.PI / 2, teal, false);
  container(-19, 2.59, -2, Math.PI / 2, rust, true);
  container(-19, 0, 5.2, Math.PI / 2, olive, true);
  container(-15.2, 0, 13, 0.2, sableGrey, true);

  // ---- quonset-style vehicle shed (corrugated half-cylinder) --------------------------------
  {
    // half-cylinder arch: theta in [PI/2, 3PI/2] then rotateX(PI/2) puts the arch over +Y, axis along Z
    const g = new THREE.CylinderGeometry(4, 4, 6, 96, 1, true, Math.PI / 2, Math.PI); const pp = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pp.count; i++) { const a = Math.atan2(pp.getX(i), pp.getZ(i)); const k = 1 + Math.sin(a * 44) * 0.009; pp.setX(i, pp.getX(i) * k); pp.setZ(i, pp.getZ(i) * k); }
    g.computeVertexNormals(); g.rotateX(Math.PI / 2);
    const olive2 = olive.clone(); olive2.side = THREE.DoubleSide;
    add(boxUV(g, 3), olive2, 17.5, 0, 4);
    add(new THREE.CircleGeometry(4, 48, 0, Math.PI), concreteDark, 17.5, 0, 1.02, Math.PI);
    { const sh = new THREE.Shape(); sh.absarc(0, 0, 3.98, 0, Math.PI, false); sh.lineTo(-3.98, 0); const hole = new THREE.Path(); hole.moveTo(-1.8, 0); hole.lineTo(1.8, 0); hole.lineTo(1.8, 2.9); hole.lineTo(-1.8, 2.9); hole.closePath(); sh.holes.push(hole);
      const fg = new THREE.ExtrudeGeometry(sh, { depth: 0.12, bevelEnabled: false, curveSegments: 32 }); add(boxUV(fg, 3), olive2, 17.5, 0, 6.88); }
    const snowArc = new THREE.CylinderGeometry(4.09, 4.09, 6, 32, 1, true, Math.PI - 0.7, 1.4); snowArc.rotateX(Math.PI / 2);
    add(snowArc, snowCap, 17.5, 0, 4, 0, false);
    // parked tracked hauler silhouette inside the open front
    add(rbox(2.4, 1.4, 4.2, 0.12, 1.5), sableGrey, 17.5, 1.1, 5.5);
    for (const sx of [-1.3, 1.3]) add(rbox(0.5, 0.9, 4.6, 0.2), rubber, 17.5 + sx, 0.45, 5.5);
  }

  // ---- perimeter fence (chain link with posts and razor coil) --------------------------------
  {
    const link = chainLinkTexture(); link.repeat.set(52 / 1.2, 3 / 1.2);
    const fenceMat = new THREE.MeshStandardMaterial({ map: link, alphaTest: 0.35, side: THREE.DoubleSide, color: 0x9aa3ab, metalness: 0.8, roughness: 0.45 });
    const f = add(new THREE.PlaneGeometry(52, 3), fenceMat, 0, 1.6, 21); f.castShadow = true;
    for (let i = 0; i <= 13; i++) add(new THREE.CylinderGeometry(0.05, 0.05, 3.4, 8), steel, -26 + i * 4, 1.6, 21);
    const coil: THREE.Vector3[] = []; for (let i = 0; i < 900; i++) { const t = i / 900; const a = t * Math.PI * 2 * 90; coil.push(new THREE.Vector3(-26 + t * 52 + Math.sin(a) * 0.05, 3.45 + Math.cos(a) * 0.22, 21 + Math.sin(a) * 0.22)); }
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(coil), 1800, 0.008, 3, false), steel, 0, 0, 0);
  }

  // ---- barriers, sandbags, drums, crates ------------------------------------------------------
  const jersey = (x: number, z: number, ry: number) => {
    const s = new THREE.Shape(); s.moveTo(-0.3, 0); s.lineTo(0.3, 0); s.lineTo(0.3, 0.08); s.lineTo(0.12, 0.3); s.lineTo(0.08, 0.81); s.lineTo(-0.08, 0.81); s.lineTo(-0.12, 0.3); s.lineTo(-0.3, 0.08); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 3, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 2 }); g.translate(0, 0, -1.5);
    add(boxUV(g, 2), concrete, x, heightAt(x, z) - 0.05, z, ry);
  };
  jersey(4, 6, 0.1); jersey(7.2, 6.4, 0.18); jersey(-6, 9, -0.4); jersey(10, -3, Math.PI / 2 + 0.05);
  {
    const sand = pbrMaterial(concreteSet(1), { color: 0xc8b48c, envIntensity: 0.3 });
    const bag = new RoundedBoxGeometry(0.62, 0.2, 0.36, 3, 0.08); const bp = bag.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < bp.count; i++) { const x = bp.getX(i), y = bp.getY(i); const pinch = 1 - Math.pow(Math.abs(x) / 0.31, 4) * 0.35; bp.setY(i, y * pinch); bp.setZ(i, bp.getZ(i) * (0.85 + 0.15 * pinch)); }
    bag.computeVertexNormals();
    const inst = new THREE.InstancedMesh(bag, sand, 60); const m4 = new THREE.Matrix4(); let k = 0;
    for (let row = 0; row < 4; row++) for (let i = 0; i < 12 - row; i++) {
      const x = -4 + i * 0.64 + row * 0.32 + (Math.random() - 0.5) * 0.05, y = 0.1 + row * 0.19, z = 13 + (Math.random() - 0.5) * 0.06;
      m4.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler((Math.random() - 0.5) * 0.08, (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.08)), new THREE.Vector3(1, 0.9 + Math.random() * 0.2, 1));
      inst.setMatrixAt(k++, m4);
    }
    inst.count = k; inst.castShadow = true; inst.receiveShadow = true; scene.add(inst);
  }
  const drum = (x: number, z: number, mat: THREE.Material, tip = false) => {
    const g = new THREE.CylinderGeometry(0.29, 0.29, 0.88, 28, 6); const pp = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pp.count; i++) { const y = pp.getY(i); const rib = Math.abs(Math.abs(y) - 0.15) < 0.04 ? 1.025 : 1; pp.setX(i, pp.getX(i) * rib); pp.setZ(i, pp.getZ(i) * rib); }
    g.computeVertexNormals();
    const m = add(g, mat, x, tip ? 0.29 : 0.44, z, Math.random() * 6); if (tip) m.rotation.z = Math.PI / 2;
  };
  drum(12.4, 9, rust); drum(13.0, 9.4, olive); drum(12.6, 10, rust); drum(13.6, 8.6, teal, true); drum(-12, -6, rust); drum(-11.5, -6.5, rust);
  const crate = (x: number, z: number, s: number, ry: number) => {
    add(rbox(s, s * 0.8, s, 0.03, 1.2), olive, x, s * 0.4, z, ry);
    add(rbox(s * 1.02, 0.1, s * 1.02, 0.04), snowCap, x, s * 0.8 + 0.03, z, ry, false);
  };
  crate(9, 12, 1.2, 0.3); crate(10.3, 12.4, 1.0, -0.2); crate(9.6, 12.2, 0.8, 0.5);

  // ---- rocks pushing through the drifts beyond the yard --------------------------------------
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * Math.PI * 2, r = 36 + Math.random() * 60; const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const g = new THREE.IcosahedronGeometry(1, 5); const pp = g.attributes.position as THREE.BufferAttribute; const sd = Math.random() * 100;
    for (let j = 0; j < pp.count; j++) { const v = new THREE.Vector3(pp.getX(j), pp.getY(j), pp.getZ(j)); const n = fbm(v.x * 0.2 + 0.5, v.z * 0.2 + v.y * 0.1 + 0.5, 4, 4, 300 + Math.floor(sd)); v.multiplyScalar(0.75 + n * 0.6); v.y *= 0.6; pp.setXYZ(j, v.x, v.y, v.z); }
    g.computeVertexNormals(); const s = 1 + Math.random() * 3.5;
    const m = add(g, rockMat, x, heightAt(x, z) + s * 0.1, z, Math.random() * 6); m.scale.setScalar(s);
  }

  // ---- lights: moonlit yard, tungsten lamps, a cold floodlight tower -------------------------
  const lamp = (x: number, z: number, ry: number) => {
    const y0 = heightAt(x, z);
    add(new THREE.CylinderGeometry(0.07, 0.1, 7, 10), darkSteel, x, y0 + 3.5, z);
    const arm = new THREE.Group(); arm.position.set(x, y0 + 7, z); arm.rotation.y = ry; scene.add(arm);
    const am = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.6), darkSteel); am.position.z = 0.8; am.castShadow = true; arm.add(am);
    const head = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.18, 0.7, 2, 0.05), darkSteel); head.position.set(0, -0.08, 1.5); head.castShadow = true; arm.add(head);
    const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.02, 0.5), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffd2a0, emissiveIntensity: 9 })); bulb.position.set(0, -0.18, 1.5); arm.add(bulb);
    const sl = new THREE.SpotLight(0xffc68c, 90, 26, 0.9, 0.55, 2); sl.position.set(0, -0.2, 1.5); arm.add(sl);
    const tgt = new THREE.Object3D(); tgt.position.set(0, -7, 2.4); arm.add(tgt); sl.target = tgt;
    sl.castShadow = true; sl.shadow.mapSize.set(shadowRes, shadowRes); sl.shadow.bias = -0.0004; sl.shadow.normalBias = 0.02; sl.shadow.camera.near = 0.3;
    const b = lightBeam(0xffc890, 7, 3.4, 0.22); b.mesh.position.set(0, -0.2, 1.5); b.mesh.rotation.x = -0.12; arm.add(b.mesh); beams.push(b);
    const gl = glare(0xffd0a0, 1.4); gl.position.set(0, -0.3, 1.5); arm.add(gl);
  };
  lamp(-6.5, 3, 0.3); lamp(9, -4, -2.6); lamp(-12, 14, 2.4);

  // floodlight tower (lattice) in the NE corner, aimed back across the yard
  {
    const T = new THREE.Group(); const tx = 21, tz = -18; T.position.set(tx, heightAt(tx, tz), tz); scene.add(T); T.updateMatrixWorld();
    const H = 13;
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.12, H, 0.12), darkSteel); l.position.set(sx * 0.9, H / 2, sz * 0.9); l.castShadow = true; T.add(l); }
    for (let y = 1; y < H; y += 1.6) for (let s = 0; s < 4; s++) {
      const br = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 2.5), darkSteel); const a = (s * Math.PI) / 2;
      br.position.set(Math.cos(a) * 0.9, y + 0.8, Math.sin(a) * 0.9); br.rotation.y = a + Math.PI / 2; br.rotation.x = 0.6; br.castShadow = true; T.add(br);
    }
    const deck = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.12, 2.6), steel); deck.position.y = H; deck.castShadow = true; T.add(deck);
    for (const off of [-0.7, 0.7]) {
      const lampHead = new THREE.Group(); lampHead.position.set(off, H + 0.6, -0.8); T.add(lampHead); lampHead.updateMatrixWorld(); lampHead.lookAt(new THREE.Vector3(off * 4 - 2, 0, 3 + off * 2));
      const housing = new THREE.Mesh(new RoundedBoxGeometry(0.8, 0.6, 0.35, 2, 0.05), darkSteel); housing.castShadow = true; lampHead.add(housing);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.5), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xe8f0ff, emissiveIntensity: 14 })); face.position.z = 0.18; lampHead.add(face);
      const sl = new THREE.SpotLight(0xdfe9ff, 900, 70, 0.32, 0.6, 2); sl.position.z = 0.2; lampHead.add(sl);
      const tg = new THREE.Object3D(); tg.position.z = 10; lampHead.add(tg); sl.target = tg;
      sl.castShadow = true; sl.shadow.mapSize.set(shadowRes * 2, shadowRes * 2); sl.shadow.bias = -0.0003; sl.shadow.normalBias = 0.03; sl.shadow.camera.near = 1;
      const b = lightBeam(0xd8e6ff, 30, 6.5, 0.12); b.mesh.rotation.x = -Math.PI / 2; b.mesh.position.z = 0.2; lampHead.add(b.mesh); beams.push(b);
      const gl = glare(0xe8f0ff, 3.2); gl.position.z = 0.3; lampHead.add(gl);
    }
    cable(new THREE.Vector3(-7, B.h + 13.5, B.z - 2), new THREE.Vector3(tx - 0.9, H - 0.5, tz), 2.2);
  }

  // patrol route through the yard (closed loop) — also drawn as a trodden path in the snow
  const patrol = [
    new THREE.Vector3(-10, 0, 9), new THREE.Vector3(2, 0, 10.5), new THREE.Vector3(11, 0, 2), new THREE.Vector3(7, 0, -6.5),
    new THREE.Vector3(-4, 0, -6), new THREE.Vector3(-12, 0, -1),
  ];
  trodden(scene, patrol, heightAt);
  for (const p of patrol) p.y = heightAt(p.x, p.z);
  return { heightAt, patrol, beams, blinkers, windows };
}

/** Packed path along the patrol loop: a ribbon of compacted snow with soft alpha edges. */
function trodden(scene: THREE.Scene, pts: THREE.Vector3[], heightAt: (x: number, z: number) => number): void {
  const curve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.3);
  const N = 400, w = 0.9; const pos: number[] = [], uv: number[] = [], idx: number[] = []; let len = 0; let prev = curve.getPoint(0);
  for (let i = 0; i <= N; i++) {
    const t = i / N; const p = curve.getPoint(t); len += p.distanceTo(prev); prev = p;
    const tan = curve.getTangent(t); const side = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
    for (const s of [-1, 1]) { const q = p.clone().addScaledVector(side, s * w); pos.push(q.x, heightAt(q.x, q.z) + 0.025, q.z); uv.push(s < 0 ? 0 : 1, len / 2); }
    if (i < N) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  const set = packedSnowSet(1);
  const m = pbrMaterial(set, { envIntensity: 0.5 }); m.transparent = true; m.depthWrite = false; m.polygonOffset = true; m.polygonOffsetFactor = -2;
  // soft edges + broken coverage (footfalls, not a road)
  m.onBeforeCompile = (s) => {
    s.fragmentShader = s.fragmentShader.replace('#include <alphamap_fragment>', `#include <alphamap_fragment>
      { float e = 1.0 - abs(vMapUv.x * 2.0 - 1.0); float stepN = fract(sin(dot(floor(vec2(vMapUv.x * 3.0, vMapUv.y * 3.5)), vec2(12.9898,78.233))) * 43758.5453);
        diffuseColor.a *= smoothstep(0.0, 0.6, e) * (0.55 + 0.45 * stepN); }`);
  };
  set.map.repeat.set(1, 1);
  const mesh = new THREE.Mesh(g, m); mesh.receiveShadow = true; mesh.renderOrder = 1; scene.add(mesh);
}
