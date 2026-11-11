import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

/** A loaded character GLB: one skinned mesh, a humanoid skeleton and `Walk` / `Run` clips. */
export interface SkinnedSource { scene: THREE.Object3D; animations: THREE.AnimationClip[] }

export function isSkinned(o: THREE.Object3D): boolean {
  let found = false;
  o.traverse((c) => { if ((c as THREE.SkinnedMesh).isSkinnedMesh) found = true; });
  return found;
}

/** Ground speeds (m/s) the clips were authored at; playback rate follows actual speed. */
const WALK_REF = 1.45, RUN_REF = 4.4;
const D = Math.PI / 180;

/**
 * Upper-body poses, as model-space rotations (degrees; applied Z, then X, then Y) on top of the
 * A-pose, parent first. Model space: +Y up, +Z front, the character's left is +X.
 */
type PoseSpec = [bone: string, x: number, y: number, z: number][];
const LOW_READY: PoseSpec = [
  ['RightArm', -8, 0, 38], ['RightForeArm', -62, 38, 0], ['RightHand', 0, 0, 0],
  ['LeftArm', -30, -8, -30], ['LeftForeArm', -48, -62, 0], ['LeftHand', 0, 0, 0],
];
const AIM: PoseSpec = [
  ['RightArm', -38, 6, 34], ['RightForeArm', -78, 52, 0], ['RightHand', 0, 0, 0],
  ['LeftArm', -66, -14, -26], ['LeftForeArm', -22, -48, 0], ['LeftHand', 0, 0, 0],
];
interface RiflePose { pos: [number, number, number]; yaw: number; pitch: number }
const RIFLE_LOW: RiflePose = { pos: [-0.07, 1.13, 0.24], yaw: 38, pitch: 34 };
const RIFLE_AIM: RiflePose = { pos: [-0.12, 1.43, 0.2], yaw: 0, pitch: 0 };

export interface SkinnedOptions {
  visor: number; visorIntensity: number; tint?: number; rifle?: boolean;
  /** `rifle_sable.glb` in rifle space (+Z forward, origin at the grip, a `muzzle` node); else the box stand-in. */
  rifleModel?: THREE.Object3D | null;
}

/**
 * A skinned character instance. Legs and torso come from the clips (blended by ground speed); the
 * arms hold a rifle in a low-ready pose that raises to the shoulder as `aim` goes 0 → 1. With no
 * speed the body settles on its rest pose plus a slow breath. `root` faces +Z.
 */
export class SkinnedHuman {
  readonly root = new THREE.Group();
  readonly muzzle = new THREE.Object3D();
  private readonly mixer: THREE.AnimationMixer;
  private readonly walk: THREE.AnimationAction | null;
  private readonly run: THREE.AnimationAction | null;
  private readonly bones = new Map<string, THREE.Bone>();
  private readonly low = new Map<THREE.Bone, THREE.Quaternion>();
  private readonly high = new Map<THREE.Bone, THREE.Quaternion>();
  private readonly rifle = new THREE.Group();
  private readonly rifleLow = { p: new THREE.Vector3(), q: new THREE.Quaternion() };
  private readonly rifleHigh = { p: new THREE.Vector3(), q: new THREE.Quaternion() };
  private walkW = 0; private runW = 0; private t = 0; private breath = 0;

