import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MODELS } from '../../assets/manifest';
import { isSkinned, type SkinnedSource } from './SkinnedHuman';

const loaded = new Map<string, THREE.Object3D>();
const skinned = new Map<string, SkinnedSource>();

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
      if (isSkinned(gltf.scene)) skinned.set(m.id, { scene: gltf.scene, animations: gltf.animations });
      else loaded.set(m.id, gltf.scene);
      found.push(m.id);
    } catch { /* stand-in stays */ }
  }));
  return found;
}

/** The rigged character for `id`, if its GLB is skinned (instanced by SkinnedHuman, not cloned here). */
export function skinnedOverride(id: string): SkinnedSource | null { return skinned.get(id) ?? null; }

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
