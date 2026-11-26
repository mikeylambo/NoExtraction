/**
 * A Mixamo auto-rigged character (FBX, With Skin, T-pose) → game GLB, matched to the model it replaces.
 *
 *   node tools/build-mixamo-character.mjs --in T-Pose.fbx --ref public/assets/models/ballast.glb \
 *     --out public/assets/models/ballast.glb
 *
 * - Feet on y = 0, scaled so the hips sit at the reference rig's hip height.
 * - Adds `mixamorig:HeadTop_End` (as a joint) at the reference skeleton's top, so the game's sizing
 *   (Humanoid skeletonTop) and the retarget's head aim see the same skeleton height.
 * - Mixamo keeps only the base colour; every map and factor is copied back from the reference
 *   material (normal, metal/roughness, emissive: e.g. Frank's back light). UVs survive the
 *   OBJ → Mixamo → FBX trip unchanged.
 * Needs fbx2gltf and @gltf-transform/{core,extensions,functions} (npm i --no-save).
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune } from '@gltf-transform/functions';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { createRequire } from 'node:module';

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : undefined; };
const [inp, refPath, out] = [opt('in'), opt('ref'), opt('out')];
if (!inp || !refPath || !out) { console.error('usage: --in <fbx> --ref <reference glb> --out <glb>'); process.exit(1); }

const require = createRequire(import.meta.url);
const bin = path.join(path.dirname(require.resolve('fbx2gltf/package.json')), 'bin', { linux: 'Linux', darwin: 'Darwin', win32: 'Windows_NT' }[process.platform], process.platform === 'win32' ? 'FBX2glTF.exe' : 'FBX2glTF');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mixchar-'));
execFileSync(bin, ['--binary', '--pbr-metallic-roughness', '-i', inp, '-o', path.join(tmp, 'char')], { stdio: 'ignore' });

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(path.join(tmp, 'char.glb'));
const ref = await io.read(refPath);
const R = doc.getRoot();
const node = (d, re) => d.getRoot().listNodes().find((n) => re.test(n.getName()));
const worldY = (n) => n.getWorldTranslation()[1];

// ---- reference measurements
let refTop = 0; for (const s of ref.getRoot().listSkins()) for (const j of s.listJoints()) refTop = Math.max(refTop, worldY(j));
const refHips = worldY(node(ref, /(^|:)Hips$/));

// ---- stand on the feet at the reference scale
const meshNode = R.listNodes().find((n) => n.getMesh());
const pos = meshNode.getMesh().listPrimitives()[0].getAttribute('POSITION');
let minY = Infinity; const v = [0, 0, 0];
for (let i = 0; i < pos.getCount(); i++) { pos.getElement(i, v); minY = Math.min(minY, v[1]); }
const root = R.listScenes()[0].listChildren()[0];
const hips = node(doc, /(^|:)Hips$/);
const s = refHips / (worldY(hips) - minY);
// face +Z like every character GLB (the toes point forward of the ankles)
const toe = node(doc, /(^|:)LeftToeBase$/), foot = node(doc, /(^|:)LeftFoot$/);
const backwards = toe && foot && toe.getWorldTranslation()[2] < foot.getWorldTranslation()[2];
root.setScale([s, s, s]).setTranslation([0, -minY * s, 0]).setRotation(backwards ? [0, 1, 0, 0] : [0, 0, 0, 1]);

// ---- head tip joint at the reference skeleton's top
const skin = R.listSkins()[0];
const head = node(doc, /(^|:)Head$/);
const headScale = head.getWorldMatrix()[5]; // uniform-ish: world Y scale of the head frame
// Never below the head: Mixamo's head joint can sit higher than the reference skeleton's top, and a
// tip under the head makes the retarget aim the head down into the chest. The game sizes from
// `extras.skeletonTop` (the reference top), so a taller tip doesn't change the character's size.
const refHead = worldY(node(ref, /(^|:)Head$/));
const tipY = Math.max(refTop, worldY(head) + Math.max(0.08, refTop - refHead));
const tip = doc.createNode('mixamorig:HeadTop_End').setTranslation([0, (tipY - worldY(head)) / headScale, 0]);
root.setExtras({ ...root.getExtras(), skeletonTop: refTop });
head.addChild(tip);
const ibm = skin.getInverseBindMatrices();
// glTF skinning: world = jointWorld · IBM · v. The root scale moves joints and bind alike, so the
// existing IBMs stand; the new joint's must satisfy tipWorld · IBM = rootMatrix (it owns no vertices).
const arr = new Float32Array(ibm.getArray().length + 16); arr.set(ibm.getArray());
arr.set(mul(invert(tip.getWorldMatrix()), root.getMatrix()), ibm.getArray().length);
skin.addJoint(tip);
ibm.setArray(arr);

// ---- materials from the reference
const refMat = ref.getRoot().listMaterials()[0];
const mat = meshNode.getMesh().listPrimitives()[0].getMaterial();
const copyTex = (t) => t && doc.createTexture(t.getName()).setImage(t.getImage()).setMimeType(t.getMimeType());
mat.setBaseColorTexture(copyTex(refMat.getBaseColorTexture())).setBaseColorFactor(refMat.getBaseColorFactor())
  .setNormalTexture(copyTex(refMat.getNormalTexture())).setNormalScale(refMat.getNormalScale())
  .setMetallicRoughnessTexture(copyTex(refMat.getMetallicRoughnessTexture())).setMetallicFactor(refMat.getMetallicFactor()).setRoughnessFactor(refMat.getRoughnessFactor())
  .setEmissiveTexture(copyTex(refMat.getEmissiveTexture())).setEmissiveFactor(refMat.getEmissiveFactor());
for (const a of R.listAnimations()) a.dispose(); // Mixamo's one-frame T-pose take

await doc.transform(dedup(), prune()); // no quantize(): it drops the skin on this rig
fs.mkdirSync(path.dirname(out), { recursive: true });
await io.write(out, doc);
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`${out}: ${(fs.statSync(out).size / 1e6).toFixed(1)} MB, ${skin.listJoints().length} joints, scale ${s.toFixed(3)}${backwards ? ', turned to face +Z' : ''}, hips ${refHips.toFixed(3)} m, top ${refTop.toFixed(3)} m`);

function mul(a, b) { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let x = 0; for (let k = 0; k < 4; k++) x += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = x; } return o; }
function invert(m) {
  const [a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33] = m;
  const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11;
  const b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12, b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30;
  const b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
  const d = 1 / (b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06);
  return new Float32Array([
    (a11 * b11 - a12 * b10 + a13 * b09) * d, (a02 * b10 - a01 * b11 - a03 * b09) * d, (a31 * b05 - a32 * b04 + a33 * b03) * d, (a22 * b04 - a21 * b05 - a23 * b03) * d,
    (a12 * b08 - a10 * b11 - a13 * b07) * d, (a00 * b11 - a02 * b08 + a03 * b07) * d, (a32 * b02 - a30 * b05 - a33 * b01) * d, (a20 * b05 - a22 * b02 + a23 * b01) * d,
    (a10 * b10 - a11 * b08 + a13 * b06) * d, (a01 * b08 - a00 * b10 - a03 * b06) * d, (a30 * b04 - a31 * b02 + a33 * b00) * d, (a21 * b02 - a20 * b04 - a23 * b00) * d,
    (a11 * b07 - a10 * b09 - a12 * b06) * d, (a00 * b09 - a01 * b07 + a02 * b06) * d, (a31 * b01 - a30 * b03 - a32 * b00) * d, (a20 * b03 - a21 * b01 + a22 * b00) * d,
  ]);
}