  constructor(src: SkinnedSource, opts: SkinnedOptions) {
    const model = cloneSkinned(src.scene);
    this.root.add(model);
    model.traverse((o) => {
      if ((o as THREE.Bone).isBone) this.bones.set(o.name, o as THREE.Bone);
      const m = o as THREE.SkinnedMesh; if (!m.isMesh) return;
      m.castShadow = true; m.receiveShadow = true;
      // cull by a fixed sphere roomy enough for any pose, so off-screen troopers cost nothing
      // Skinned vertices are already in model metres, but three culls with the mesh node's own
      // transform too (Meshy's carries a 0.01 scale), which shrank the sphere to ~1.5 cm at the
      // feet: the body vanished whenever the feet left the frame. Undo that scale on the bounds.
      if (m.isSkinnedMesh) {
        m.computeBoundingSphere(); m.computeBoundingBox();
        const k = 1 / nodeScale(m, this.root);
        m.boundingSphere!.center.multiplyScalar(k); m.boundingSphere!.radius *= 1.5 * k;
        m.boundingBox!.min.multiplyScalar(k); m.boundingBox!.max.multiplyScalar(k);
        m.boundingBox!.expandByScalar(m.boundingSphere!.radius * 0.5);
      }
      const mat = (m.material as THREE.MeshStandardMaterial).clone();
      if (opts.tint !== undefined) mat.color.set(opts.tint);
      if (mat.emissiveMap) { mat.emissive.set(opts.visor); mat.emissiveIntensity = opts.visorIntensity; }
      m.material = mat;
    });
    this.mixer = new THREE.AnimationMixer(model);
    const action = (name: string) => { const c = src.animations.find((a) => a.name === name); if (!c) return null; const a = this.mixer.clipAction(c); a.play(); a.setEffectiveWeight(0); return a; };
    this.walk = action('Walk'); this.run = action('Run');

    this.root.updateMatrixWorld(true);
    this.capture(LOW_READY, this.low); this.capture(AIM, this.high);
    const spine = this.bones.get('Spine');
    if (opts.rifle !== false && spine) {
      let grip = GRIP;
      if (opts.rifleModel) {
        this.rifle.add(opts.rifleModel);
        const tip = opts.rifleModel.getObjectByName('muzzle');
        this.muzzle.position.copy(tip ? tip.position : new THREE.Vector3(0, 0.05, 0.4));
        this.rifle.add(this.muzzle);
        opts.rifleModel.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; } });
        grip = new THREE.Vector3(); // the GLB's origin is its grip
      } else buildRifle(this.rifle, this.muzzle);
      this.root.add(this.rifle);
      for (const [pose, out, arms] of [[RIFLE_LOW, this.rifleLow, this.low], [RIFLE_AIM, this.rifleHigh, this.high]] as const) {
        this.rifle.position.set(...pose.pos);
        this.rifle.rotation.set(pose.pitch * D, pose.yaw * D, 0, 'YXZ');
        // Seat the grip in the posed right hand, so the rifle fits any body, not just the trooper's.
        const hand = this.handInPose(arms);
        if (hand) this.rifle.position.copy(hand).sub(grip.clone().applyQuaternion(this.rifle.quaternion));
        this.rifle.scale.setScalar(1);
        spine.attach(this.rifle); // keeps the model-space placement, now riding the chest
        out.p.copy(this.rifle.position); out.q.copy(this.rifle.quaternion);
        this.root.attach(this.rifle);
      }
      spine.attach(this.rifle);
    } else this.root.add(this.muzzle), this.muzzle.position.set(0, 1.4, 0.6);
  }

  /**
   * Model-space palm position with `pose` applied: a little past the wrist joint, along the
   * forearm. Null without a right arm chain.
   */
  private handInPose(pose: Map<THREE.Bone, THREE.Quaternion>): THREE.Vector3 | null {
    const hand = this.bones.get('RightHand'), fore = this.bones.get('RightForeArm');
    if (!hand || !fore) return null;
    const rest = new Map([...pose.keys()].map((b) => [b, b.quaternion.clone()]));
    for (const [b, q] of pose) b.quaternion.copy(q);
    this.root.updateMatrixWorld(true);
    const inv = this.root.matrixWorld.clone().invert();
    const w = hand.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv);
    const e = fore.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv);
    const palm = w.clone().add(w.clone().sub(e).normalize().multiplyScalar(PALM));
    for (const [b, q] of rest) b.quaternion.copy(q);
    this.root.updateMatrixWorld(true);
    return palm;
  }

  /** Records the bone-local rotations that produce a model-space pose, then restores the rest pose. */
  private capture(spec: PoseSpec, out: Map<THREE.Bone, THREE.Quaternion>): void {
    const rest = new Map<THREE.Bone, THREE.Quaternion>();
    const inv = this.root.getWorldQuaternion(new THREE.Quaternion()).invert();
    const parentQ = new THREE.Quaternion(), delta = new THREE.Quaternion(), axis = new THREE.Quaternion();
    for (const [name, x, y, z] of spec) {
      const b = this.bones.get(name); if (!b || !b.parent) continue;
      rest.set(b, b.quaternion.clone());
      delta.setFromAxisAngle(new THREE.Vector3(0, 0, 1), z * D)
        .premultiply(axis.setFromAxisAngle(new THREE.Vector3(1, 0, 0), x * D))
        .premultiply(axis.setFromAxisAngle(new THREE.Vector3(0, 1, 0), y * D));
      b.parent.updateWorldMatrix(true, false);
      b.parent.getWorldQuaternion(parentQ).premultiply(inv); // parent orientation in model space
      b.quaternion.premultiply(parentQ.clone().invert().multiply(delta).multiply(parentQ));
      out.set(b, b.quaternion.clone());
    }
    for (const [b, q] of rest) b.quaternion.copy(q);
    this.root.updateMatrixWorld(true);
  }

  update(dt: number, speed: number, aim: number): void {
    this.t += dt;
    const moving = THREE.MathUtils.clamp(speed / 0.5, 0, 1);
    const runK = THREE.MathUtils.smoothstep(speed, WALK_REF * 1.25, RUN_REF * 0.8);
    const k = Math.min(1, dt * 9);
    this.walkW += (moving * (1 - runK) - this.walkW) * k;
    this.runW += (moving * runK - this.runW) * k;
    if (this.walk) { this.walk.setEffectiveWeight(this.walkW); this.walk.timeScale = THREE.MathUtils.clamp(speed / WALK_REF, 0.6, 1.5); }
    if (this.run) { this.run.setEffectiveWeight(this.runW); this.run.timeScale = THREE.MathUtils.clamp(speed / RUN_REF, 0.75, 1.25); }
    // the breath is additive on whatever the mixer leaves in the chest, so last frame's is taken off first
    const spine = this.bones.get('Spine');
    if (spine) spine.quaternion.multiply(TMP_Q.setFromAxisAngle(X_AXIS, -this.breath));
    this.mixer.update(dt);
    this.breath = Math.sin(this.t * 1.3) * 0.018 * (1 - Math.min(1, this.walkW + this.runW));
    if (spine) spine.quaternion.multiply(TMP_Q.setFromAxisAngle(X_AXIS, this.breath));
    const a = THREE.MathUtils.clamp(aim, 0, 1);
    for (const [b, q] of this.low) b.quaternion.copy(q).slerp(this.high.get(b)!, a);
    if (this.rifle.parent) {
      this.rifle.position.copy(this.rifleLow.p).lerp(this.rifleHigh.p, a);
      this.rifle.quaternion.copy(this.rifleLow.q).slerp(this.rifleHigh.q, a);
    }
  }
}

