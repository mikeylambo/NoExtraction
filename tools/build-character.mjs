// Packs a Meshy rig + its animation GLBs into one game-ready character GLB.
//
//   node tools/build-character.mjs --rig rigged.glb --clip Walk=walking.glb --clip Run=running.glb \
//     --out public/assets/models/sable_trooper.glb [--emissive red|cyan] [--back-light 0.205]
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
// `--back-light <fromTop>[,width,height]`: paint a lit cyan indicator onto the back unit, for
// lights too small for Meshy to keep. Centred on the back, `fromTop` × body height below the top
// of the head; width/height in metres. Meshy models face +Z, so the back is the −Z surface. The
// light is painted into the base colour and the emissive map through the mesh's own UVs.
const backLight = opt('back-light');
if (backLight) {
  const [fromTop, w = 0.014, h = 0.05] = backLight.split(',').map(Number);
  const node = root.listNodes().find((n) => n.getMesh());
  const prim = node.getMesh().listPrimitives()[0];
  const pos = prim.getAttribute('POSITION'), uv = prim.getAttribute('TEXCOORD_0'), idx = prim.getIndices();
  // Skinned: glTF ignores the mesh node's transform, so positions are already the bind pose.
  const P = (i) => pos.getElement(i, []);
  const pts = Array.from({ length: pos.getCount() }, (_, i) => P(i));
  const ys = pts.map((p) => p[1]), xs = pts.map((p) => p[0]);
  const top = Math.max(...ys), height = top - Math.min(...ys);
  const ly = top - fromTop * height, lx = (Math.max(...xs) + Math.min(...xs)) / 2;
  const back = Math.min(...pts.filter((p) => Math.abs(p[0] - lx) < 0.04 && Math.abs(p[1] - ly) < 0.04).map((p) => p[2]));
  const tex = mat.getBaseColorTexture();
  const meta = await sharp(tex.getImage()).metadata();
  const polys = [];
  for (let t = 0; t < idx.getCount(); t += 3) {
    const v = [idx.getScalar(t), idx.getScalar(t + 1), idx.getScalar(t + 2)];
    const c = v.map(P).reduce((a, p) => [a[0] + p[0] / 3, a[1] + p[1] / 3, a[2] + p[2] / 3], [0, 0, 0]);
    if (Math.abs(c[0] - lx) > w / 2 || Math.abs(c[1] - ly) > h / 2 || c[2] > back + 0.015) continue;
    polys.push(v.map((i) => { const [u, vv] = uv.getElement(i, []); return `${(u * meta.width).toFixed(1)},${(vv * meta.height).toFixed(1)}`; }).join(' '));
  }
  if (!polys.length || polys.length > 400) throw new Error(`back-light: ${polys.length} triangles matched; check fromTop`);
  const svg = (fill) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${meta.width}" height="${meta.height}">${polys.map((p) => `<polygon points="${p}" fill="${fill}" stroke="${fill}" stroke-width="2"/>`).join('')}</svg>`);
  tex.setImage(await sharp(tex.getImage()).composite([{ input: svg('#8ff6ff') }]).png().toBuffer());
  const prev = mat.getEmissiveTexture();
  const base = prev ? sharp(prev.getImage()).resize(meta.width, meta.height) : sharp({ create: { width: meta.width, height: meta.height, channels: 3, background: '#000' } });
  const glow = await base.composite([{ input: svg('#28e6ff') }]).blur(1.2).webp({ quality: 90 }).toBuffer();
  if (prev) prev.setImage(glow).setMimeType('image/webp');
  else mat.setEmissiveTexture(doc.createTexture('emissive').setImage(glow).setMimeType('image/webp'));
  mat.setEmissiveFactor([1, 1, 1]);
  console.log(`back-light: ${polys.length} triangles at ${ly.toFixed(2)} m, back surface z ${back.toFixed(3)}`);
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
