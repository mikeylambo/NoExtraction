/**
 * Character GLB → OBJ + MTL + textures, for Mixamo's auto-rigger (the round trip back into the game is
 * tools/build-mixamo-character.mjs). Bind pose, centimetres, UVs preserved.
 *   node tools/export-for-mixamo.mjs public/assets/models/sable_trooper.glb <out-dir> sable_trooper
 * Textures come out as WebP (basecolor.webp, normal.webp); Mixamo wants PNG/JPG, so convert them and
 * point the MTL's map_Kd at the PNG before zipping the folder.
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dequantize } from '@gltf-transform/functions';
import fs from 'fs';
const [inp, outDir, name] = process.argv.slice(2);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(inp); await doc.transform(dequantize());
const R = doc.getRoot();
const node = R.listNodes().find(n => n.getMesh());
const M = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]; // skinned vertices are already in model metres; the node scale (0.01) is ignored by skinning
const prim = node.getMesh().listPrimitives()[0];
const P = prim.getAttribute('POSITION'), N = prim.getAttribute('NORMAL'), T = prim.getAttribute('TEXCOORD_0'), I = prim.getIndices();
const v = [0,0,0], lines = [`# ${name}: exported from the game GLB (bind pose, cm) for Mixamo auto-rigging`, `mtllib ${name}.mtl`, `o ${name}`];
const S = 100; // m -> cm
for (let i = 0; i < P.getCount(); i++) { P.getElement(i, v); const x = M[0]*v[0]+M[4]*v[1]+M[8]*v[2]+M[12], y = M[1]*v[0]+M[5]*v[1]+M[9]*v[2]+M[13], z = M[2]*v[0]+M[6]*v[1]+M[10]*v[2]+M[14]; lines.push(`v ${(x*S).toFixed(4)} ${(y*S).toFixed(4)} ${(z*S).toFixed(4)}`); }
const t = [0,0]; for (let i = 0; i < T.getCount(); i++) { T.getElement(i, t); lines.push(`vt ${t[0].toFixed(6)} ${(1 - t[1]).toFixed(6)}`); }
const n = [0,0,0]; for (let i = 0; i < N.getCount(); i++) { N.getElement(i, n); const x = M[0]*n[0]+M[4]*n[1]+M[8]*n[2], y = M[1]*n[0]+M[5]*n[1]+M[9]*n[2], z = M[2]*n[0]+M[6]*n[1]+M[10]*n[2]; const l = Math.hypot(x,y,z)||1; lines.push(`vn ${(x/l).toFixed(4)} ${(y/l).toFixed(4)} ${(z/l).toFixed(4)}`); }
lines.push(`usemtl ${name}`);
const idx = I.getArray(); for (let i = 0; i < idx.length; i += 3) { const f = [idx[i],idx[i+1],idx[i+2]].map(k => `${k+1}/${k+1}/${k+1}`); lines.push(`f ${f.join(' ')}`); }
fs.writeFileSync(`${outDir}/${name}.obj`, lines.join('\n'));
const mat = prim.getMaterial();
const dump = (tex, f) => { if (tex) fs.writeFileSync(`${outDir}/${f}.webp`, tex.getImage()); };
dump(mat.getBaseColorTexture(), 'basecolor'); dump(mat.getNormalTexture(), 'normal');
console.log(P.getCount(), 'verts', idx.length / 3, 'tris; height cm', (() => { let lo = 1e9, hi = -1e9; for (let i = 0; i < P.getCount(); i++) { P.getElement(i, v); const y = M[1]*v[0]+M[5]*v[1]+M[9]*v[2]+M[13]; lo = Math.min(lo, y); hi = Math.max(hi, y); } return ((hi - lo) * S).toFixed(1); })());
