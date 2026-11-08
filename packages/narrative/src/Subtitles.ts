export type SubtitleSize = 'small' | 'medium' | 'large' | 'xl';
export interface SubtitleSettings {
  enabled: boolean;
  size: SubtitleSize;
  /** Background panel opacity 0..1. */
  background: number;
  /** Colour speaker labels by speaker. */
  speakerColors: boolean;
  /** Show caption descriptions for sound ("[siren]"). */
  captions: boolean;
}
export const DEFAULT_SUBTITLE_SETTINGS: SubtitleSettings = { enabled: true, size: 'medium', background: 0.55, speakerColors: true, captions: true };

export interface SubtitleCue {
  id: string;
  speakerLabel?: string;
  color?: string;
  text: string;
  /** Sound description rather than speech. */
  caption?: boolean;
  /** Lower lines render dimmer (barks under VO). */
  dim?: boolean;
}

const SIZES: Record<SubtitleSize, string> = { small: '16px', medium: '20px', large: '26px', xl: '34px' };

/**
 * Subtitle presentation: speaker labels in speaker colour, size options, background opacity and
 * caption descriptions. DOM only, no styling assumptions beyond its own class names.
 */
export class SubtitleView {
  private el: HTMLDivElement;
  private cues = new Map<string, { cue: SubtitleCue; node: HTMLDivElement }>();
  settings: SubtitleSettings;

  constructor(root: HTMLElement, settings: Partial<SubtitleSettings> = {}) {
    this.settings = { ...DEFAULT_SUBTITLE_SETTINGS, ...settings };
    this.el = document.createElement('div');
    this.el.className = 'nv-subs';
    this.el.setAttribute('aria-live', 'polite');
    Object.assign(this.el.style, { position: 'absolute', left: '50%', bottom: '11%', transform: 'translateX(-50%)', width: 'min(92vw, 980px)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', pointerEvents: 'none', zIndex: '40' });
    root.appendChild(this.el);
  }

  apply(settings: Partial<SubtitleSettings>): void {
    this.settings = { ...this.settings, ...settings };
    for (const { cue, node } of this.cues.values()) this.paint(node, cue);
  }

  show(cue: SubtitleCue): void {
    if (cue.caption && !this.settings.captions) return;
    this.hide(cue.id);
    const node = document.createElement('div');
    node.className = 'nv-sub';
    this.paint(node, cue);
    this.el.appendChild(node);
    this.cues.set(cue.id, { cue, node });
    while (this.el.children.length > 3) { const first = this.el.firstElementChild as HTMLDivElement; const id = [...this.cues.entries()].find(([, v]) => v.node === first)?.[0]; if (id) this.hide(id); else first.remove(); }
  }

  hide(id: string): void { const c = this.cues.get(id); if (c) { c.node.remove(); this.cues.delete(id); } }
  clear(): void { for (const id of [...this.cues.keys()]) this.hide(id); }
  get visible(): string[] { return [...this.cues.values()].map((c) => c.cue.text); }

  private paint(node: HTMLDivElement, cue: SubtitleCue): void {
    const s = this.settings;
    node.style.display = s.enabled ? 'block' : 'none';
    Object.assign(node.style, { fontSize: SIZES[s.size], lineHeight: '1.35', padding: '6px 14px', borderRadius: '4px', background: `rgba(4,8,12,${s.background})`, color: '#eef3f6', textAlign: 'center', opacity: cue.dim ? '0.72' : '1', textShadow: s.background < 0.3 ? '0 1px 3px #000, 0 0 2px #000' : 'none', maxWidth: '100%' });
    node.textContent = '';
    if (cue.caption) {
      const c = document.createElement('span'); c.textContent = cue.text; c.style.fontStyle = 'italic'; c.style.opacity = '0.85'; node.appendChild(c); return;
    }
    if (cue.speakerLabel) {
      const l = document.createElement('span');
      l.textContent = `${cue.speakerLabel}: `;
      l.style.fontWeight = '700';
      l.style.letterSpacing = '0.06em';
      l.style.color = s.speakerColors && cue.color ? cue.color : '#ffffff';
      node.appendChild(l);
    }
    node.appendChild(document.createTextNode(cue.text));
  }
}
