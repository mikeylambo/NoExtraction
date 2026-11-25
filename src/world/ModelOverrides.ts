import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MODELS } from '../../assets/manifest';

const loaded = new Map<string, THREE.Object3D>();
const clips = new Map<string, { animations: THREE.AnimationClip[]; userData: Record<string, unknown> }>();

/**
 * At boot, probe each manifest path; any GLB present replaces its procedural stand-in. Missing
 * files are the normal case and cost one HEAD request each.
 */
export async function loadModelOverrides(): Promise<string[]> {
  const loader = new GLTFLoader();
  const found: string[] = [];
  await Promise.all(MODELS.map(async (m) => {
    try {
      const r = await fetch(m.path, { method: 'HEAD' });
      const type = r.headers.get('content-type') ?? '';
      if (!r.ok || type.includes('html')) return;
      const gltf = await loader.loadAsync(m.path);
      gltf.scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true; });
      if (m.scale) gltf.scene.scale.setScalar(m.scale);
      loaded.set(m.id, gltf.scene);
      if (gltf.animations.length) clips.set(m.id, { animations: gltf.animations, userData: gltf.userData ?? {} });
      found.push(m.id);
    } catch { /* stand-in stays */ }
  }));
  return found;
}

/** The loaded scene for `id` (not cloned; use SkeletonUtils.clone for skinned rigs). */
export function overrideSource(id: string): THREE.Object3D | null { return loaded.get(id) ?? null; }

/** Animation clips + glTF root extras shipped with `id`, if any. */
export function overrideClips(id: string): { animations: THREE.AnimationClip[]; userData: Record<string, unknown> } | null { return clips.get(id) ?? null; }

/** A clone of the override for `id`, or null to use the procedural stand-in. */
export function modelOverride(id: string): THREE.Object3D | null {
  const o = loaded.get(id);
  return o ? o.clone(true) : null;
}

/** Swap a rig's visible meshes for an override while keeping its pivots (animation hooks stay valid). */
export function applyOverride(root: THREE.Object3D, id: string): boolean {
  const o = modelOverride(id);
  if (!o) return false;
  root.traverse((c) => { if ((c as THREE.Mesh).isMesh) c.visible = false; });
  root.add(o);
  return true;
}