/** Pistol-grip centre of the box stand-in in rifle space (see buildRifle), and wrist → palm distance (m). */
const GRIP = new THREE.Vector3(0, -0.08, -0.08);
const PALM = 0.07;
/** Uniform scale of `o` relative to `root` (the model's own units). */
function nodeScale(o: THREE.Object3D, root: THREE.Object3D): number {
  root.updateMatrixWorld(true);
  const m = new THREE.Matrix4().copy(root.matrixWorld).invert().multiply(o.matrixWorld);
  return new THREE.Vector3().setFromMatrixScale(m).x || 1;
}

const TMP_Q = new THREE.Quaternion();
const X_AXIS = new THREE.Vector3(1, 0, 0);

/** Stand-in service rifle (replaced when `rifle_sable.glb` exists). Points along +Z. */
function buildRifle(g: THREE.Group, muzzle: THREE.Object3D): void {
  const metal = new THREE.MeshStandardMaterial({ color: 0x191c20, roughness: 0.45, metalness: 0.7 });
  const poly = new THREE.MeshStandardMaterial({ color: 0x22262a, roughness: 0.75, metalness: 0.1 });
  const box = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = true; g.add(b); return b; };
  box(0.05, 0.075, 0.34, metal, 0, 0, 0.02); // receiver
  box(0.045, 0.06, 0.24, poly, 0, 0, 0.3); // handguard
  box(0.045, 0.09, 0.22, poly, 0, -0.012, -0.26); // stock
  box(0.03, 0.17, 0.055, metal, 0, -0.11, 0.06).rotation.x = 0.2; // magazine
  box(0.035, 0.1, 0.045, poly, 0, -0.08, -0.08).rotation.x = -0.3; // grip
  box(0.03, 0.035, 0.12, metal, 0, 0.058, 0.05); // optic
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.2, 8), metal); barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.008, 0.52); barrel.castShadow = true; g.add(barrel);
  muzzle.position.set(0, 0.008, 0.63); g.add(muzzle);
}
