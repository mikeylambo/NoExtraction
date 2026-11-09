import * as THREE from 'three';
import { PALETTE } from '../../data/palette';
import { glowSprite } from './Materials';
import { applyOverride } from './ModelOverrides';

const box = (w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = true; return b; };

/**
 * Wren's extraction ship (hero stand-in; a GLB at assets/models/wren_ship.glb overrides it).
 * Halcyon white hull, amber running lights (amber = Wren), engine glow.
 */
export function buildWrenShip(): { root: THREE.Group; engines: THREE.Sprite[]; lights: THREE.Sprite[] } {
  const root = new THREE.Group();
  const hull = new THREE.MeshStandardMaterial({ color: 0xd8dee4, roughness: 0.4, metalness: 0.5 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a3036, roughness: 0.5, metalness: 0.6 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x0a1218, emissive: 0x223040, emissiveIntensity: 0.6, roughness: 0.1 });
  root.add(box(5, 3.2, 22, hull, 0, 0, 0));
  root.add(box(3.6, 1.6, 6, glass, 0, 1.2, -9.5));
  root.add(box(4.2, 2.2, 5, hull, 0, 0.2, -12.5).rotateX(0.18));
  for (const s of [-1, 1]) {
    root.add(box(12, 0.5, 7, hull, s * 8, -0.4, 3).rotateZ(-s * 0.08));
    root.add(box(2.6, 2.6, 8, dark, s * 4.5, -0.4, 7));
    root.add(box(0.4, 4, 4, hull, s * 13.6, 1.4, 5));
  }
  root.add(box(0.6, 5, 6, hull, 0, 3.6, 8));
  const engines: THREE.Sprite[] = [];
  for (const s of [-1, 1]) { const e = glowSprite(0xbfe6ff, 7, 0.9); e.position.set(s * 4.5, -0.4, 11.5); root.add(e); engines.push(e); }
  const lights: THREE.Sprite[] = [];
  for (const [x, y, z] of [[-14, -0.2, 3], [14, -0.2, 3], [0, 6, 11], [0, -1.8, -10]] as const) { const l = glowSprite(PALETTE.amber, 2.6, 1); l.position.set(x, y, z); root.add(l); lights.push(l); }
  applyOverride(root, 'wrenShip');
  return { root, engines, lights };
}
