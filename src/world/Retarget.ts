import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { skinnedOverride } from './ModelOverrides';

/**
 * Plays the shared Mixamo clip library (xbot.glb, manifest id `human`) on any humanoid skeleton
 * with Mixamo-style bone names: Meshy's 24-bone rig, a Mixamo-rigged character, or the X Bot.
 *
 * Per bone: T_world(t) = S_world(t) · inv(S_rest) · A · T_rest, where A turns the target's rest
 * bone onto the source's rest direction (A-pose arms → Mixamo T-pose). Twist is left as authored.
 * Hips translation is scaled by leg length. Clips are built lazily, once per target skeleton.
 */

export interface ClipMotion { dur: number; loop: boolean; forward: number; left: number; up: number; speed: number }

/** Mixamo name (after the `mixamorig` prefix) → candidate target names, first match wins. */
const BONES: Record<string, string[]> = {
  Hips: ['Hips'],
  Spine: ['Spine02', 'Spine'], Spine1: ['Spine01', 'Spine1'], Spine2: ['Spine2', 'Spine'],
  Neck: ['neck', 'Neck'], Head: ['Head'], HeadTop_End: ['head_end', 'HeadTop_End'],
  LeftShoulder: ['LeftShoulder'], LeftArm: ['LeftArm'], LeftForeArm: ['LeftForeArm'], LeftHand: ['LeftHand'],
  RightShoulder: ['RightShoulder'], RightArm: ['RightArm'], RightForeArm: ['RightForeArm'], RightHand: ['RightHand'],
  LeftUpLeg: ['LeftUpLeg'], LeftLeg: ['LeftLeg'], LeftFoot: ['LeftFoot'], LeftToeBase: ['LeftToeBase'],
  RightUpLeg: ['RightUpLeg'], RightLeg: ['RightLeg'], RightFoot: ['RightFoot'], RightToeBase: ['RightToeBase'],
};
/** Which child sets a bone's aim direction for rest-pose alignment. */
const AIM_CHILD: Record<string, string> = {
  Hips: 'Spine', Spine: 'Spine1', Spine1: 'Spine2', Spine2: 'Neck', Neck: 'Head', Head: 'HeadTop_End',
  LeftShoulder: 'LeftArm', LeftArm: 'LeftForeArm', LeftForeArm: 'LeftHand',
  RightShoulder: 'RightArm', RightArm: 'RightForeArm', RightForeArm: 'RightHand',
  LeftUpLeg: 'LeftLeg', LeftLeg: 'LeftFoot', LeftFoot: 'LeftToeBase',
  RightUpLeg: 'RightLeg', RightLeg: 'RightFoot', RightFoot: 'RightToeBase',
};
const SAMPLE_FPS = 30;

interface Library {
  rig: THREE.Object3D; mixer: THREE.AnimationMixer;
  clips: Map<string, THREE.AnimationClip>; motion: Record<string, ClipMotion>;
  bones: Map<string, THREE.Object3D>; hipsHeight: number;
}
let lib: Library | null | undefined;

/** The clip library, or null when xbot.glb didn't load (characters then use their own Walk/Run). */
export function clipLibrary(): Library | null {
  if (lib !== undefined) return lib;
  const src = skinnedOverride('human');
  if (!src || !src.animations.length) return (lib = null);
  const rig = cloneSkinned(src.scene);
  rig.updateMatrixWorld(true);
  const bones = new Map<string, THREE.Object3D>();
  rig.traverse((o) => { if ((o as THREE.Bone).isBone) bones.set(o.name.replace(/^mixamorig:?/, ''), o); });
  const hips = bones.get('Hips');
  lib = {
    rig, mixer: new THREE.AnimationMixer(rig), bones,
    clips: new Map(src.animations.map((c) => [c.name, c] as const)),
    motion: ((src.userData?.clipMotion ?? {}) as Record<string, ClipMotion>),
    hipsHeight: hips ? hips.getWorldPosition(new THREE.Vector3()).y : 1,
  };
  return lib;
}

interface Target {
  /** Mixamo name → target bone (in a private rest-pose clone, for measurement only). */
  map: Map<string, THREE.Object3D>;
  /** T_world(t) = S_world(t) · C */
  C: Map<string, THREE.Quaternion>;
  order: string[];
  hipsScale: number; hipsRestT: THREE.Vector3; hipsRestS: THREE.Vector3; hipsParentInv: THREE.Matrix4;
  restWorld: Map<THREE.Object3D, THREE.Quaternion>;
  cache: Map<string, THREE.AnimationClip | null>;
}
const targets = new WeakMap<THREE.Object3D, Target | null>();

/** True when `scene` has enough of a humanoid skeleton to take the library. */
export function canRetarget(scene: THREE.Object3D): boolean { return !!target(scene); }

/** `name` retargeted onto the skeleton of `scene` (the loaded GLB scene, not an instance). */
export function clipFor(scene: THREE.Object3D, name: string): THREE.AnimationClip | null {
  const t = target(scene), L = clipLibrary();
  if (!t || !L) return null;
  if (t.cache.has(name)) return t.cache.get(name)!;
  const src = L.clips.get(name);
  const out = src ? bake(t, L, src) : null;
  t.cache.set(name, out);
  return out;
}

/** World speeds in the library are X Bot metres; multiply by this for a target of hips height `h`. */
export function strideScale(hipsWorldHeight: number): number { const L = clipLibrary(); return L ? hipsWorldHeight / L.hipsHeight : 1; }

