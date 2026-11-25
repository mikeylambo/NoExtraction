/**
 * Mixamo FBX → one GLB (assets/models/xbot.glb): shared X Bot skeleton + every on-foot clip.
 *   node tools/build-anims.mjs <dir-with-extracted-mixamo-packs> [out.glb]
 * The dir holds pack folders (pro/, basic/, shooter/, pistol/, extra/, single/) as in MAP below.
 * Root motion: loops lose their net drift (speed kept in extras.clipMotion so the animator can
 * phase-lock feet to ground speed); one-shots get hips X/Z pinned (gameplay moves the body).
 */
import { NodeIO } from '@gltf-transform/core';
import { resample, prune, dedup } from '@gltf-transform/functions';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import { createRequire } from 'node:module';
const [srcDir, outFile = 'assets/models/xbot.glb'] = process.argv.slice(2);
if (!srcDir) { console.error('usage: node tools/build-anims.mjs <mixamo-dir> [out.glb]'); process.exit(1); }
const require = createRequire(import.meta.url);
const bin = path.join(path.dirname(require.resolve('fbx2gltf/package.json')), 'bin', { linux: 'Linux', darwin: 'Darwin', win32: 'Windows_NT' }[process.platform], process.platform === 'win32' ? 'FBX2glTF.exe' : 'FBX2glTF');
const D = fs.mkdtempSync(path.join(os.tmpdir(), 'anims-')) + '/';
for (const pack of fs.readdirSync(srcDir)) {
  const pd = path.join(srcDir, pack); if (!fs.statSync(pd).isDirectory()) continue;
  for (const f of fs.readdirSync(pd)) if (f.endsWith('.fbx')) execFileSync(bin, ['--binary', '-i', path.join(pd, f), '-o', D + pack + '__' + f.replace(/\.fbx$/, '').replace(/ /g, '_')], { stdio: 'ignore' });
}
const io = new NodeIO();
// canonical name -> [source, mode]   mode: 'loop' strips xz drift; 'once' strips xz; 'onceY' strips xyz; 'keep' strips nothing
const L='loop', O='once', Y='onceY';
const MAP = {
  idle:['pro__idle',L], idle_aim:['pro__idle_aiming',L], crouch_idle:['pro__idle_crouching',L], crouch_aim:['pro__idle_crouching_aiming',L],
  ...Object.fromEntries(['forward','forward_left','forward_right','left','right','backward','backward_left','backward_right'].flatMap(d=>[
    [`walk_${d}`,[`pro__walk_${d}`,L]], [`run_${d}`,[`pro__run_${d}`,L]], [`sprint_${d}`,[`pro__sprint_${d}`,L]], [`crouch_${d}`,[`pro__walk_crouching_${d}`,L]]])),
  turn_left:['pro__turn_90_left',O], turn_right:['pro__turn_90_right',O], crouch_turn_left:['pro__crouching_turn_90_left',O], crouch_turn_right:['pro__crouching_turn_90_right',O],
  jump_up:['pro__jump_up',O], jump_loop:['pro__jump_loop',L], jump_down:['pro__jump_down',O],
  death_front:['pro__death_from_the_front',O], death_back:['pro__death_from_the_back',O], death_right:['pro__death_from_right',O],
  death_head_front:['pro__death_from_front_headshot',O], death_head_back:['pro__death_from_back_headshot',O], death_crouch:['pro__death_crouching_headshot_front',O], death_walking:['shooter__walking_to_dying',O],
  rifle_fire:['basic__firing_rifle',O], rifle_fire_burst:['shooter__firing_rifle',O], rifle_reload:['basic__reloading',O], throw:['basic__toss_grenade',O],
  hit:['basic__hit_reaction',O], hit_run:['extra__Hit_Reaction_Running',O], rifle_punch:['single__Rifle_Punch',O],
  pistol_idle:['pistol__pistol_idle',L], pistol_walk:['pistol__pistol_walk',L], pistol_walk_backward:['pistol__pistol_walk_backward',L],
  pistol_run:['pistol__pistol_run',L], pistol_run_backward:['pistol__pistol_run_backward',L], pistol_strafe_left:['pistol__pistol_strafe',L], pistol_strafe_right:['pistol__pistol_strafe_(2)',L],
  pistol_kneel:['pistol__pistol_stand_to_kneel',O], pistol_kneel_idle:['pistol__pistol_kneeling_idle',L], pistol_unkneel:['pistol__pistol_kneel_to_stand',O],
  pistol_fire:['single__Shooting',O], pistol_whip:['single__Pistol_Whip',O],
  slide:['extra__Running_Slide',O], vault:['extra__Vault_Over_Box',O], jump_over:['extra__Jump_Over',O], mantle:['extra__Climbing_To_Top',Y],
  climb_up:['extra__Climbing_Up_Wall',Y], climb_down:['extra__Climbing_Down_Wall',Y], ladder:['extra__Climbing_Ladder',L],
  stunned:['extra__Stunned',O], interact:['extra__Button_Pushing',O], pickup:['extra__Picking_Up',O], crouch_to_stand:['extra__Crouch_To_Stand',O],
  look_around:['extra__Looking_Around',L], talk:['extra__Talking',L], phone:['extra__Talking_On_A_Cell_Phone',L],
  takedown_attacker:['extra__Strangling',O], takedown_victim:['extra__Being_Strangled',O], stab:['extra__Stabbing',O],
};
const base = await io.read(D+'pro__X_Bot.glb'); const R = base.getRoot(); const buf = R.listBuffers()[0];
R.listAnimations().forEach(a=>a.dispose());
const byName = new Map(R.listNodes().map(n=>[n.getName(),n]));
const motion = {};
for (const [name,[src,mode]] of Object.entries(MAP)) {
  const d = await io.read(D+src+'.glb'); const a = d.getRoot().listAnimations()[0];
  const na = base.createAnimation(name); let dur = 0, drift = [0,0,0];
  for (const c of a.listChannels()) {
    const tn = byName.get(c.getTargetNode().getName()); if (!tn) continue;
    const s = c.getSampler(); const t = Float32Array.from(s.getInput().getArray()); let v = Float32Array.from(s.getOutput().getArray());
    dur = Math.max(dur, t[t.length-1]);
    if (c.getTargetNode().getName()==='mixamorig:Hips' && c.getTargetPath()==='translation') {
      const n=v.length/3, T=t[t.length-1]||1; for (let k=0;k<3;k++) drift[k]=v[(n-1)*3+k]-v[k];
      if (mode==='loop') { for (let i=0;i<n;i++) for (const k of [0,2]) v[i*3+k] -= drift[k]*t[i]/T; }
      else { const pin = mode==='onceY'?[0,1,2]:[0,2]; for (let i=1;i<n;i++) for (const k of pin) v[i*3+k] = v[k]; }
    }
    const ia = base.createAccessor().setType('SCALAR').setArray(t).setBuffer(buf);
    const oa = base.createAccessor().setType(c.getTargetPath()==='rotation'?'VEC4':'VEC3').setArray(v).setBuffer(buf);
    const ns = base.createAnimationSampler().setInput(ia).setOutput(oa).setInterpolation(s.getInterpolation());
    na.addSampler(ns).addChannel(base.createAnimationChannel().setTargetNode(tn).setTargetPath(c.getTargetPath()).setSampler(ns));
  }
  const r = x=>Math.round(x*1000)/1000;
  // Mixamo +Z forward, +X left
  motion[name] = { dur:r(dur), loop: mode==='loop', forward:r(drift[2]), left:r(drift[0]), up:r(drift[1]), speed:r(Math.hypot(drift[0],drift[2])/Math.max(dur,1e-3)) };
}
// wrap scene so the rig faces -Z like the stand-ins
const scene = R.listScenes()[0]; const wrap = base.createNode('xbot_root').setRotation([0,1,0,0]);
for (const n of scene.listChildren()) { scene.removeChild(n); wrap.addChild(n); } scene.addChild(wrap);
R.setExtras({ clipMotion: motion });
await base.transform(resample({ tolerance: 1e-4 }), dedup(), prune());
await io.write(outFile, base); fs.rmSync(D, { recursive: true, force: true });
console.log(Object.keys(motion).length, 'clips ->', outFile, (fs.statSync(outFile).size / 1e6).toFixed(1), 'MB');
