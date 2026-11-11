// Packs a Meshy weapon model into a game-ready GLB in rifle space: +Z forward (towards the
// muzzle), +Y up, metres, origin at the pistol grip, plus a `muzzle` node at the barrel tip.
//
//   node tools/build-weapon.mjs --in rifle.glb --out public/assets/models/rifle_sable.glb \
//     --length 0.72 --grip 0.03,-0.08 --muzzle -0.479,0.034
//
// The source is a side-view image-to-3D result: long axis along X, muzzle towards −X (pass
// `--flip` if it points to +X). `--grip` and `--muzzle` are x,y in the source model's units, read
// off the reference image. Textures: 1024 WebP. Geometry is quantized.
import fs from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, quantize, getBounds } from '@gltf-transform/functions';
import sharp from 'sharp';

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : undefined; };
const xy = (k) => opt(k).split(',').map(Number);
const inPath = opt('in'), out = opt('out');
if (!inPath || !out || !opt('grip') || !opt('muzzle')) { console.error('usage: --in <glb> --out <glb> --grip x,y --muzzle x,y [--length m] [--flip]'); process.exit(1); }

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(inPath);
const root = doc.getRoot();
const scene = root.listScenes()[0];
const b = getBounds(scene);
const s = Number(opt('length') ?? 0.72) / (b.max[0] - b.min[0]);
const dir = args.includes('--flip') ? 1 : -1; // source x direction that points at the muzzle
const [gx, gy] = xy('grip'), [mx, my] = xy('muzzle');

// rifle space: z = dir·(x − gx)·s, y = (y − gy)·s, x = −dir·(z_src)·s (a proper rotation about Y)
const toRifle = ([x, y, z]) => [-dir * z * s, (y - gy) * s, dir * (x - gx) * s];
const wrap = doc.createNode('rifle_sable');
// column-major 4×4: columns are the images of the source x, y, z axes, then the translation
const t = toRifle([0, 0, 0]);
wrap.setMatrix([0, 0, dir * s, 0, 0, s, 0, 0, -dir * s, 0, 0, 0, t[0], t[1], t[2], 1]);
for (const n of scene.listChildren()) { scene.removeChild(n); wrap.addChild(n); }
scene.addChild(wrap);
scene.addChild(doc.createNode('muzzle').setTranslation(toRifle([mx, my, 0])));

const encode = async (tex, size, quality) => {
  if (!tex) return;
  tex.setImage(await sharp(tex.getImage()).resize(size, size).webp({ quality }).toBuffer()).setMimeType('image/webp');
};
for (const mat of root.listMaterials()) {
  await encode(mat.getBaseColorTexture(), 1024, 86);
  await encode(mat.getNormalTexture(), 1024, 88);
  await encode(mat.getMetallicRoughnessTexture(), 1024, 84);
}
await doc.transform(dedup(), prune({ keepLeaves: true }), quantize());
fs.mkdirSync(path.dirname(out), { recursive: true });
await io.write(out, doc);
const tris = root.listMeshes().flatMap((m) => m.listPrimitives()).reduce((n, p) => n + p.getIndices().getCount() / 3, 0);
const m = toRifle([mx, my, 0]).map((v) => v.toFixed(3));
console.log(`${out}: ${(fs.statSync(out).size / 1024).toFixed(0)} KB, ${tris} triangles, length ${opt('length') ?? 0.72} m, muzzle at ${m.join(', ')}`);
