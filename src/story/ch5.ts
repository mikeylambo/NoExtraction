import * as THREE from 'three';
import type { ChapterScript, ScriptContext } from './Script';
import { MechHostile } from '../ai/MechHostile';
import { Marshal } from '../ai/Marshal';
import { SHELF, MARSHAL_CENTER } from '../world/levels/ch5';
import { MARSHAL } from '../../data/bosses/marshal';
import { SYSTEMS_LOSS } from '../../data/aegis';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

function spawnWardens(ctx: ScriptContext, list: [number, number, number][], tag: string, onAllDead: () => void): MechHostile[] {
  const { w } = ctx;
  const ms = list.map((p, i) => { const m = new MechHostile(w, V(...p), Math.PI); m.name = `Warden ${tag}${i}`; w.mechHostiles.push(m); return m; });
  let dead = 0;
  for (const m of ms) m.onDeath = () => { dead++; if (dead === ms.length) onAllDead(); };
  if (ctx.once(`c5.wardenBark.${tag}`)) w.dialogue.say('sable.warden.aegis', { channel: 'bark' });
  return ms;
}

/** Repair station: drive onto the pad once for +800 armor. */
function repairStation(ctx: ScriptContext, id: string, at: [number, number, number]): void {
  const { w } = ctx;
  w.onStep(`repair.${id}`, () => {
    const a = w.aegis; if (!a?.active || w.state.has(`repair.${id}`)) return;
    if (a.frame.pos.distanceTo(V(...at)) < 26) { w.state.set(`repair.${id}`); a.repair(); w.dialogue.say('c5.aegis.repair'); w.fx.burst(a.frame.pos.clone().setY(a.frame.pos.y + 6), { count: 40, speed: 8, life: 1, size: 0.8, color: 0xf4f7ff }); }
  });
}

