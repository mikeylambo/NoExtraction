import * as THREE from 'three';
import { COLORBLIND, CSS } from '../../data/palette';
import { WEAPONS } from '../../data/weapons';
import { PLAYER } from '../../data/player';
import { AEGIS } from '../../data/aegis';
import type { World } from '../game/World';
import { injectHudStyles } from './hudStyles';

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent?: HTMLElement, html?: string) => { const e = document.createElement(tag); e.className = cls; if (html !== undefined) e.innerHTML = html; parent?.appendChild(e); return e; };

/** Onboarding prompts fade permanently after two successful uses (GDD §16). */
export interface PromptMemory { [id: string]: number }

/**
 * Minimal on-foot HUD (health arc bottom-left, weapon bottom-right, alert eye top-centre, Timed
 * Zone clock, Core readout during broadcasts, objective ping on demand) and the cockpit-style mech
 * HUD. DOM over the canvas; colours follow the readability law via CSS variables.
 */
export class Hud {
  readonly root: HTMLDivElement;
  private foot: HTMLDivElement; private mech: HTMLDivElement;
  private healthArc: SVGCircleElement; private healthCap: SVGCircleElement; private healthText: HTMLDivElement; private stims: HTMLDivElement;
  private weapon: HTMLDivElement; private ammo: HTMLDivElement; private throwable: HTMLDivElement; private visor: HTMLDivElement;
  private eye: HTMLDivElement; private eyeFill: HTMLDivElement; private alertLabel: HTMLDivElement;
  private clock: HTMLDivElement; private clockName: HTMLDivElement;
  private core: HTMLDivElement; private coreT = 0;
  private objective: HTMLDivElement; private objT = 0; private objMarker: HTMLDivElement;
  private prompt: HTMLDivElement; private promptRing: HTMLDivElement; private promptText: HTMLSpanElement;
  private tdPrompt: HTMLDivElement;
  private tutorial: HTMLDivElement; private tutT = 0;
  private toasts: HTMLDivElement;
  private hurtEl: HTMLDivElement; private hurtT = 0;
  private white: HTMLDivElement; private whiteT = 0;
  private staticEl: HTMLDivElement; private staticT = 0;
  private letter: [HTMLDivElement, HTMLDivElement];
  private fadeEl: HTMLDivElement;
  private card: HTMLDivElement; private cardT = 0;
  private skip: HTMLDivElement;
  private checkpointEl: HTMLDivElement; private cpT = 0;
  private crosshair: HTMLDivElement;
  private lockWarn: HTMLDivElement; private lockT = 0;
  private charge: HTMLDivElement; private chargeT = 0; private chargeMax = 1;
  private blurT = 0;
  // mech
  private mArmor: HTMLDivElement; private mArmorText: HTMLDivElement; private mEnergy: HTMLDivElement; private mReticle: HTMLDivElement; private mSlots: HTMLDivElement; private mSystems: HTMLDivElement; private mState: HTMLDivElement; private mBoss: HTMLDivElement; private mBossFill: HTMLDivElement; private mAlt: HTMLDivElement;
  boot: HTMLDivElement;
  prompts: PromptMemory = {};
  fade = 0;
  private fadeTarget = 0; private fadeRate = 1;
  dead = 0;
  private lastPulse = 0;

