// Packs a Meshy rig + its animation GLBs into one game-ready character GLB.
//
//   node tools/build-character.mjs --rig rigged.glb --clip Walk=walking.glb --clip Run=running.glb \
//     --out public/assets/models/sable_trooper.glb [--emissive red|cyan]
//
// - Clips are retargeted by joint name onto the rig's skeleton (Meshy exports one full GLB per clip).
// - Root motion is removed (the game moves characters; clips play in place).
// - `--emissive red|cyan` builds an emissive map from the saturated red (Sable visors) or cyan
//   (Halcyon lights) pixels of the base colour, so painted lights glow without a separate material.
// - Textures: base colour 2048, normal + ORM 1024, WebP. Geometry is quantized.
import fs from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, quantize, resample } from '@gltf-transform/functions';
import sharp from 'sharp';

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : undefined; };
const all = (k) => args.flatMap((a, i) => (a === `--${k}` ? [args[i + 1]] : []));
const rigPath = opt('rig'), out = opt('out'), emissive = opt('emissive');
if (!rigPath || !out) { console.error('usage: --rig <glb> --out <glb> [--clip Name=<glb>]... [--emissive red|cyan]'); process.exit(1); }

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(rigPath);
const root = doc.getRoot();
const buffer = root.listBuffers()[0];
for (const a of root.listAnimations()) a.dispose(); // Meshy's rig file carries a one-frame rest clip
const byName = new Map(root.listNodes().map((n) => [n.getName(), n]));
const hips = root.listSkins()[0].listJoints()[0];

for (const spec of all('clip')) {
  const [name, file] = spec.split('=');
  const src = await io.read(file);
  const anim = doc.createAnimation(name);
  for (const ch of src.getRoot().listAnimations()[0].listChannels()) {
    const target = byName.get(ch.getTargetNode().getName());
    const p = ch.getTargetPath();
    if (!target || p === 'scale') continue;
    if (p === 'translation' && target !== hips) continue; // bone lengths stay the rig's
    const s = ch.getSampler();
    const values = Float32Array.from(s.getOutput().getArray());
    if (p === 'translation') { // in place: keep the vertical bob, pin the horizontal travel
      const rest = hips.getTranslation();
      for (let i = 0; i < values.length; i += 3) { values[i] = rest[0]; values[i + 2] = rest[2]; }
    }
    const input = doc.createAccessor().setType('SCALAR').setArray(Float32Array.from(s.getInput().getArray())).setBuffer(buffer);
    const output = doc.createAccessor().setType(s.getOutput().getType()).setArray(values).setBuffer(buffer);
    const sampler = doc.createAnimationSampler().setInput(input).setOutput(output).setInterpolation(s.getInterpolation());
    anim.addSampler(sampler).addChannel(doc.createAnimationChannel().setTargetNode(target).setTargetPath(p).setSampler(sampler));
  }
  console.log(`clip ${name}: ${anim.listChannels().length} channels`);
}

const mat = root.listMaterials()[0];
const encode = async (tex, size, quality) => {
  const img = await sharp(tex.getImage()).resize(size, size).webp({ quality }).toBuffer();
  tex.setImage(img).setMimeType('image/webp');
};
if (emissive === 'red' || emissive === 'cyan') {
  const { data, info } = await sharp(mat.getBaseColorTexture().getImage()).resize(1024, 1024).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const mask = Buffer.alloc(info.width * info.height * 3);
  let lit = 0;
  for (let i = 0; i < info.width * info.height; i++) {
    const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
    const hit = emissive === 'red'
      ? r > 120 && r > g * 2.2 && r > b * 2.2
      : g > 120 && b > 120 && g > r * 1.8 && b > r * 1.8; // cyan: green and blue well above red
    if (hit) { mask.set(emissive === 'red' ? [255, 42, 58] : [40, 230, 255], i * 3); lit++; }
  }
  const img = await sharp(mask, { raw: { width: info.width, height: info.height, channels: 3 } }).blur(1.2).webp({ quality: 90 }).toBuffer();
  mat.setEmissiveTexture(doc.createTexture('emissive').setImage(img).setMimeType('image/webp')).setEmissiveFactor([1, 1, 1]);
  console.log(`emissive: ${lit} px (${((lit / (info.width * info.height)) * 100).toFixed(2)}% of the sheet)`);
}
await encode(mat.getBaseColorTexture(), 2048, 86);
await encode(mat.getNormalTexture(), 1024, 88);
await encode(mat.getMetallicRoughnessTexture(), 1024, 84);
mat.setDoubleSided(false);

await doc.transform(resample(), dedup(), prune(), quantize({ quantizeWeight: 8 }));
fs.mkdirSync(path.dirname(out), { recursive: true });
await io.write(out, doc);
const tris = root.listMeshes().flatMap((m) => m.listPrimitives()).reduce((n, p) => n + p.getIndices().getCount() / 3, 0);
console.log(`${out}: ${(fs.statSync(out).size / 1024).toFixed(0)} KB, ${tris} triangles, clips: ${root.listAnimations().map((a) => a.getName()).join(', ')}`);
