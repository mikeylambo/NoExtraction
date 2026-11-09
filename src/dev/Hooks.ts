import * as THREE from 'three';
import type { App } from '../game/App';
import type { ComponentId } from '../../data/components';
import { Bot } from './Bot';

/** Dev/bot hooks on window.__nx (GDD §18, brief §2). */
export function installDevHooks(app: App): void {
  const w = () => app.session.w;
  const bot = new Bot(app);
  app.bot = bot;
  const api = {
    app, bot,
    teleport: (x: number, y: number, z: number) => { const W = w(); if (W.inMech) W.aegis!.frame.pos.set(x, y, z); else W.player?.pos.set(x, y, z); },
    triggerBeat: (id: string) => { if (w().sequences.get(id)) w().sequences.play(id); else app.session.devBeat(id); },
    setAlert: (level: 'unaware' | 'suspicious' | 'hunted' | 'lockdown') => {
      const W = w(); const area = W.alert.areaAt(W.focusPos());
      if (level === 'lockdown') { if (area) W.alert.lockdown(area, 'alarm'); return; }
      for (const e of W.enemies) if (e.alive && (!area || e.spawn.area === area.def.id)) W.perception.setAwareness(e.perceiver, level, 'forced', W.focusPos());
    },
    setCore: (pct: number) => { w().state.coreStability = pct; w().atmo.setCore(pct); app.hud.showCore(Math.round(pct)); },
    giveComponent: (id: ComponentId) => { const W = w(); if (!W.inventory.components.includes(id)) W.inventory.components.push(id); W.state.set(`component.${id}`); W.aegis?.applyComponents(); },
    completeTimedZone: () => { const W = w(); const z = W.zones.active; if (z) { W.emit('zone:complete-dev', z.id); W.zones.complete(z.id); } },
    godMode: (on = true) => { w().dev.god = on; w().dev.infiniteAmmo = on; },
    loadChapter: (id: string, components?: ComponentId[]) => { app.launch(id); if (components) setTimeout(() => { for (const c of components) api.giveComponent(c); }, 50); },
    interact: (id: string) => w().interact.force(id),
    skip: () => { w().sequences.skip(); w().dialogue.stopAll(); w().cinematic.stop(0); },
    state: () => {
      const W = w();
      return {
        mode: app.mode, chapter: W.chapterId, beat: W.graph.beatId, core: W.state.coreStability, time: +app.session.chapterTime.toFixed(1),
        player: W.player ? { pos: W.player.pos.toArray().map((v) => +v.toFixed(2)), mode: W.player.mode, health: +W.player.health.toFixed(1), crouched: W.player.crouched } : null,
        aegis: W.aegis ? { active: W.aegis.active, pos: W.aegis.frame.pos.toArray().map((v) => +v.toFixed(1)), armor: Math.round(W.aegis.armor), lost: [...W.aegis.lost], state: W.aegis.frame.state, energy: Math.round(W.aegis.frame.energy) } : null,
        alert: W.alert.level(), lockdowns: W.counters.lockdowns, takedowns: W.counters.takedowns, deaths: W.counters.deaths,
        enemies: W.enemies.map((e) => ({ key: e.key, type: e.def.id, alive: e.alive, aw: e.awareness, state: e.state, pos: e.pos.toArray().map((v) => +v.toFixed(1)) })),
        mechs: W.mechHostiles.map((m) => ({ name: m.name, alive: m.alive, active: m.active, hp: Math.round(m.hp), pos: m.pos.toArray().map((v) => Math.round(v)) })),
        zone: W.zones.active ? { id: W.zones.active.id, left: +W.zones.active.left.toFixed(1) } : null,
        objective: W.objective.text, flags: W.state.snapshot().flags, inventory: W.inventory,
        cinematic: W.sequences.cinematic?.def.id ?? null, sequences: W.sequences.active.map((s) => s.def.id),
        collapseLog: W.collapse.log, interact: W.interact.focused?.id ?? null,
        perf: { draws: app.renderer.info.render.calls, tris: app.renderer.info.render.triangles, particles: W.fx.activeParticles },
      };
    },
    vec: (x: number, y: number, z: number) => new THREE.Vector3(x, y, z),
  };
  (window as unknown as { __nx: typeof api }).__nx = api;
}
