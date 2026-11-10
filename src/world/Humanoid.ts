import * as THREE from 'three';
import { PALETTE } from '../../data/palette';
import { applyOverride, skinnedOverride } from './ModelOverrides';
import { SkinnedHuman } from './SkinnedHuman';

export type HumanStyle = 'ballast' | 'trooper' | 'spotter' | 'heavy';

export interface HumanRig {
  root: THREE.Group;
  body: THREE.Group;
  hips: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  armL: THREE.Group; foreL: THREE.Group;
  armR: THREE.Group; foreR: THREE.Group;
  legL: THREE.Group; shinL: THREE.Group;
  legR: THREE.Group; shinR: THREE.Group;
  gun: THREE.Group;
  visor: THREE.Mesh;
  muzzle: THREE.Object3D;
  /** Set when a rigged GLB replaces the box figure; the animator then drives it instead of the pivots. */
  skin: SkinnedHuman | null;
  mats: { armor: THREE.MeshStandardMaterial; under: THREE.MeshStandardMaterial; visor: THREE.MeshStandardMaterial };
  /** Head sphere for hit tests, local to root. */
  headOffset: number;
}

const STYLES: Record<HumanStyle, { armor: number; under: number; visor: number; visorI: number; scale: number; bulk: number }> = {
  ballast: { armor: 0x8d99a6, under: 0x3c4650, visor: PALETTE.cyan, visorI: 2.4, scale: 1, bulk: 1 },
  trooper: { armor: 0xa7adb3, under: 0x3a3f45, visor: PALETTE.red, visorI: 2.6, scale: 1, bulk: 1 },
  spotter: { armor: 0x6f777f, under: 0x23272b, visor: PALETTE.red, visorI: 3.2, scale: 1, bulk: 0.92 },
  heavy: { armor: 0x6e757c, under: 0x2c3035, visor: PALETTE.red, visorI: 2.8, scale: 1.14, bulk: 1.45 },
};

function part(w: number, h: number, d: number, m: THREE.Material, y = -h / 2): THREE.Mesh {
  const g = new THREE.BoxGeometry(w, h, d); g.translate(0, y, 0);
  const mesh = new THREE.Mesh(g, m); mesh.castShadow = true; return mesh;
}
function pivot(parent: THREE.Object3D, x: number, y: number, z: number): THREE.Group { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }

/** Procedural helmeted humanoid (stand-in for hero/enemy GLBs; manifest overrides drop in). */
export function buildHumanoid(style: HumanStyle): HumanRig {
  const S = STYLES[style];
  const armor = new THREE.MeshStandardMaterial({ color: S.armor, roughness: 0.5, metalness: 0.2 });
  const under = new THREE.MeshStandardMaterial({ color: S.under, roughness: 0.8, metalness: 0.1 });
  const visorM = new THREE.MeshStandardMaterial({ color: 0x050505, emissive: S.visor, emissiveIntensity: S.visorI, roughness: 0.2 });
  const b = S.bulk;
  const root = new THREE.Group();
  const body = pivot(root, 0, 0, 0);
  body.scale.setScalar(S.scale);
  const hips = pivot(body, 0, 0.98, 0);
  hips.add(part(0.36 * b, 0.2, 0.22 * b, under, 0));
  const torso = pivot(hips, 0, 0.08, 0);
  torso.add(part(0.46 * b, 0.56, 0.28 * b, armor, 0.28));
  torso.add(part(0.34 * b, 0.3, 0.12, under, 0.36).translateZ(0.17 * b)); // pack
  const pad = part(0.16 * b, 0.12, 0.3 * b, armor, 0); pad.position.set(-0.3 * b, 0.52, 0); torso.add(pad);
  const pad2 = pad.clone(); pad2.position.x = 0.3 * b; torso.add(pad2);
  const head = pivot(torso, 0, 0.6, 0);
  head.add(part(0.26, 0.28, 0.3, armor, 0.14));
  const visor = part(0.22, 0.07, 0.04, visorM, 0); visor.position.set(0, 0.16, -0.155); head.add(visor);
  const mkArm = (side: number) => {
    const sh = pivot(torso, side * 0.3 * b, 0.48, 0);
    sh.add(part(0.13 * b, 0.32, 0.13 * b, under));
    const fore = pivot(sh, 0, -0.32, 0);
    fore.add(part(0.12 * b, 0.3, 0.12 * b, armor));
    return [sh, fore] as const;
  };
  const [armL, foreL] = mkArm(-1);
  const [armR, foreR] = mkArm(1);
  const mkLeg = (side: number) => {
    const th = pivot(hips, side * 0.11 * b, -0.02, 0);
    th.add(part(0.16 * b, 0.46, 0.17 * b, under));
    const sh = pivot(th, 0, -0.46, 0);
    sh.add(part(0.15 * b, 0.48, 0.18 * b, armor));
    sh.add(part(0.15 * b, 0.08, 0.26 * b, under, -0.46).translateZ(-0.04));
    return [th, sh] as const;
  };
  const [legL, shinL] = mkLeg(-1);
  const [legR, shinR] = mkLeg(1);
  const gun = pivot(foreR, 0, -0.26, -0.04);
  const gunM = new THREE.MeshStandardMaterial({ color: 0x15181b, roughness: 0.5, metalness: 0.6 });
  const longGun = style !== 'ballast';
  gun.add(part(0.07, 0.12, longGun ? 0.7 : 0.26, gunM, 0).translateZ(longGun ? -0.25 : -0.08));
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0, longGun ? -0.62 : -0.24); gun.add(muzzle);
  if (style === 'heavy') { const drum = part(0.16, 0.16, 0.16, gunM, 0); drum.position.set(0, -0.1, -0.1); gun.add(drum); }
  if (style === 'spotter') { const scope = part(0.05, 0.05, 0.22, visorM, 0); scope.position.set(0, 0.08, -0.2); gun.add(scope); }
  // Sable variants without their own model wear the trooper's until theirs arrives.
  const src = skinnedOverride(style) ?? (style !== 'ballast' ? skinnedOverride('trooper') : null);
  let skin: SkinnedHuman | null = null;
  if (src) {
    skin = new SkinnedHuman(src, { visor: S.visor, visorIntensity: S.visorI * 1.4 });
    root.traverse((c) => { if ((c as THREE.Mesh).isMesh) c.visible = false; });
    const facing = new THREE.Group(); facing.rotation.y = Math.PI; facing.add(skin.root); // rigs face −Z, GLBs +Z
    body.add(facing);
  } else applyOverride(root, style);
  return { root, body, hips, torso, head, armL, foreL, armR, foreR, legL, shinL, legR, shinR, gun, visor, muzzle: skin ? skin.muzzle : muzzle, skin, mats: { armor, under, visor: visorM }, headOffset: 1.62 * S.scale };
}

export interface HumanPose {
  speed: number;
  maxSpeed: number;
  crouch: number;
  aim: number;
  slide: number;
  mantle: number;
  dead: number;
  stun: number;
  lean: number;
  attack: number;
}

/** Procedural animation: gait from speed, crouch, aim stance, slide, mantle, death fall. */
export class HumanAnimator {
  private phase = 0;
  readonly pose: HumanPose = { speed: 0, maxSpeed: 7.5, crouch: 0, aim: 0, slide: 0, mantle: 0, dead: 0, stun: 0, lean: 0, attack: 0 };
  constructor(readonly rig: HumanRig) {}

