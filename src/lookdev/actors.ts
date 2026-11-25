import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { SkinnedHuman } from '../world/SkinnedHuman';
import { PALETTE } from '../../data/palette';
import { lightBeam } from '../render/atmosphere';

/**
 * The courtyard's Sable troopers: the game's own rigged character (assets/models/sable_trooper.glb)
 * through the same SkinnedHuman the chapters use, so what reads here is what ships.
 */

export interface Actor { root: THREE.Object3D; update(dt: number): void }

export async function loadActors(scene: THREE.Scene, url: string, patrol: THREE.Vector3[], heightAt: (x: number, z: number) => number, shadowRes: number): Promise<{ actors: Actor[]; patroller: THREE.Object3D }> {
  const gltf = await new GLTFLoader().loadAsync(url);
  const instance = () => { const h = new SkinnedHuman(gltf, { visor: PALETTE.red, visorIntensity: 4 }); scene.add(h.root); return h; };

  const actors: Actor[] = [];

  // patroller: walks the loop, pauses at two posts, sweeps a weapon light
  const ph = instance(); const p = ph.root;
  const curve = new THREE.CatmullRomCurve3(patrol, true, 'catmullrom', 0.3); const len = curve.getLength();
  const torch = new THREE.SpotLight(0xe6f0ff, 60, 22, 0.32, 0.5, 2); torch.castShadow = true; torch.shadow.mapSize.set(shadowRes, shadowRes); torch.shadow.bias = -0.0005; torch.shadow.camera.near = 0.2;
  const torchMount = new THREE.Object3D(); p.add(torchMount); torchMount.position.set(-0.18, 1.32, 0.35);
  torchMount.add(torch); const tgt = new THREE.Object3D(); tgt.position.set(0, -0.9, 6); torchMount.add(tgt); torch.target = tgt;
  const beam = lightBeam(0xdfe8ff, 6, 1.2, 0.07); beam.mesh.rotation.x = -Math.PI / 2 + 0.15; torchMount.add(beam.mesh);
  const stops = [0.18, 0.62]; let s = 0; let pause = 0; let lastStop = -1; let go = 1;
  const speed = 1.45; const pos = new THREE.Vector3(); const ahead = new THREE.Vector3(); let yaw = 0; let sweep = 0;
  actors.push({
    root: p,
    update(dt) {
      if (pause > 0) {
        pause -= dt; sweep += dt;
        go = Math.max(0, go - dt * 2.5);
        torchMount.rotation.y = Math.sin(sweep * 0.9) * 0.6;
      } else {
        go = Math.min(1, go + dt * 2.5);
        torchMount.rotation.y *= 1 - Math.min(1, dt * 2);
        s = (s + (speed * go * dt) / len) % 1;
        for (let i = 0; i < stops.length; i++) if (lastStop !== i && Math.abs(s - stops[i]) < 0.003) { pause = 4.5; lastStop = i; sweep = 0; }
      }
      curve.getPointAt(s, pos); curve.getPointAt((s + 0.01) % 1, ahead);
      pos.y = heightAt(pos.x, pos.z);
      const want = Math.atan2(ahead.x - pos.x, ahead.z - pos.z);
      let d = want - yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); yaw += d * Math.min(1, dt * 4);
      p.position.copy(pos); p.rotation.y = yaw;
      ph.update(dt, speed * go, 0);
      (beam.uniforms.uTime.value as number) += dt;
    },
  });

  // sentry by the bunker door, and one on the container stack silhouetted against the sky
  for (const [x, y, z, r, t] of [[-5.4, heightAt(-5.4, -8.6), -8.6, 0.35, 1.3], [-19, 5.18, -2.5, 0.9, 2.7]] as const) {
    const h = instance(); h.root.position.set(x, y, z); h.root.rotation.y = r; h.update(t, 0, 0);
    actors.push({ root: h.root, update(dt) { h.update(dt, 0, 0); } });
  }

  return { actors, patroller: p };
}
