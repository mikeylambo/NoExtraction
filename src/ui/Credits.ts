import type { CreditsDocument } from '@slu/web-shell';

export const CREDITS: CreditsDocument = {
  title: 'NO EXTRACTION',
  entries: [
    { section: 'NO EXTRACTION', role: 'A Soulfire Legends Universe game', names: [] },
    { section: 'Cast', role: 'Ballast', names: ['Michael'] },
    { section: 'Cast', role: 'Ava', names: ['Scratch voice — to be cast'] },
    { section: 'Cast', role: 'The Marshal', names: ['Scratch voice — to be cast'] },
    { section: 'Cast', role: 'FLAMINGO-07 · Halcyon Systems · Sable Accord', names: ['Designed voices'] },
    { section: 'Development', role: 'Game design, direction', names: ['Michael'] },
    { section: 'Development', role: 'Built with', names: ['SLU Web Shell', '@slu/narrative', '@slu/mech-frame (from BLINKFALL)', '@slu/perception', 'Three.js'] },
  ],
  legal: ['Three.js — MIT License'],
};

/** Rolling credits over black. Hold accept to speed up. */
export class CreditsRoll {
  private el: HTMLDivElement; private inner: HTMLDivElement; private y = 0; private done = false;
  constructor(root: HTMLElement, doc: CreditsDocument, private readonly onDone: () => void) {
    this.el = document.createElement('div'); this.el.className = 'nx-credits';
    this.inner = document.createElement('div'); this.el.appendChild(this.inner);
    const sections = [...new Set(doc.entries.map((e) => e.section ?? 'Credits'))];
    this.inner.innerHTML = `<h1>${doc.title ?? ''}</h1>` + sections.map((s) => `<h3>${s}</h3>` + doc.entries.filter((e) => (e.section ?? 'Credits') === s).map((e) => `<p><small>${e.role}</small>${e.names.map((n) => `<b>${n}</b>`).join('')}</p>`).join('')).join('') + (doc.legal ?? []).map((l) => `<p class="legal">${l}</p>`).join('') + '<div style="height:50vh"></div>';
    root.appendChild(this.el);
    this.y = innerHeight;
  }
  update(dt: number, fast: boolean): void {
    if (this.done) return;
    this.y -= dt * (fast ? 260 : 46);
    this.inner.style.transform = `translateY(${this.y}px)`;
    if (this.y < -this.inner.offsetHeight) { this.done = true; this.el.classList.add('out'); setTimeout(() => { this.el.remove(); this.onDone(); }, 900); }
  }
}
