import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { ClipAnimator, type LocoInput, type Weapon } from './ClipAnimator';
import { canRetarget, clipFor } from './Retarget';

/** A loaded character GLB: one skinned mesh, a humanoid skeleton and `Walk` / `Run` clips. */
export interface SkinnedSource { scene: THREE.Object3D; animations: THREE.AnimationClip[]; userData?: Record<string, unknown> }

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
  /** `sidearm.glb`, same convention; else the code-built sidearm. Only characters that switch weapons. */
  sidearmModel?: THREE.Object3D | null;
  sidearm?: boolean;
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
  /** The Mixamo clip library retargeted to this skeleton (xbot.glb present); else Walk/Run + posed arms. */
  readonly clips: ClipAnimator | null = null;
  private readonly pistol = new THREE.Group();
  /** Muzzle tips in each weapon's own space; `muzzle` moves between them on a swap. */
  private readonly tips = { rifle: new THREE.Vector3(), pistol: new THREE.Vector3() };
  /** Support-hand point on the rifle (rifle space): a `foregrip` node, else under the handguard. */
  private readonly foregrip = new THREE.Vector3();
  private weapon: Weapon = 'rifle';
  private ikW = 0;
  /** Rifle-space pistol-grip point (the right palm's contact). */
  private readonly gripPt = new THREE.Vector3();
  /** Rifle transform relative to the right hand, kept while the hands are busy (reload, throw…). */
  private readonly inHand = new THREE.Matrix4();
  private hasInHand = false;
  /**
   * Each hand, measured from the skinned mesh in the rest pose: `f` wrist → palm centre direction and
   * `p` palm normal (bone space), `len` that distance in model metres. Meshy palms sit ~12 cm out.
   */
  private readonly handAxes = new Map<THREE.Object3D, { f: THREE.Vector3; p: THREE.Vector3; len: number }>();

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

    if (canRetarget(src.scene)) {
      this.walk?.stop(); this.run?.stop();
      this.captureHandAxes();
      this.clips = new ClipAnimator(model, src.scene);
      if (opts.rifle !== false) {
        this.mountRifleInHand(src.scene, opts.rifleModel ?? null);
        if (opts.sidearm) this.mountPistolInHand(src.scene, opts.sidearmModel ?? null);
      } else { this.root.add(this.muzzle); this.muzzle.position.set(0, 1.4, 0.6); }
      return;
    }

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
   * Clip mode: the rifle rides the right hand. Solved once in the library's aim pose: grip in the
   * palm, barrel toward the support hand, top of the gun to the sky.
   */
  private mountRifleInHand(scene: THREE.Object3D, rifleModel: THREE.Object3D | null): void {
    let grip = GRIP;
    if (rifleModel) {
      this.rifle.add(rifleModel);
      const tip = rifleModel.getObjectByName('muzzle');
      this.muzzle.position.copy(tip ? tip.position : new THREE.Vector3(0, 0.05, 0.4));
      this.rifle.add(this.muzzle);
      rifleModel.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
      grip = new THREE.Vector3();
      const fg = rifleModel.getObjectByName('foregrip');
      this.foregrip.copy(fg ? fg.position : new THREE.Vector3(0, 0, this.muzzle.position.z * 0.5));
    } else { buildRifle(this.rifle, this.muzzle); this.foregrip.set(0, -0.035, 0.3); }
    this.gripPt.copy(grip);
    this.tips.rifle.copy(this.muzzle.position);
    const hand = this.bones.get('RightHand'), fore = this.bones.get('RightForeArm'), left = this.bones.get('LeftHand');
    const aim = clipFor(scene, 'idle_aim');
    if (!hand || !fore || !left || !aim) { this.root.add(this.rifle); return; }
    const act = this.mixer.clipAction(aim); act.play(); act.time = 0.3; this.mixer.update(0);
    this.root.updateMatrixWorld(true);
    const inv = this.root.matrixWorld.clone().invert();
    const w = hand.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv);
    const palm = w.clone().add(w.clone().sub(fore.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv)).normalize().multiplyScalar(PALM));
    const z = left.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv).sub(palm).normalize();
    const x = new THREE.Vector3(0, 1, 0).cross(z).normalize(), y = z.clone().cross(x);
    this.rifle.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    this.rifle.position.copy(palm).sub(grip.clone().applyQuaternion(this.rifle.quaternion));
    this.root.add(this.rifle); // placed every frame by placeRifle()
    act.stop(); this.mixer.uncacheAction(aim);
  }

  /** Sidearm in the right hand, solved from the library pistol stance: barrel along the body's forward. */
  private mountPistolInHand(scene: THREE.Object3D, model: THREE.Object3D | null): void {
    let grip = PISTOL_GRIP;
    const tip = new THREE.Object3D();
    if (model) {
      this.pistol.add(model);
      const m = model.getObjectByName('muzzle'); tip.position.copy(m ? m.position : new THREE.Vector3(0, 0.03, 0.17));
      model.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
      grip = new THREE.Vector3();
    } else buildPistol(this.pistol, tip);
    this.tips.pistol.copy(tip.position);
    const hand = this.bones.get('RightHand'), fore = this.bones.get('RightForeArm');
    const stance = clipFor(scene, 'pistol_idle');
    this.pistol.visible = false;
    if (!hand || !fore || !stance) { this.root.add(this.pistol); return; }
    const act = this.mixer.clipAction(stance); act.play(); act.time = 0.3; this.mixer.update(0);
    this.root.updateMatrixWorld(true);
    const inv = this.root.matrixWorld.clone().invert();
    const w = hand.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv);
    const palm = w.clone().add(w.clone().sub(fore.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv)).normalize().multiplyScalar(PALM));
    // the forearm points the gun: barrel continues the wrist line, levelled to the horizon
    const z = w.clone().sub(fore.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv)); z.y *= 0.3; z.normalize();
    const x = new THREE.Vector3(0, 1, 0).cross(z).normalize(), y = z.clone().cross(x);
    this.pistol.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    this.pistol.position.copy(palm).sub(grip.clone().applyQuaternion(this.pistol.quaternion));
    this.root.add(this.pistol);
    hand.attach(this.pistol);
    act.stop(); this.mixer.uncacheAction(stance);
  }

  /** Show `w` in hand and move the muzzle to it. */
  setWeapon(w: Weapon): void {
    if (w === this.weapon || (w === 'pistol' && !this.pistol.parent)) return;
    this.weapon = w;
    const g = w === 'pistol' ? this.pistol : this.rifle;
    this.rifle.visible = w === 'rifle'; this.pistol.visible = w === 'pistol';
    g.add(this.muzzle); this.muzzle.position.copy(this.tips[w]);
  }

  /** Clip mode: animate, then pin the support hand to the rifle's foregrip (two-bone IK on the left arm). */
  updateClips(dt: number, p: LocoInput): void {
    this.setWeapon(p.weapon);
    this.clips!.update(dt, p);
    if (this.weapon !== 'rifle' || this.rifle.parent !== this.root) return;
    const busy = this.clips!.handBusy;
    this.ikW += (1 - busy - this.ikW) * Math.min(1, dt * 14);
    this.root.updateMatrixWorld(true);
    this.placeRifle(this.ikW, p.aim);
    if (this.ikW < 0.01) return;
    this.rifle.updateMatrixWorld(true);
    const k = this.root.getWorldScale(V2).x;
    // gun axes in world: x = gun's left, y = up, z = forward
    const q = this.rifle.getWorldQuaternion(new THREE.Quaternion());
    const gx = new THREE.Vector3(1, 0, 0).applyQuaternion(q), gy = new THREE.Vector3(0, 1, 0).applyQuaternion(q), gz = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
    // right hand: palm against the grip's right side, fingers forward and down along it
    const rP = gx.clone(), rF = gz.clone().addScaledVector(gy, -0.5).normalize();
    const rC = this.rifle.localToWorld(this.gripPt.clone()).addScaledVector(gx, -0.022 * k);
    this.reach('Right', rC, rF, rP, k, this.ikW);
    // left hand: C-clamp, palm on the handguard's lower left side, fingers along it toward the muzzle
    const lF = gz.clone(), lP = gx.clone().multiplyScalar(-0.75).addScaledVector(gy, 0.66).normalize();
    const lC = this.rifle.localToWorld(this.foregrip.clone()).addScaledVector(gx, 0.024 * k).addScaledVector(gy, -0.012 * k);
    this.reach('Left', lC, lF, lP, k, this.ikW);
  }

  /**
   * Put the rifle where the clip's hands say it is: grip at the right palm, barrel through the left
   * palm, top to the sky. While the hands are busy it rides the right hand from its last solve.
   */
  private placeRifle(w: number, aim = 0): void {
    const rh = this.bones.get('RightHand'), rf = this.bones.get('RightForeArm'), lh = this.bones.get('LeftHand'), lf = this.bones.get('LeftForeArm');
    if (!rh || !rf || !lh || !lf) return;
    const inv = this.root.matrixWorld.clone().invert();
    const palm = (h: THREE.Object3D, f: THREE.Object3D) => {
      const ax = this.handAxes.get(h);
      if (ax) return h.getWorldPosition(new THREE.Vector3()).add(ax.f.clone().applyQuaternion(h.getWorldQuaternion(new THREE.Quaternion())).multiplyScalar(ax.len * this.root.getWorldScale(V1).x)).applyMatrix4(inv);
      const a = h.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv), b = f.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv); return a.add(a.clone().sub(b).normalize().multiplyScalar(PALM));
    };
    const R = palm(rh, rf), L = palm(lh, lf);
    const z = L.sub(R); if (z.z < 0.05) z.z = 0.05; z.normalize();
    // aiming: the barrel goes level down the sight line, whatever pitch the clip's hands imply
    z.y *= 1 - 0.85 * THREE.MathUtils.clamp(aim, 0, 1); z.normalize();
    const x = new THREE.Vector3(0, 1, 0).cross(z).normalize(), y = z.clone().cross(x);
    const solved = new THREE.Matrix4().makeBasis(x, y, z);
    solved.setPosition(R.sub(this.gripPt.clone().applyMatrix4(new THREE.Matrix4().extractRotation(solved))));
    // carried = right hand (root space) · offset from the last solve
    const handM = inv.clone().multiply(rh.matrixWorld);
    let final = solved;
    if (this.hasInHand && w < 0.999) {
      const carried = handM.clone().multiply(this.inHand);
      const pa = new THREE.Vector3(), qa = new THREE.Quaternion(), sa = new THREE.Vector3(), pb = new THREE.Vector3(), qb = new THREE.Quaternion();
      carried.decompose(pa, qa, sa); solved.decompose(pb, qb, sa);
      final = new THREE.Matrix4().compose(pa.lerp(pb, w), qa.slerp(qb, w), new THREE.Vector3(1, 1, 1));
    }
    final.decompose(this.rifle.position, this.rifle.quaternion, V0); this.rifle.scale.set(1, 1, 1);
    this.inHand.copy(handM.invert().multiply(final)); this.hasInHand = true;
  }

  /** Two-bone IK the `side` arm so the palm lands on `contact`, then turn the hand to fingers `F`, palm `P`. */
  private reach(side: 'Left' | 'Right', contact: THREE.Vector3, F: THREE.Vector3, P: THREE.Vector3, k: number, w: number): void {
    const a = this.bones.get(`${side}Arm`), b = this.bones.get(`${side}ForeArm`), c = this.bones.get(`${side}Hand`);
    const ax = c && this.handAxes.get(c);
    if (!a || !b || !c || !ax) return;
    P = P.clone().sub(F.clone().multiplyScalar(P.dot(F))).normalize(); // keep the basis square
    const want = basisQuat(F, P).multiply(basisQuat(ax.f, ax.p).invert()); // world hand rotation
    // the palm centre lands on the surface: wrist = contact − (wrist → centre) − half the hand's thickness
    const wrist = contact.clone().addScaledVector(F, -ax.len * k).addScaledVector(P, -HAND_HALF_THICK * k);
    solveTwoBone(a, b, c, wrist, w);
    const pw = c.parent!.getWorldQuaternion(new THREE.Quaternion());
    const local = pw.invert().multiply(want);
    c.quaternion.slerp(local, w);
    c.updateMatrixWorld(true);
  }

  /**
   * Rest pose, from the mesh itself: the palm centre is the mean of the vertices the hand bone owns,
   * the palm normal faces the thigh (inward). Falls back to the forearm line with no skin data.
   */
  private captureHandAxes(): void {
    this.root.updateMatrixWorld(true);
    let mesh: THREE.SkinnedMesh | undefined;
    this.root.traverse((o) => { if (!mesh && (o as THREE.SkinnedMesh).isSkinnedMesh) mesh = o as THREE.SkinnedMesh; });
    const rootInv = this.root.matrixWorld.clone().invert();
    for (const side of ['Left', 'Right'] as const) {
      const h = this.bones.get(`${side}Hand`), f = this.bones.get(`${side}ForeArm`);
      if (!h || !f) continue;
      const hw = h.getWorldPosition(new THREE.Vector3());
      let centre: THREE.Vector3 | null = null;
      if (mesh) {
        const sk = mesh.skeleton, bi = sk.bones.indexOf(h as THREE.Bone);
        const g = mesh.geometry, pos = g.attributes.position, si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
        if (bi >= 0 && si && sw) {
          const sum = new THREE.Vector3(), v = new THREE.Vector3(); let n = 0;
          for (let i = 0; i < pos.count; i++) for (let j = 0; j < 4; j++) {
            if (si.getComponent(i, j) === bi && sw.getComponent(i, j) > 0.6) { mesh.getVertexPosition(i, v); sum.add(v.applyMatrix4(mesh.matrixWorld)); n++; break; }
          }
          if (n > 20) centre = sum.multiplyScalar(1 / n);
        }
      }
      if (!centre) centre = hw.clone().add(hw.clone().sub(f.getWorldPosition(new THREE.Vector3())).normalize().multiplyScalar(PALM));
      const fw = centre.clone().sub(hw);
      const len = fw.clone().transformDirection(rootInv).length() > 0 ? centre.clone().applyMatrix4(rootInv).distanceTo(hw.clone().applyMatrix4(rootInv)) : PALM;
      fw.normalize();
      const inward = new THREE.Vector3(side === 'Left' ? -1 : 1, 0, 0).transformDirection(this.root.matrixWorld); // character's left is +X
      const pw = inward.sub(fw.clone().multiplyScalar(inward.dot(fw))).normalize();
      const inv = h.getWorldQuaternion(new THREE.Quaternion()).invert();
      this.handAxes.set(h, { f: fw.applyQuaternion(inv), p: pw.applyQuaternion(inv), len });
    }
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

const V0 = new THREE.Vector3(), V1 = new THREE.Vector3(), V2 = new THREE.Vector3();
/** Palm centre to palm surface (m). */
const HAND_HALF_THICK = 0.018;

/**
 * Analytic two-bone IK (law of cosines) in world space: bend the elbow to the shoulder→target
 * distance in the arm's current plane, then swing the shoulder onto the target. Blended by `w`.
 */
function solveTwoBone(a: THREE.Object3D, b: THREE.Object3D, c: THREE.Object3D, t: THREE.Vector3, w: number): void {
  const qa = a.quaternion.clone(), qb = b.quaternion.clone();
  const pa = a.getWorldPosition(new THREE.Vector3()), pb = b.getWorldPosition(new THREE.Vector3()), pc = c.getWorldPosition(new THREE.Vector3());
  const lab = pb.distanceTo(pa), lcb = pc.distanceTo(pb);
  const lat = THREE.MathUtils.clamp(t.distanceTo(pa), 0.01, lab + lcb - 1e-3);
  const ac = pc.clone().sub(pa), ab = pb.clone().sub(pa), ba = pa.clone().sub(pb), bc = pc.clone().sub(pb);
  const cur0 = ac.angleTo(ab), cur1 = ba.angleTo(bc);
  const want0 = Math.acos(THREE.MathUtils.clamp((lcb * lcb - lab * lab - lat * lat) / (-2 * lab * lat), -1, 1));
  const want1 = Math.acos(THREE.MathUtils.clamp((lat * lat - lab * lab - lcb * lcb) / (-2 * lab * lcb), -1, 1));
  const axis = ac.clone().cross(ab);
  if (axis.lengthSq() < 1e-10) return; // arm dead straight: no plane to bend in
  axis.normalize();
  rotateWorld(a, new THREE.Quaternion().setFromAxisAngle(axis, want0 - cur0));
  rotateWorld(b, new THREE.Quaternion().setFromAxisAngle(axis, want1 - cur1));
  a.updateMatrixWorld(true);
  const pc2 = c.getWorldPosition(new THREE.Vector3());
  rotateWorld(a, new THREE.Quaternion().setFromUnitVectors(pc2.sub(pa).normalize(), t.clone().sub(pa).normalize()));
  if (w < 1) { a.quaternion.copy(qa.slerp(a.quaternion, w)); b.quaternion.copy(qb.slerp(b.quaternion, w)); }
  a.updateMatrixWorld(true);
}
/** Rotation taking the standard basis to (F, P, F×P). */
function basisQuat(F: THREE.Vector3, P: THREE.Vector3): THREE.Quaternion {
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(F, P, F.clone().cross(P)));
}

