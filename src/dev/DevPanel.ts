import type { App } from '../game/App';
import { CHAPTERS } from '../../data/chapters';
import { COMPONENT_IDS } from '../../data/components';
import { SCRIPTS } from '../story';

/** Dev panel (backtick): chapter/beat jump, Core scrub, components, alert, god mode, Timed Zone freeze, VO browser, shot preview. */
export class DevPanel {
  private el: HTMLDivElement;
  open = false;
  constructor(private readonly app: App) {
    this.el = document.createElement('div'); this.el.className = 'nx-dev'; this.el.style.display = 'none';
    document.body.appendChild(this.el);
    addEventListener('keydown', (e) => { if (e.code === 'Backquote' && app.mode !== 'playing') this.toggle(); });
  }
  toggle(): void {
    this.open = !this.open; this.el.style.display = this.open ? 'block' : 'none';
    if (this.open) { this.render(); this.app.platform.exitPointerLock(); }
    else if (this.app.mode === 'playing') void this.app.platform.requestPointerLock(this.app.canvas);
  }
  private render(): void {
    const w = this.app.session.w;
    const nx = (window as unknown as { __nx: Record<string, (...a: unknown[]) => unknown> }).__nx;
    const script = SCRIPTS[w.chapterId];
    const lines = w.voice.list();
    this.el.innerHTML = `
<h4>DEV · ${w.chapterId} · beat ${w.graph.beatId ?? '—'}</h4>
<label>Chapter <select data-k="chapter">${CHAPTERS.map((c) => `<option value="${c.id}" ${c.id === w.chapterId ? 'selected' : ''}>${c.number} ${c.title}</option>`).join('')}</select><button data-a="load">Load</button></label>
<label>Beat <select data-k="beat">${(script?.chapter.beats ?? []).map((b) => `<option>${b.id}</option>`).join('')}</select><button data-a="beat">Jump</button></label>
<label>Sequence <select data-k="seq">${(script?.sequences ?? []).map((s) => `<option>${s.id}</option>`).join('')}</select><button data-a="seq">Play</button></label>
<label>Core <input type="range" min="0" max="72" step="1" value="${w.state.coreStability}" data-k="core"><span data-v="core">${w.state.coreStability}%</span></label>
<div>Components ${COMPONENT_IDS.map((c) => `<label><input type="checkbox" data-c="${c}" ${w.hasComponent(c) ? 'checked' : ''}>${c}</label>`).join(' ')}</div>
<div>Alert <button data-al="unaware">Unseen</button><button data-al="suspicious">Suspicious</button><button data-al="hunted">Hunted</button><button data-al="lockdown">Lockdown</button></div>
<div><label><input type="checkbox" data-t="god" ${w.dev.god ? 'checked' : ''}>God mode</label> <label><input type="checkbox" data-t="freeze" ${w.dev.freezeZones ? 'checked' : ''}>Freeze Timed Zone</label> <label><input type="checkbox" data-t="perc" ${w.dev.perceptionDebug ? 'checked' : ''}>Perception debug</label> <button data-a="zone">Complete zone</button> <button data-a="overlay">Overlay (F3)</button></div>
<label>VO <select data-k="vo">${lines.map((l) => `<option value="${l.id}">${l.id} — ${l.text.slice(0, 50)}</option>`).join('')}</select><button data-a="vo">Preview</button></label>
<label>Shot preview <select data-k="shot">${(script?.sequences ?? []).filter((s) => s.steps.some((st) => (st.action as { kind: string }).kind === 'shots')).map((s) => `<option>${s.id}</option>`).join('')}</select><button data-a="shot">Preview shots</button></label>`;
    const val = (k: string) => (this.el.querySelector(`[data-k="${k}"]`) as HTMLSelectElement | HTMLInputElement).value;
    this.el.querySelectorAll('button[data-a]').forEach((b) => b.addEventListener('click', () => {
      const a = (b as HTMLElement).dataset.a;
      if (a === 'load') { this.toggle(); this.app.launch(val('chapter')); }
      if (a === 'beat') nx.triggerBeat!(val('beat'));
      if (a === 'seq' || a === 'shot') { w.sequences.play(val(a === 'seq' ? 'seq' : 'shot')); this.toggle(); }
      if (a === 'zone') nx.completeTimedZone!();
      if (a === 'vo') w.dialogue.say(val('vo'), { channel: 'story' });
      if (a === 'overlay') { const o = (this.app as unknown as { overlay: { visible: boolean } }).overlay; o.visible = !o.visible; }
    }));
    this.el.querySelector('[data-k="core"]')!.addEventListener('input', (e) => { const v = Number((e.target as HTMLInputElement).value); nx.setCore!(v); (this.el.querySelector('[data-v="core"]') as HTMLElement).textContent = `${v}%`; });
    this.el.querySelectorAll('input[data-c]').forEach((c) => c.addEventListener('change', () => { const id = (c as HTMLInputElement).dataset.c!; if ((c as HTMLInputElement).checked) nx.giveComponent!(id); else { w.inventory.components = w.inventory.components.filter((x) => x !== id); w.state.unset(`component.${id}`); w.aegis?.applyComponents(); } }));
    this.el.querySelectorAll('button[data-al]').forEach((b) => b.addEventListener('click', () => nx.setAlert!((b as HTMLElement).dataset.al)));
    this.el.querySelectorAll('input[data-t]').forEach((c) => c.addEventListener('change', () => { const t = (c as HTMLInputElement).dataset.t, on = (c as HTMLInputElement).checked; if (t === 'god') nx.godMode!(on); if (t === 'freeze') w.dev.freezeZones = on; if (t === 'perc') w.dev.perceptionDebug = on; }));
  }
}