  constructor(parent: HTMLElement) {
    injectHudStyles();
    this.root = el('div', 'nx-hud', parent);
    this.letter = [el('div', 'nx-letter nx-letter-top', this.root), el('div', 'nx-letter nx-letter-bot', this.root)];
    this.foot = el('div', 'nx-foot', this.root);
    const hb = el('div', 'nx-health', this.foot);
    hb.innerHTML = `<svg viewBox="0 0 120 120"><circle class="bg" cx="60" cy="60" r="50"/><circle class="cap" cx="60" cy="60" r="50"/><circle class="hp" cx="60" cy="60" r="50"/></svg>`;
    this.healthArc = hb.querySelector('.hp')!; this.healthCap = hb.querySelector('.cap')!;
    this.healthText = el('div', 'nx-health-num', hb);
    this.stims = el('div', 'nx-stims', hb);
    const wb = el('div', 'nx-weapon', this.foot);
    this.weapon = el('div', 'nx-weapon-name', wb); this.ammo = el('div', 'nx-ammo', wb);
    this.throwable = el('div', 'nx-throw', wb); this.visor = el('div', 'nx-visor', wb);
    this.crosshair = el('div', 'nx-cross', this.root, '<i></i><i></i><i></i><i></i>');
    this.eye = el('div', 'nx-eye', this.root, `<svg viewBox="0 0 64 32"><path d="M2 16 Q32 -6 62 16 Q32 38 2 16 Z" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="32" cy="16" r="7" fill="currentColor"/></svg>`);
    this.eyeFill = el('div', 'nx-eye-fill', this.eye);
    this.alertLabel = el('div', 'nx-alert-label', this.root);
    this.clock = el('div', 'nx-clock', this.root); this.clockName = el('div', 'nx-clock-name', this.root);
    this.core = el('div', 'nx-core', this.root);
    this.objective = el('div', 'nx-objective', this.root);
    this.objMarker = el('div', 'nx-obj-marker', this.root, '<b></b><span></span>');
    this.prompt = el('div', 'nx-prompt', this.root); this.promptText = el('span', 'nx-prompt-text', this.prompt); this.promptRing = el('div', 'nx-prompt-ring', this.prompt);
    this.tdPrompt = el('div', 'nx-td', this.root);
    this.tutorial = el('div', 'nx-tutorial', this.root);
    this.toasts = el('div', 'nx-toasts', this.root);
    this.hurtEl = el('div', 'nx-hurt', this.root);
    this.white = el('div', 'nx-white', this.root);
    this.staticEl = el('div', 'nx-static', this.root);
    this.lockWarn = el('div', 'nx-lockwarn', this.root, 'LOCK');
    this.charge = el('div', 'nx-charge', this.root);
    this.checkpointEl = el('div', 'nx-checkpoint', this.root, '<span></span>');
    this.skip = el('div', 'nx-skip', this.root, '<i></i><span>Hold to skip</span>');
    this.card = el('div', 'nx-card', this.root);
    this.fadeEl = el('div', 'nx-fade', this.root);
    // mech
    this.mech = el('div', 'nx-mech', this.root);
    const ma = el('div', 'nx-m-armor', this.mech, '<label>ARMOR</label>');
    this.mArmor = el('div', 'nx-m-bar', ma); this.mArmorText = el('div', 'nx-m-num', ma);
    const me = el('div', 'nx-m-energy', this.mech, '<label>ENERGY</label>');
    this.mEnergy = el('div', 'nx-m-bar', me);
    this.mReticle = el('div', 'nx-m-reticle', this.root, '<i></i>');
    this.mSlots = el('div', 'nx-m-slots', this.mech);
    this.mSystems = el('div', 'nx-m-systems', this.mech);
    this.mState = el('div', 'nx-m-state', this.mech);
    this.mAlt = el('div', 'nx-m-alt', this.mech);
    this.mBoss = el('div', 'nx-m-boss', this.root, '<label>SOVEREIGN</label>');
    this.mBossFill = el('div', 'nx-m-boss-fill', this.mBoss);
    this.boot = el('div', 'nx-boot', this.root);
    this.setColorblind('off');
  }

  setColorblind(mode: keyof typeof COLORBLIND): void {
    const c = COLORBLIND[mode];
    document.documentElement.style.setProperty('--nx-red', c.red);
    document.documentElement.style.setProperty('--nx-amber', c.amber);
    document.documentElement.style.setProperty('--nx-cyan', c.cyan);
  }