  update(dt: number): void {
    const p = this.pose, r = this.rig;
    const s01 = Math.min(1, p.speed / Math.max(0.1, p.maxSpeed));
    const cadence = 1.6 + s01 * 1.6;
    this.phase += dt * cadence * Math.PI * 2 * (p.speed > 0.15 ? 1 : 0);
    const sw = Math.sin(this.phase) * (0.25 + s01 * 0.65) * (p.speed > 0.15 ? 1 : 0);
    const bob = Math.abs(Math.cos(this.phase)) * 0.05 * s01;
    const c = p.crouch;
    r.hips.position.y = 0.98 - c * 0.36 - p.slide * 0.55 + bob - p.dead * 0.75;
    r.legL.rotation.x = sw - c * 0.9 - p.slide * 1.3;
    r.legR.rotation.x = -sw - c * 0.9 + p.slide * 0.2;
    r.shinL.rotation.x = Math.max(0, -Math.sin(this.phase + 1.2)) * 0.9 * s01 + c * 1.5 + p.slide * 0.4;
    r.shinR.rotation.x = Math.max(0, Math.sin(this.phase + 1.2)) * 0.9 * s01 + c * 1.5 + p.slide * 1.4;
    r.torso.rotation.x = -0.08 - s01 * 0.22 - c * 0.25 + p.slide * 0.45 + p.dead * 0.2;
    r.torso.rotation.z = p.lean * 0.15;
    const aim = p.aim;
    r.armR.rotation.x = (1 - aim) * (-sw * 0.6 - 0.2) + aim * -1.45 - p.attack * 1.2;
    r.armL.rotation.x = (1 - aim) * (sw * 0.6 - 0.2) + aim * -1.25 - p.mantle * 2.6 - p.attack * 0.4;
    r.armL.rotation.z = aim * 0.5;
    r.foreR.rotation.x = -0.3 - aim * 0.1 - p.attack * 0.5;
    r.foreL.rotation.x = -0.4 - aim * 0.4 - p.mantle * 0.3;
    r.head.rotation.x = aim * 0.05 + p.stun * Math.sin(this.phase * 0.2 + performance.now() * 0.006) * 0.4;
    r.body.rotation.x = -p.dead * 1.45;
    r.body.position.y = p.dead * 0.12;
    if (r.skin) { r.skin.root.rotation.x = c * 0.3 + p.stun * 0.25; r.skin.update(dt, p.dead > 0.05 ? 0 : p.speed, p.aim * (1 - p.stun)); }
  }
}

export function buildDrone(): { root: THREE.Group; eye: THREE.Mesh; beam: THREE.Mesh } {
  const root = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: 0x5d646b, roughness: 0.4, metalness: 0.7 });
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 0.22, 10), m); disc.castShadow = true; root.add(disc);
  for (const a of [0, 1, 2, 3]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, 0.1), m); arm.rotation.y = (a * Math.PI) / 2 + Math.PI / 4; root.add(arm);
    const rotor = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.02, 12), new THREE.MeshBasicMaterial({ color: 0x9aa3ab, transparent: true, opacity: 0.35 }));
    rotor.position.set(Math.cos((a * Math.PI) / 2 + Math.PI / 4) * 0.9, 0.06, -Math.sin((a * Math.PI) / 2 + Math.PI / 4) * 0.9); root.add(rotor);
  }
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), new THREE.MeshStandardMaterial({ color: 0x050505, emissive: PALETTE.red, emissiveIntensity: 3 }));
  eye.position.y = -0.14; root.add(eye);
  const beamG = new THREE.ConeGeometry(1, 1, 24, 1, true); beamG.translate(0, -0.5, 0);
  const beam = new THREE.Mesh(beamG, new THREE.MeshBasicMaterial({ color: PALETTE.red, transparent: true, opacity: 0.08, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  root.add(beam);
  return { root, eye, beam };
}

export function buildHound(): { root: THREE.Group; legs: THREE.Group[]; head: THREE.Group; eye: THREE.Mesh } {
  const root = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: 0x3e444a, roughness: 0.5, metalness: 0.6 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.36, 1.2), m); body.position.y = 0.72; body.castShadow = true; root.add(body);
  const head = new THREE.Group(); head.position.set(0, 0.86, -0.7); root.add(head);
  head.add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.26, 0.42), m));
  const eye = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 0.04), new THREE.MeshStandardMaterial({ color: 0x050505, emissive: PALETTE.red, emissiveIntensity: 3 }));
  eye.position.set(0, 0.04, -0.22); head.add(eye);
  const legs: THREE.Group[] = [];
  for (const [x, z] of [[-0.22, -0.45], [0.22, -0.45], [-0.22, 0.45], [0.22, 0.45]] as const) {
    const g = new THREE.Group(); g.position.set(x, 0.66, z); root.add(g);
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.66, 0.12), m); l.position.y = -0.33; l.castShadow = true; g.add(l);
    legs.push(g);
  }
  return { root, legs, head, eye };
}