function target(scene: THREE.Object3D): Target | null {
  if (targets.has(scene)) return targets.get(scene)!;
  const L = clipLibrary();
  let t: Target | null = null;
  if (L) {
    const rig = cloneSkinned(scene); rig.updateMatrixWorld(true);
    const byName = new Map<string, THREE.Object3D>();
    rig.traverse((o) => { if ((o as THREE.Bone).isBone) byName.set(o.name.replace(/^mixamorig:?/, ''), o); });
    const map = new Map<string, THREE.Object3D>();
    for (const [m, cands] of Object.entries(BONES)) { const b = cands.map((c) => byName.get(c)).find(Boolean); if (b) map.set(m, b); }
    if (['Hips', 'Spine', 'LeftUpLeg', 'RightUpLeg', 'LeftArm', 'RightArm', 'Head'].every((k) => map.has(k))) t = build(L, rig, map);
  }
  targets.set(scene, t);
  return t;
}

function build(L: Library, rig: THREE.Object3D, map: Map<string, THREE.Object3D>): Target {
  const wq = (o: THREE.Object3D) => o.getWorldQuaternion(new THREE.Quaternion());
  const wp = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3());
  const C = new Map<string, THREE.Quaternion>();
  for (const [m, tb] of map) {
    const sb = L.bones.get(m); if (!sb) continue;
    let A = new THREE.Quaternion();
    const child = AIM_CHILD[m], sc = child && L.bones.get(child), tc = child && map.get(child);
    if (sc && tc) {
      const sd = wp(sc).sub(wp(sb)).normalize(), td = wp(tc).sub(wp(tb)).normalize();
      if (sd.lengthSq() > 0 && td.lengthSq() > 0) A = new THREE.Quaternion().setFromUnitVectors(td, sd);
    }
    C.set(m, wq(sb).invert().multiply(A).multiply(wq(tb)));
  }
  // parents first, by depth in the target hierarchy
  const depth = (o: THREE.Object3D) => { let d = 0; for (let p = o.parent; p; p = p.parent) d++; return d; };
  const order = [...C.keys()].sort((a, b) => depth(map.get(a)!) - depth(map.get(b)!));
  const restWorld = new Map<THREE.Object3D, THREE.Quaternion>();
  rig.traverse((o) => restWorld.set(o, wq(o)));
  const th = map.get('Hips')!, sh = L.bones.get('Hips')!;
  const hipsRestT = wp(th), hipsRestS = wp(sh);
  return {
    map, C, order, restWorld, cache: new Map(),
    hipsScale: hipsRestT.y / Math.max(1e-3, hipsRestS.y), hipsRestT, hipsRestS,
    hipsParentInv: th.parent ? th.parent.matrixWorld.clone().invert() : new THREE.Matrix4(),
  };
}

function bake(t: Target, L: Library, src: THREE.AnimationClip): THREE.AnimationClip {
  const n = Math.max(2, Math.round(src.duration * SAMPLE_FPS) + 1);
  const times = new Float32Array(n);
  const q = new Map<string, Float32Array>([...t.order].map((m) => [m, new Float32Array(n * 4)]));
  const hipsPos = new Float32Array(n * 3);
  const action = L.mixer.clipAction(src); action.play(); action.setEffectiveWeight(1); action.setEffectiveTimeScale(0);
  const tw = new Map<THREE.Object3D, THREE.Quaternion>();
  const S = new THREE.Quaternion(), local = new THREE.Quaternion(), pw = new THREE.Quaternion(), v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const time = (i / (n - 1)) * src.duration; times[i] = time;
    action.time = time; L.mixer.update(0); L.rig.updateMatrixWorld(true);
    tw.clear();
    for (const m of t.order) {
      const tb = t.map.get(m)!;
      L.bones.get(m)!.getWorldQuaternion(S);
      const w = S.clone().multiply(t.C.get(m)!);
      tw.set(tb, w);
      // parent world now: a mapped ancestor's animated rotation, or its rest rotation
      const p = tb.parent;
      pw.copy(p ? (tw.get(p) ?? parentWorld(p, tw, t)) : new THREE.Quaternion());
      local.copy(pw).invert().multiply(w).toArray(q.get(m)!, i * 4);
    }
    L.bones.get('Hips')!.getWorldPosition(v);
    v.sub(t.hipsRestS).multiplyScalar(t.hipsScale).add(t.hipsRestT).applyMatrix4(t.hipsParentInv);
    v.toArray(hipsPos, i * 3);
  }
  action.stop(); L.mixer.uncacheAction(src);
  const tracks: THREE.KeyframeTrack[] = [];
  for (const m of t.order) tracks.push(new THREE.QuaternionKeyframeTrack(`${t.map.get(m)!.name}.quaternion`, times, q.get(m)!));
  tracks.push(new THREE.VectorKeyframeTrack(`${t.map.get('Hips')!.name}.position`, times, hipsPos));
  return new THREE.AnimationClip(src.name, src.duration, tracks);
}

/** World rotation of an unmapped target node this frame: its parent's (animated or rest) times its rest local. */
function parentWorld(o: THREE.Object3D, tw: Map<THREE.Object3D, THREE.Quaternion>, t: Target): THREE.Quaternion {
  const p = o.parent;
  if (!p) return t.restWorld.get(o)!.clone();
  const pW = tw.get(p) ?? parentWorld(p, tw, t);
  const restLocal = t.restWorld.get(p)!.clone().invert().multiply(t.restWorld.get(o)!);
  return pW.clone().multiply(restLocal);
}