  // ------------------------------------------------------------------ one-shots
  hurt(from: THREE.Vector3 | null, at: THREE.Vector3, yaw: number): void {
    this.hurtT = 0.6;
    if (from) { const a = Math.atan2(from.x - at.x, from.z - at.z) - yaw + Math.PI; this.hurtEl.style.setProperty('--dir', `${(-a * 180) / Math.PI}deg`); }
  }
  toast(text: string, color: 'cyan' | 'amber' | 'red' | 'white' = 'cyan'): void {
    const t = el('div', `nx-toast nx-${color}`, this.toasts, ''); t.textContent = text;
    setTimeout(() => t.classList.add('out'), 2200); setTimeout(() => t.remove(), 2800);
  }
  scanPulse(): void { this.lastPulse = performance.now(); this.visor.classList.remove('pulse'); void this.visor.offsetWidth; this.visor.classList.add('pulse'); }
  whiteout(a: number): void { this.whiteT = Math.max(this.whiteT, a); }
  zoneStart(name: string): void { this.clockName.textContent = name; this.toast(name, 'white'); }
  staticBurst(s: number): void { this.staticT = Math.max(this.staticT, s + 0.3); }
  lockWarning(s: number): void { this.lockT = Math.max(this.lockT, s); }
  chargeGlow(s: number): void { this.chargeT = s; this.chargeMax = s; }
  radialBlur(a: number): void { this.blurT = a * 6; }
  showCore(pct: number): void { this.core.innerHTML = `<label>CORE STABILITY</label><b>${pct}%</b>`; this.coreT = 7; }
  ping(text: string): void { this.objective.textContent = text; this.objT = 5; }
  checkpoint(): void { this.cpT = 2.2; }
  chapterCard(num: number, title: string, seconds = 4.2): void {
    this.card.innerHTML = `<small>CHAPTER ${num}</small><h2>${title}</h2>`;
    this.cardT = seconds; this.card.classList.add('on');
  }
  /** Contextual onboarding prompt. Returns false (and shows nothing) once learned. */
  tutorialPrompt(id: string, text: string, seconds = 6): boolean {
    if ((this.prompts[id] ?? 0) >= 2) return false;
    this.tutorial.innerHTML = text; this.tutT = seconds; this.tutorial.dataset.id = id;
    return true;
  }
  learned(id: string): void { this.prompts[id] = (this.prompts[id] ?? 0) + 1; if (this.tutorial.dataset.id === id) this.tutT = Math.min(this.tutT, 0.4); }
  fadeTo(v: number, seconds: number): void { this.fadeTarget = v; this.fadeRate = seconds <= 0 ? 999 : Math.abs(v - this.fade) / seconds; }
  setVisible(on: boolean): void { this.root.style.display = on ? 'block' : 'none'; }

  // ------------------------------------------------------------------ per frame
  update(dt: number, w: World): void {
    const tick = (v: number) => Math.max(0, v - dt);
    this.fade += Math.sign(this.fadeTarget - this.fade) * Math.min(Math.abs(this.fadeTarget - this.fade), this.fadeRate * dt);
    this.fadeEl.style.opacity = String(this.fade);
    this.hurtT = tick(this.hurtT); this.hurtEl.style.opacity = String(Math.min(1, this.hurtT * 2));
    this.whiteT = tick(this.whiteT * 1); this.white.style.opacity = String(Math.min(1, this.whiteT));
    this.staticT = tick(this.staticT); this.staticEl.style.opacity = String(Math.min(0.7, this.staticT * (w.options.reduceFlashes ? 0.3 : 1)));
    this.lockT = tick(this.lockT); this.lockWarn.style.opacity = this.lockT > 0 ? String(0.5 + 0.5 * Math.sin(performance.now() * 0.03)) : '0';
    this.chargeT = tick(this.chargeT); this.charge.style.opacity = this.chargeT > 0 ? String((1 - this.chargeT / this.chargeMax) * (w.options.reduceFlashes ? 0.35 : 0.85)) : '0';
    this.blurT = tick(this.blurT);
    this.coreT = tick(this.coreT); this.core.style.opacity = String(Math.min(1, this.coreT));
    this.objT = tick(this.objT); this.objective.style.opacity = String(Math.min(1, this.objT));
    this.tutT = tick(this.tutT); this.tutorial.style.opacity = String(Math.min(1, this.tutT * 2));
    this.cpT = tick(this.cpT); this.checkpointEl.style.opacity = String(Math.min(1, this.cpT));
    this.cardT = tick(this.cardT); if (this.cardT <= 0) this.card.classList.remove('on');
    const lb = w.cinematic.letterbox;
    this.letter[0].style.height = this.letter[1].style.height = `${lb * 11}vh`;
    const cine = w.cinematic.controlLocked || w.sequences.cinematic !== null;
    this.foot.style.opacity = this.mech.style.opacity = cine ? '0' : '1';
    const skipP = (w as unknown as { skipProgress?: number }).skipProgress ?? 0;
    this.skip.style.opacity = w.sequences.cinematic && w.sequences.cinematic.def.skippable !== false ? (skipP > 0 ? '1' : '0.45') : '0';
    (this.skip.firstElementChild as HTMLElement).style.width = `${skipP * 100}%`;

    const inMech = w.inMech;
    this.foot.style.display = inMech || !w.player ? 'none' : 'block';
    this.mech.style.display = inMech ? 'block' : 'none';
    this.mReticle.style.display = inMech && !cine ? 'block' : 'none';
    this.crosshair.style.display = !inMech && w.player && !cine ? 'block' : 'none';
    if (inMech) this.updateMech(w); else if (w.player) this.updateFoot(w);
    this.updateAlert(w, cine);
    this.updateClock(w);
    this.updateObjectiveMarker(w);
    this.updatePrompts(w, cine);
  }

