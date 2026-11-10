import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { PALETTE } from '../../data/palette';
import { lightBeam } from '../render/atmosphere';

/**
 * Skinned, animation-blended characters. The GLB is a stand-in (three.js example soldier, Mixamo
 * skeleton) until the project's own mocap'd characters arrive — the blending, patrol and gun-light
 * code is what carries over.
 */

const FACING = Number(new URLSearchParams(location.search).get('facing') ?? Math.PI);

export interface Actor { root: THREE.Object3D; mixer: THREE.AnimationMixer; update(dt: number): void }

export async function loadActors(scene: THREE.Scene, url: string, patrol: THREE.Vector3[], heightAt: (x: number, z: number) => number, shadowRes: number): Promise<{ actors: Actor[]; patroller: THREE.Object3D }> {
  const gltf = await new GLTFLoader().loadAsync(url);
  const clip = (n: string) => gltf.animations.find((a) => a.name === n)!;

  /** The stand-in GLB faces −Z; gameplay convention is +Z forward, so each instance is wrapped. */
  const instance = () => { const inner = cloneSkinned(gltf.scene); inner.rotation.y = FACING; const outer = new THREE.Group(); outer.add(inner); dress(inner); scene.add(outer); return outer; };
  const dress = (root: THREE.Object3D) => {
    root.traverse((o) => {
      const m = o as THREE.SkinnedMesh; if (!m.isMesh) return;
      m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
      const src = m.material as THREE.MeshStandardMaterial; const mat = src.clone();
      if (/Visor/i.test(src.name)) { mat.color.set(0x050505); mat.emissive.set(PALETTE.red); mat.emissiveIntensity = 1.6; mat.roughness = 0.15; mat.metalness = 0.6; }
      else { mat.color.setRGB(0.36, 0.38, 0.4); mat.roughness = 0.8; mat.metalness = 0.15; mat.envMapIntensity = 0.7; }
      m.material = mat;
    });
  };

  const actors: Actor[] = [];

  // patroller: walks the loop, pauses at two posts, sweeps a weapon light
  const p = instance();
  const pm = new THREE.AnimationMixer(p);
  const walk = pm.clipAction(clip('Walk')), idle = pm.clipAction(clip('Idle'));
  walk.play(); idle.play(); idle.setEffectiveWeight(0);
  const curve = new THREE.CatmullRomCurve3(patrol, true, 'catmullrom', 0.3); const len = curve.getLength();
  const torch = new THREE.SpotLight(0xe6f0ff, 60, 22, 0.32, 0.5, 2); torch.castShadow = true; torch.shadow.mapSize.set(shadowRes, shadowRes); torch.shadow.bias = -0.0005; torch.shadow.camera.near = 0.2;
  const torchMount = new THREE.Object3D(); p.add(torchMount); torchMount.position.set(-0.18, 1.32, 0.35);
  torchMount.add(torch); const tgt = new THREE.Object3D(); tgt.position.set(0, -0.9, 6); torchMount.add(tgt); torch.target = tgt;
  const beam = lightBeam(0xdfe8ff, 6, 1.2, 0.07); beam.mesh.rotation.x = -Math.PI / 2 + 0.15; torchMount.add(beam.mesh);
  const stops = [0.18, 0.62]; let s = 0; let pause = 0; let lastStop = -1;
  const speed = 1.45; const pos = new THREE.Vector3(); const ahead = new THREE.Vector3(); let yaw = 0; let sweep = 0;
  actors.push({
    root: p, mixer: pm,
    update(dt) {
      if (pause > 0) {
        pause -= dt; sweep += dt;
        const w = Math.min(1, idle.getEffectiveWeight() + dt * 2.5); idle.setEffectiveWeight(w); walk.setEffectiveWeight(1 - w);
        torchMount.rotation.y = Math.sin(sweep * 0.9) * 0.6;
      } else {
        const w = Math.max(0, idle.getEffectiveWeight() - dt * 2.5); idle.setEffectiveWeight(w); walk.setEffectiveWeight(1 - w);
        torchMount.rotation.y *= 1 - Math.min(1, dt * 2);
        s = (s + (speed * (1 - w) * dt) / len) % 1;
        for (let i = 0; i < stops.length; i++) if (lastStop !== i && Math.abs(s - stops[i]) < 0.003) { pause = 4.5; lastStop = i; sweep = 0; }
      }
      curve.getPointAt(s, pos); curve.getPointAt((s + 0.01) % 1, ahead);
      pos.y = heightAt(pos.x, pos.z);
      const want = Math.atan2(ahead.x - pos.x, ahead.z - pos.z);
      let d = want - yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); yaw += d * Math.min(1, dt * 4);
      p.position.copy(pos); p.rotation.y = yaw;
      walk.timeScale = 1.05; pm.update(dt);
      (beam.uniforms.uTime.value as number) += dt;
    },
  });

  // sentry by the bunker door (idle, slight weight shifts come from the clip)
  const g = instance();
  g.position.set(-5.4, heightAt(-5.4, -8.6), -8.6); g.rotation.y = 0.35;
  const gm = new THREE.AnimationMixer(g); const gi = gm.clipAction(clip('Idle')); gi.play(); gi.time = 1.3;
  actors.push({ root: g, mixer: gm, update(dt) { gm.update(dt); } });

  // second sentry on the container stack, silhouetted against the sky
  const c = instance();
  c.position.set(-19, 5.18, -2.5); c.rotation.y = 0.9;
  const cm = new THREE.AnimationMixer(c); const ci = cm.clipAction(clip('Idle')); ci.play(); ci.time = 2.7;
  actors.push({ root: c, mixer: cm, update(dt) { cm.update(dt); } });

  return { actors, patroller: p };
}