/** Apply a world-space rotation to a bone, in its local frame. */
function rotateWorld(o: THREE.Object3D, q: THREE.Quaternion): void {
  const pw = o.parent ? o.parent.getWorldQuaternion(new THREE.Quaternion()) : new THREE.Quaternion();
  o.quaternion.premultiply(pw.clone().invert().multiply(q).multiply(pw));
  o.updateMatrixWorld(true);
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

/** Grip centre of the code-built sidearm in its own space (see buildPistol). */
const PISTOL_GRIP = new THREE.Vector3(0, -0.055, -0.01);

/** Stand-in compact sidearm with suppressor (replaced when `sidearm.glb` exists). Points along +Z. */
function buildPistol(g: THREE.Group, muzzle: THREE.Object3D): void {
  const metal = new THREE.MeshStandardMaterial({ color: 0x1c1f23, roughness: 0.4, metalness: 0.75 });
  const poly = new THREE.MeshStandardMaterial({ color: 0x25292d, roughness: 0.8, metalness: 0.05 });
  const box = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number, rx = 0) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.rotation.x = rx; b.castShadow = true; g.add(b); return b; };
  box(0.03, 0.032, 0.19, metal, 0, 0.012, 0.045); // slide
  box(0.028, 0.022, 0.15, poly, 0, -0.012, 0.035); // frame / dust cover
  box(0.028, 0.1, 0.045, poly, 0, -0.06, -0.012, -0.22); // grip
  box(0.022, 0.012, 0.05, poly, 0, -0.03, 0.03); // trigger guard
  box(0.006, 0.008, 0.012, metal, 0, 0.032, -0.04); // rear sight
  box(0.004, 0.008, 0.006, metal, 0, 0.032, 0.13); // front sight
  const can = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.13, 12), metal);
  can.rotation.x = Math.PI / 2; can.position.set(0, 0.012, 0.2); can.castShadow = true; g.add(can); // suppressor
  muzzle.position.set(0, 0.012, 0.27); g.add(muzzle);
}