  private updateFoot(w: World): void {
    const p = w.player!;
    const C = 2 * Math.PI * 50;
    this.healthArc.style.strokeDasharray = `${(p.health / 100) * C * 0.75} ${C}`;
    this.healthCap.style.strokeDasharray = `${(w.difficulty.regenCap / 100) * C * 0.75} ${C}`;
    this.healthText.textContent = String(Math.ceil(p.health));
    this.healthText.classList.toggle('low', p.health < 30);
    this.stims.innerHTML = '<i></i>'.repeat(w.inventory.stims);
    const wid = p.weapons.current, a = w.inventory.ammo[wid]!;
    this.weapon.textContent = WEAPONS[wid].name;
    this.ammo.innerHTML = p.weapons.reloading ? `<span class="rl" style="--p:${p.weapons.reloadProgress}"></span>` : `<b>${a.mag}</b><small>/ ${a.reserve}</small>`;
    const inv = w.inventory;
    this.throwable.innerHTML = `<span class="${inv.throwable === 'flash' ? 'sel' : ''}">FLASH ${inv.flash}</span><span class="${inv.throwable === 'decoy' ? 'sel' : ''}">DECOY ${inv.decoy}</span>`;
    const v = p.visor;
    this.visor.innerHTML = v.offline > 0 ? '<span class="off">VISOR OFFLINE</span>' : `<span class="vz" style="--p:${v.cooldown01}"></span>`;
    this.crosshair.classList.toggle('aim', p.aiming);
    const spread = (p.aiming ? 6 : 14) + Math.min(14, p.speed * 1.5);
    this.crosshair.style.setProperty('--s', `${spread}px`);
    this.dead = p.mode === 'dead' ? Math.min(1, p.deadT / 0.8) : 0;
  }

  private updateMech(w: World): void {
    const a = w.aegis!;
    const k = a.armor01;
    this.mArmor.style.setProperty('--p', String(k));
    this.mArmor.classList.toggle('crit', k < 0.3);
    this.mArmorText.textContent = String(Math.ceil(a.armor));
    this.mEnergy.style.setProperty('--p', String(a.frame.energy01));
    const gone = (s: string) => a.lost.has(s as never) || a.lost.has('weapons');
    const slot = (name: string, ok: boolean, lost: boolean, ready = 1, extra = '') => `<div class="slot ${lost ? 'lost' : ok ? '' : 'empty'}"><b>${name}</b><i style="--p:${ready}"></i>${extra}</div>`;
    this.mSlots.innerHTML =
      slot('RIFLE', true, gone('weapons'), 1, `<small>${a.reloading ? 'RELOAD' : a.rifleAmmo}${a.lost.has('leftArm') ? ' · R-MOUNT' : ''}</small>`) +
      slot(a.hasBlade ? 'ARC BLADE' : 'SHOVE', true, false) +
      slot('MISSILES', a.hasMissiles, gone('shoulders') && a.hasMissiles, a.missileReady01, a.hasMissiles ? '' : '<small>EMPTY</small>') +
      slot('CANNON', true, gone('shoulderCannon') || gone('shoulders'), a.cannonReady01, `<small>${a.cannonShells}</small>`);
    const sys: [string, boolean][] = [['FLIGHT', a.frame.caps.sustainedFlight], ['TARGETING', a.hardLockOnline], ['L-ARM', !a.lost.has('leftArm')], ['SHOULDER', !a.lost.has('shoulderCannon') && !a.lost.has('shoulders')], ['ARMOR', !a.lost.has('armor') && k > 0.3], ['BOOSTER', !a.lost.has('booster')]];
    this.mSystems.innerHTML = sys.map(([n, ok]) => `<div class="${ok ? '' : 'fail'}">${n}${ok ? '' : n === 'FLIGHT' ? ' · JETS' : ' · LOST'}</div>`).join('');
    this.mState.textContent = a.frame.state;
    this.mAlt.textContent = `ALT ${Math.round(a.frame.altitude)} m`;
    // reticle: on lock target or centre
    const t = a.lock.primary;
    let x = innerWidth / 2, y = innerHeight / 2;
    if (t) { const v = t.aimPoint().project(w.camera); if (v.z < 1) { x = (v.x + 1) / 2 * innerWidth; y = (1 - v.y) / 2 * innerHeight; } }
    this.mReticle.style.transform = `translate(${x}px, ${y}px)`;
    this.mReticle.classList.toggle('hard', a.lock.hard);
    this.mReticle.classList.toggle('soft', !!t && !a.lock.hard);
    this.mReticle.classList.toggle('manual', !a.hardLockOnline);
    const boss = w.mechHostiles.find((h) => h.name === 'SOVEREIGN' && h.alive && h.active);
    this.mBoss.style.display = boss ? 'block' : 'none';
    if (boss) this.mBossFill.style.width = `${(boss.hp / boss.hpMax) * 100}%`;
    void AEGIS;
  }