/** Chapter 5 — Aegis (11%). Boot-up, Warden squad erase, Shelf Run, magnetic storm, arm loss, THE MARSHAL. */
export const CH5_SCRIPT: ChapterScript = {
  chapter: { id: 'ch5', title: 'Aegis', beats: [{ id: 'depot', checkpoint: true }, { id: 'boot' }, { id: 'wardens', checkpoint: true }, { id: 'shelf', checkpoint: true }, { id: 'storm', checkpoint: true }, { id: 'ambush', checkpoint: true }, { id: 'marshal', checkpoint: true }, { id: 'cradle' }] },
  intro: 'c5.intro',
  sequences: [
    {
      id: 'c5.intro', cinematic: true, skippable: true, replayable: true, title: 'AEGIS-07', duration: 8,
      steps: [
        { at: 0, action: { kind: 'core', pct: 11 }, essential: true },
        { at: 0, action: { kind: 'shots', blendOut: 1, shots: [{ id: 'frame', duration: 7, from: { p: [-10, 3, 6], t: [0, 8, -34], fov: 50 }, to: { p: [-5, 2, -2], t: [0, 9, -34], fov: 44 }, letterbox: 1 }] } },
        { at: 0.3, action: { kind: 'line', id: 'c5.halcyon.core11' } },
        { at: 0.4, action: { kind: 'line', id: 'c5.ballast.aegis' } },
        { at: 0.5, action: { kind: 'objective', text: 'The amber light by the frame', at: [6, 0, -36] }, essential: true },
      ],
    },
    {
      id: 'c5.boot', cinematic: true, skippable: false, replayable: true, title: 'Boot-up', duration: 15.5,
      steps: [
        { at: 0, action: { kind: 'flag', key: 'c5.boarded' }, essential: true },
        { at: 0, action: { kind: 'call', fn: 'enterCockpit' }, essential: true },
        { at: 0, action: { kind: 'mix', preset: 'duckAll' } },
        { at: 0.2, action: { kind: 'sfx', id: 'cockpit.breath' } },
        { at: 0.4, action: { kind: 'call', fn: 'governor' } },
        { at: 1.6, action: { kind: 'call', fn: 'bootLine', arg: 'AEGIS-07 // COLD START' } },
        { at: 1.6, action: { kind: 'line', id: 'c5.aegis.boot1' } },
        { at: 2.6, action: { kind: 'sfx', id: 'gate.slam' } },
        { at: 3.2, action: { kind: 'call', fn: 'bootLine', arg: 'REACTOR ........ NOMINAL' } },
        { at: 3.8, action: { kind: 'call', fn: 'bootLine', arg: 'HYDRAULICS ..... NOMINAL' } },
        { at: 3.6, action: { kind: 'line', id: 'c5.aegis.boot2' } },
        { at: 4.6, action: { kind: 'sfx', id: 'mech.servo' } },
        { at: 5.8, action: { kind: 'call', fn: 'bootLine', arg: 'PILOT AUTHORIZATION ......' } },
        { at: 6.0, action: { kind: 'line', id: 'c5.aegis.boot3' } },
        { at: 7.6, action: { kind: 'call', fn: 'bootLine', arg: '!REJECTED' } },
        { at: 8.0, action: { kind: 'line', id: 'c5.ballast.bypass' } },
        { at: 8.6, action: { kind: 'sfx', id: 'gear.rattle' } },
        { at: 9.4, action: { kind: 'call', fn: 'bootLine', arg: '…MANUAL' } },
        { at: 9.6, action: { kind: 'line', id: 'c5.aegis.boot4' } },
        { at: 11.0, action: { kind: 'call', fn: 'bootLine', arg: 'AEGIS-07 ONLINE' } },
        { at: 11.0, action: { kind: 'line', id: 'c5.aegis.boot5' } },
        { at: 11.1, action: { kind: 'call', fn: 'online' }, essential: true },
        { at: 11.1, action: { kind: 'music', cue: 'aegis' } },
        { at: 11.1, action: { kind: 'mix', preset: 'normal' } },
        { at: 12.6, action: { kind: 'call', fn: 'componentsReport' } },
        { at: 15.0, action: { kind: 'checkpoint', id: 'online' }, essential: true },
      ],
    },
    {
      id: 'c5.shelf', duration: 3,
      steps: [
        { at: 0, action: { kind: 'flag', key: 'c5.shelfStarted' }, essential: true },
        { at: 0, action: { kind: 'zone', id: 'shelfRun', op: 'start' }, essential: true },
        { at: 0, action: { kind: 'lines', ids: ['c5.aegis.shelf', 'c5.ballast.shelf'] } },
        { at: 0.1, action: { kind: 'objective', text: 'Assault boost across the shelf (hold boost)', at: [0, 0, -5800] }, essential: true },
        { at: 0.2, action: { kind: 'prompt', text: 'Hold <kbd>Shift</kbd> — assault boost', seconds: 5 } },
      ],
    },
    {
      id: 'c5.ambush', cinematic: true, skippable: true, duration: 4.5,
      steps: [
        { at: 0, action: { kind: 'call', fn: 'ambushSpawn' }, essential: true },
        { at: 0, action: { kind: 'shots', blendOut: 0.6, shots: [{ id: 'cliff', duration: 1.6, from: 'ambushPose', letterbox: 0.6, shake: 0.8 }, { id: 'hit', duration: 2.0, from: 'armPose', letterbox: 0.6, shake: 1.2 }] } },
        { at: 1.7, action: { kind: 'call', fn: 'armHit' }, essential: true },
        { at: 2.0, action: { kind: 'lines', ids: ['c5.aegis.armLost', 'c5.ballast.arm'] } },
        { at: 4.4, action: { kind: 'checkpoint', id: 'canyon' }, essential: true },
      ],
    },
    {
      id: 'c5.marshalIntro', cinematic: true, skippable: true, replayable: true, title: 'The Marshal', duration: 16,
      steps: [
        { at: 0, action: { kind: 'call', fn: 'marshalSpawn' }, essential: true },
        { at: 0, action: { kind: 'music', cue: 'marshal1' } },
        { at: 0, action: { kind: 'shots', blendOut: 1, shots: [
          { id: 'cradle', duration: 6, from: { p: [60, 40, MARSHAL_CENTER[2] + 200], t: [0, 60, MARSHAL_CENTER[2] - 420], fov: 50 }, to: { p: [40, 30, MARSHAL_CENTER[2] + 150], t: [0, 30, MARSHAL_CENTER[2] - 200], fov: 46 }, letterbox: 1 },
          { id: 'sovereign', duration: 9, from: 'sovereignPose', letterbox: 1 },
        ] } },
        { at: 0.5, action: { kind: 'lines', ids: ['c5.marshal.intro1', 'c5.marshal.intro2', 'c5.ballast.marshal1', 'c5.marshal.intro3'] } },
        { at: 15.5, action: { kind: 'call', fn: 'marshalGo' }, essential: true },
        { at: 15.5, action: { kind: 'objective', text: 'SOVEREIGN', at: undefined }, essential: true },
      ],
    },
    {
      id: 'c5.marshalDown', cinematic: true, skippable: true, replayable: true, title: 'One of Us', duration: 15,
      steps: [
        { at: 0, action: { kind: 'flag', key: 'c5.marshalDown' }, essential: true },
        { at: 0, action: { kind: 'music', cue: 'wren' } },
        { at: 0, action: { kind: 'shots', blendOut: 1, shots: [{ id: 'fallen', duration: 10, from: 'fallenPose', letterbox: 1 }] } },
        { at: 0.6, action: { kind: 'lines', ids: ['c5.marshal.death1', 'c5.marshal.death2', 'c5.ballast.marshalDead'] } },
        { at: 10.5, action: { kind: 'line', id: 'c5.aegis.cradle' } },
        { at: 10.5, action: { kind: 'objective', text: 'The cradle', at: [MARSHAL_CENTER[0], 0, MARSHAL_CENTER[2] - MARSHAL.arenaRadius - 20] }, essential: true },
      ],
    },
    {
      id: 'c5.end', duration: 4,
      steps: [
        { at: 0, action: { kind: 'fade', to: 1, seconds: 2.5 } },
        { at: 3, action: { kind: 'flag', key: 'chapter.done' }, essential: true },
        { at: 3.1, action: { kind: 'endChapter' }, essential: true },
      ],
    },
  ],
  hooks: {
    enterCockpit: ({ w }) => {
      w.hud.boot.style.display = 'block'; w.hud.boot.className = 'nx-boot'; w.hud.boot.innerHTML = '';
      if (w.player) { w.player.setLocked(true); w.player.rig.root.visible = false; }
    },
    bootLine: ({ w }, arg) => { const d = document.createElement('div'); const s = String(arg); if (s.startsWith('!')) { d.className = 'rej'; d.textContent = 'PILOT AUTHORIZATION ...... REJECTED'; } else d.textContent = s; w.hud.boot.appendChild(d); },
    governor: ({ w }) => { if (w.hasComponent('flightGovernor')) w.dialogue.say('c5.ballast.install'); },
    online: ({ w, session }) => {
      // the cockpit floods with light; control returns mid-line
      w.hud.boot.classList.add('flood'); setTimeout(() => { w.hud.boot.style.display = 'none'; }, 900);
      w.state.set('c5.online');
      const a = w.aegis!; a.applyComponents(); a.active = true; a.parked = false; a.spawn(V(0, 0, -34), 0);
      if (w.player) { w.player.dispose(); w.player = null; }
      w.cinematic.stop(0);
      session.saveCheckpoint('online', { pos: [0, 0, -34], yaw: 0, mech: true });
    },
    componentsReport: ({ w }) => {
      const ids = [w.hasComponent('flightGovernor') ? 'c5.aegis.governorOk' : 'c5.aegis.governorMissing'];
      if (w.hasComponent('missileRack')) ids.push('c5.aegis.missileOk');
      ids.push(w.hasComponent('arcBlade') ? 'c5.aegis.bladeOk' : 'c5.aegis.noBlade');
      w.dialogue.sayAll(ids);
    },
    ambushSpawn: (ctx) => {
      const { w } = ctx;
      spawnWardens(ctx, [[-60, 0, -7700], [60, 0, -7720]], 'ambush', () => { w.state.set('c5.ambushDone'); ctx.objective('Repair, then the launch platform', [0, 0, -8050]); });
    },
    armHit: ({ w }) => {
      const a = w.aegis!; a.loseSystem(SYSTEMS_LOSS[1]!.lost); a.damage(260 / w.difficulty.enemyDamage);
      w.fx.explosion(a.frame.pos.clone().setY(a.frame.pos.y + 8).add(new THREE.Vector3(-3, 0, 0)), 2.4, 0xffa060);
      w.audio.sfx('mech.explosion', a.frame.pos, 1);
    },
    marshalSpawn: ({ w }) => {
      if (w.mechHostiles.some((m) => m instanceof Marshal)) return;
      const m = new Marshal(w, V(MARSHAL_CENTER[0], 0, MARSHAL_CENTER[2] - 160), 0);
      m.active = false; m.bounds = { center: V(...MARSHAL_CENTER), radius: MARSHAL.arenaRadius - 20 };
      const saved = w.state.num('marshal.hp', 0); if (saved > 0) m.hp = saved;
      m.phase = w.state.num('marshal.phase', 1);
      w.mechHostiles.push(m);
    },
  },
  setup(ctx) {
    const { w, session } = ctx;
    const a = w.aegis!;
    if (!a.active) { a.parked = true; a.frame.reset(V(0, 0, -34), 0); }
    w.state.set('allPersonalCaches', ['pc1', 'pc2', 'pc3', 'pc4'].every((id) => w.inventory.caches.includes(id)));
    // cinematic poses
    const hooks = ctx.session.script!.hooks!;
    (hooks as Record<string, unknown>)['pose:ambushPose'] = () => { const p = a.frame.pos; return { position: { x: p.x - 30, y: p.y + 30, z: p.z - 40 }, target: { x: p.x, y: p.y + 10, z: p.z - 300 }, fov: 50 }; };
    (hooks as Record<string, unknown>)['pose:armPose'] = () => { const p = a.frame.pos; return { position: { x: p.x - 18, y: p.y + 10, z: p.z + 6 }, target: { x: p.x, y: p.y + 8, z: p.z }, fov: 45 }; };
    (hooks as Record<string, unknown>)['pose:sovereignPose'] = () => { const m = w.mechHostiles.find((x) => x instanceof Marshal)!; const p = m.pos; return { position: { x: p.x + 20, y: p.y + 9, z: p.z + 34 }, target: { x: p.x, y: p.y + 9, z: p.z }, fov: 40 }; };
    (hooks as Record<string, unknown>)['pose:fallenPose'] = () => { const m = w.mechHostiles.find((x) => x instanceof Marshal); const p = m ? m.rig.root.position : a.frame.pos; return { position: { x: p.x - 30, y: p.y + 14, z: p.z + 30 }, target: { x: p.x, y: p.y + 4, z: p.z }, fov: 42 }; };

    // depot: cache, then board
    w.on('cache', (id) => { if (id === 'sc4') { const t0 = w.simTime; const off = w.on('line:end', (l) => { if (l === 'c5.ballast.cache4reply') { off(); w.state.set('c5.canBoard'); ctx.objective('Board AEGIS-07', [0, 0, -30]); } }); w.onStep('c5.boardFallback', () => { if (w.simTime - t0 > 40) { w.state.set('c5.canBoard'); w.offStep('c5.boardFallback'); } }); } });
    w.on('c5.board', () => { ctx.beat('boot'); ctx.play('c5.boot'); });

    // first contact: a Warden in service, right outside — first kill within seconds of control
    const firstSpawn = () => {
      if (w.state.has('c5.firstKill')) return;
      const m = new MechHostile(w, V(6, 0, -105), 0, 220); m.name = 'Warden (servicing)'; m.active = false; // docked: it never gets to move
      m.onDeath = () => { w.state.set('c5.firstKill'); w.state.set('c5.firstKillAt', w.simTime); w.dialogue.say('c5.ballast.firstKill'); };
      w.mechHostiles.push(m);
    };
    firstSpawn();
    // the Warden squad erase
    if (!w.state.has('c5.wardensDone')) {
      const go = () => {
        ctx.beat('wardens');
        ctx.objective('Erase the Warden squad', [0, 0, -400]);
        w.dialogue.say('c5.ballast.wardens');
        spawnWardens(ctx, [[-180, 0, -420], [0, 0, -520], [180, 0, -440]], 'squad', () => { w.state.set('c5.wardensDone'); ctx.checkpoint('online'); ctx.objective('Repair station, then the shelf', [0, 0, -720]); });
      };
      let onlineAt = -1;
      w.onStep('c5.squadWait', () => {
        if (!w.state.has('c5.online')) return;
        if (onlineAt < 0) onlineAt = w.simTime;
        if (w.state.has('c5.firstKill') || w.simTime - onlineAt > 8) { w.offStep('c5.squadWait'); go(); }
      });
    }
    repairStation(ctx, 'yard', [0, 0, -720]);
    repairStation(ctx, 'canyon', [0, 0, -8050]);

    // Shelf Run: sections break behind you on the clock
    ctx.trigger('c5.shelf', [-130, -5, SHELF.start - 10], [130, 200, SHELF.start + 40], () => { if (w.state.has('c5.wardensDone') && ctx.once('c5.shelfOnce')) { ctx.beat('shelf'); ctx.play('c5.shelf'); } });
    w.onStep('c5.shelfBreak', () => {
      const z = w.zones.active; if (!z || z.id !== 'shelfRun') return;
      const k = 1 - z.left / z.total;
      const upto = Math.floor(k * SHELF.segs * 1.0) - 1;
      for (let i = 0; i <= upto; i++) if (!w.collapse.has(`c5.shelfBreak${i}`)) { w.collapse.register([{ id: `c5.shelfBreak${i}`, kind: 'shelf', at: [-120, 0, SHELF.start - i * SHELF.segLen - 200], to: [120, 0, SHELF.start - i * SHELF.segLen - 200], remove: [`c5.shelf${i}`], mech: true }]); w.collapse.trigger(`c5.shelfBreak${i}`); }
      if (a.frame.pos.z < SHELF.start - SHELF.segs * SHELF.segLen + 40 && a.frame.pos.y > -20) { w.zones.complete('shelfRun'); ctx.checkpoint('storm'); w.emit('c5.storm'); }
    });
    w.on('zone:fail', (id) => { if (id === 'shelfRun') w.dialogue.say('c5.ballast.shelfFail'); });
    // falling off the shelf is death
    w.onStep('c5.void', () => { if (a.active && a.frame.pos.y < -120) a.damage(99999 / w.difficulty.enemyDamage); });

    // magnetic storm in Sable's outer yard
    const storm = () => {
      if (w.state.has('c5.stormDone')) return;
      ctx.beat('storm');
      a.storm(SYSTEMS_LOSS[0]!.seconds);
      w.atmo.flare = 1; w.hud.staticBurst(2);
      w.dialogue.say('c5.aegis.storm');
      w.hud.tutorialPrompt('storm', 'Targeting offline — aim manually', 6);
      ctx.objective('Survive the storm', [0, 0, -6700]);
      spawnWardens(ctx, [[-160, 0, -6600], [160, 0, -6650]], 'storm', () => { w.state.set('c5.stormDone'); ctx.objective('Through the canyon', [0, 0, -7300]); });
      let said = false;
      w.onStep('c5.stormEnd', () => { if (a.stormT <= 0 && !said) { said = true; w.dialogue.say('c5.aegis.stormEnd'); w.offStep('c5.stormEnd'); } });
    };
    w.on('c5.storm', storm);
    if (w.state.has('zone.shelfRun.done') && !w.state.has('c5.stormDone')) storm();
    // the canyon: Warden ambush, left arm
    ctx.trigger('c5.canyon', [-120, -5, -7500], [120, 200, -7420], () => { if (w.state.has('c5.stormDone') && ctx.once('c5.ambushOnce')) { ctx.beat('ambush'); ctx.play('c5.ambush'); } });
    if (w.state.has('c5.ambushOnce') && !w.state.has('c5.ambushDone')) session.callHook('ambushSpawn');
    // the Marshal
    ctx.trigger('c5.platform', [-200, -5, MARSHAL_CENTER[2] + MARSHAL.arenaRadius - 40], [200, 200, MARSHAL_CENTER[2] + MARSHAL.arenaRadius + 60], () => {
      if (!w.state.has('c5.ambushDone') || !ctx.once('c5.marshalMet')) return;
      ctx.beat('marshal'); ctx.checkpoint('marshal'); ctx.play('c5.marshalIntro');
    });
    const wire = () => {
      const m = w.mechHostiles.find((x) => x instanceof Marshal) as Marshal | undefined; if (!m || (m as unknown as { wired?: boolean }).wired) return;
      (m as unknown as { wired?: boolean }).wired = true;
      a.bounds = { center: V(...MARSHAL_CENTER), radius: MARSHAL.arenaRadius - 12 };
      m.onPhase = (ph) => {
        w.state.set('marshal.phase', ph); w.state.set('marshal.hp', Math.round(m.hp));
        if (ph === 2) {
          w.audio.music('marshal2'); w.dialogue.say('c5.marshal.p2');
          // the platform breaks: the outer third goes
          w.collapse.register([{ id: 'c5.ring', kind: 'shelf', at: [MARSHAL_CENTER[0] - 300, 0, MARSHAL_CENTER[2] + 300], to: [MARSHAL_CENTER[0] + 300, 0, MARSHAL_CENTER[2] - 300], remove: ['c5.ring'], mech: true, onLand: () => { const r = MARSHAL.arenaRadius * (1 - MARSHAL.phase2.arenaShrink); a.bounds = { center: V(...MARSHAL_CENTER), radius: r - 12 }; m.bounds = { center: V(...MARSHAL_CENTER), radius: r - 20 }; } }]);
          w.collapse.trigger('c5.ring');
          w.dialogue.say('c5.marshal.p2support');
          spawnWardens(ctx, [[MARSHAL_CENTER[0] - 150, 0, MARSHAL_CENTER[2] + 80], [MARSHAL_CENTER[0] + 150, 0, MARSHAL_CENTER[2] + 80]], 'support', () => {}).forEach((x) => { x.bounds = { center: V(...MARSHAL_CENTER), radius: 220 }; });
          session.saveCheckpoint('marshalP2');
        }
        if (ph === 3) {
          w.audio.music('marshal3');
          w.dialogue.sayAll(['c5.marshal.p3', 'c5.aegis.cannonLost', 'c5.marshal.p3b']);
          m.grapple();
          session.saveCheckpoint('marshalP3');
        }
      };
      m.onEvent = (e) => { if (e === 'beam') w.dialogue.say('c5.marshal.beam'); if (e === 'blade' && w.rng.chance(0.25)) w.dialogue.say('c5.marshal.p1'); };
      m.onDeath = () => { w.state.set('marshal.ttk', Math.round(w.simTime - m.startedAt)); ctx.beat('cradle'); ctx.play('c5.marshalDown'); };
    };
    w.onStep('c5.wireMarshal', wire);
    (hooks as Record<string, unknown>).marshalGo = () => { const m = w.mechHostiles.find((x) => x instanceof Marshal) as Marshal | undefined; if (m) { m.active = true; m.startedAt = w.simTime; } };
    // restoring mid-fight
    if (w.state.has('c5.marshalMet') && !w.state.has('c5.marshalDown')) {
      session.callHook('marshalSpawn'); (hooks as Record<string, (c: ScriptContext) => void>).marshalGo!(ctx);
      w.audio.music(w.state.num('marshal.phase', 1) >= 3 ? 'marshal3' : w.state.num('marshal.phase', 1) === 2 ? 'marshal2' : 'marshal1');
      if (w.state.num('marshal.phase', 1) >= 2) { w.collapse.solidsByTag('c5.ring').forEach((s) => { s.active = false; if (s.mesh) s.mesh.visible = false; }); const r = MARSHAL.arenaRadius * (1 - MARSHAL.phase2.arenaShrink); w.onStep('c5.restoreBounds', () => { const m = w.mechHostiles.find((x) => x instanceof Marshal); if (m && a.bounds) { a.bounds.radius = r - 12; m.bounds = { center: V(...MARSHAL_CENTER), radius: r - 20 }; w.offStep('c5.restoreBounds'); } }); }
    }
    // board the cradle → Chapter 6
    w.onStep('c5.cradleNear', () => { if (w.state.has('c5.marshalDown') && a.active && Math.hypot(a.frame.pos.x - MARSHAL_CENTER[0], a.frame.pos.z - (MARSHAL_CENTER[2] - MARSHAL.arenaRadius - 20)) < 40 && ctx.once('c5.cradleBoarded')) { w.offStep('c5.cradleNear'); ctx.play('c5.end'); } });
    ctx.trigger('c5.cradle', [MARSHAL_CENTER[0] - 30, -5, MARSHAL_CENTER[2] - MARSHAL.arenaRadius - 45], [MARSHAL_CENTER[0] + 30, 200, MARSHAL_CENTER[2] - MARSHAL.arenaRadius + 5], () => { if (ctx.once('c5.cradleBoarded')) ctx.play('c5.end'); }, 'c5.marshalDown');
    w.onStep('c5.cradleBounds', () => { if (w.state.has('c5.marshalDown') && a.bounds) { a.bounds = null; w.offStep('c5.cradleBounds'); } });
    void SHELF;
  },
};