  private updateAlert(w: World, cine: boolean): void {
    const lvl = w.inMech || !w.alert ? 0 : w.alert.level();
    const det = w.inMech || !w.alert ? 0 : w.alert.detection();
    this.eye.style.opacity = cine || w.inMech ? '0' : lvl === 0 && det < 0.02 ? '0.35' : '1';
    this.eyeFill.style.height = `${Math.min(1, lvl >= 2 ? 1 : det / 2) * 100}%`;
    this.eye.dataset.level = String(lvl);
    this.alertLabel.textContent = cine ? '' : lvl === 3 ? 'LOCKDOWN' : lvl === 2 ? 'HUNTED' : lvl === 1 ? 'SUSPICIOUS' : '';
    this.alertLabel.dataset.level = String(lvl);
  }

  private updateClock(w: World): void {
    const z = w.zones?.active;
    this.clock.style.display = this.clockName.style.display = z ? 'block' : 'none';
    if (!z) return;
    const s = Math.max(0, z.left);
    this.clock.textContent = `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    this.clock.classList.toggle('urgent', s <= 30);
    this.clock.classList.toggle('critical', s <= 10);
  }

  private updateObjectiveMarker(w: World): void {
    const o = w.objective;
    const show = this.objT > 0 && o.pos;
    this.objMarker.style.display = show ? 'block' : 'none';
    if (!show) return;
    const v = o.pos!.clone().project(w.camera);
    const behind = v.z > 1;
    let x = (v.x + 1) / 2 * innerWidth, y = (1 - v.y) / 2 * innerHeight;
    if (behind) { x = innerWidth - x; y = innerHeight - 60; }
    x = Math.max(40, Math.min(innerWidth - 40, x)); y = Math.max(60, Math.min(innerHeight - 80, y));
    this.objMarker.style.transform = `translate(${x}px, ${y}px)`;
    (this.objMarker.lastElementChild as HTMLElement).textContent = `${Math.round(o.pos!.distanceTo(w.focusPos()))} m`;
    this.objMarker.style.opacity = String(Math.min(1, this.objT));
  }

  private updatePrompts(w: World, cine: boolean): void {
    const i = w.interact?.focused;
    if (i && !cine && !w.inMech) {
      this.prompt.style.display = 'flex';
      this.prompt.className = `nx-prompt nx-${i.color ?? 'cyan'}`;
      const key = w.player && (w as unknown as { padActive?: boolean }).padActive ? 'A' : 'E';
      this.promptText.innerHTML = `<b>${key}</b> ${i.prompt}`;
      this.promptRing.style.setProperty('--p', String(w.interact.progress));
      this.promptRing.style.display = i.hold > 0 ? 'block' : 'none';
    } else this.prompt.style.display = 'none';
    const p = w.player;
    const cand = !cine && p && !w.inMech ? p.chainCandidate ?? p.takedownCandidate : null;
    if (cand) {
      const v = cand.promptAnchor().project(w.camera);
      if (v.z < 1) {
        this.tdPrompt.style.display = 'block';
        this.tdPrompt.style.transform = `translate(${(v.x + 1) / 2 * innerWidth}px, ${(1 - v.y) / 2 * innerHeight}px)`;
        const pad = (w as unknown as { padActive?: boolean }).padActive;
        this.tdPrompt.innerHTML = `<b>${pad ? 'X' : 'F'}</b>${p!.chainCandidate === cand ? '<span>CHAIN</span>' : ''}`;
        this.tdPrompt.classList.toggle('chain', p!.chainCandidate === cand);
      } else this.tdPrompt.style.display = 'none';
    } else this.tdPrompt.style.display = 'none';
  }

  /** Dev / screenshot helper. */
  state() { return { foot: this.foot.style.display, mech: this.mech.style.display, clock: this.clock.textContent, alert: this.alertLabel.textContent }; }
  void(): void { void CSS; void PLAYER; }
}
