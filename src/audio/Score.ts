/**
 * Adaptive score (GDD §14) — synthesized stand-ins for every cue in data/audio.ts MUSIC. A 16-step
 * scheduler with look-ahead; stems fade with alert state. Real stems at the manifest paths can
 * replace these later without touching gameplay (gameplay only names cues and layers).
 */
type Voice = 'pad' | 'pulse' | 'bass' | 'lead' | 'kick' | 'snare' | 'hat' | 'siren' | 'bell' | 'brass';
interface Pattern { bpm: number; steps: number; root: number; scale: number[]; tracks: Partial<Record<Voice, (step: number, bar: number) => number | null>>; layer?: Partial<Record<Voice, 'base' | 'suspicion' | 'hunted' | 'lockdown'>> }

const MINOR = [0, 2, 3, 5, 7, 8, 10];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const at = (steps: number[], v = 0) => (s: number) => (steps.includes(s) ? v : null);
const every = (n: number, v = 0, off = 0) => (s: number) => ((s + off) % n === 0 ? v : null);
const seq = (notes: (number | null)[]) => (s: number, bar: number) => notes[(bar * 16 + s) % notes.length] ?? null;

const WREN_MELODY: (number | null)[] = [7, null, null, null, 9, null, 10, null, 9, null, null, null, 7, null, null, null, 5, null, null, null, 7, null, 3, null, 2, null, null, null, null, null, null, null, 7, null, null, null, 9, null, 10, null, 12, null, null, null, 10, null, 9, null, 7, null, null, null, null, null, null, null, 3, null, 5, null, 7, null, null, null];

const PATTERNS: Record<string, Pattern> = {
  title: { bpm: 60, steps: 16, root: 45, scale: MINOR, tracks: { pad: every(16, 0), bell: seq([4, null, null, null, null, null, null, null, 2, null, null, null, null, null, null, null, 0, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null]) } },
  infiltration: {
    bpm: 84, steps: 16, root: 38, scale: MINOR,
    tracks: { pad: every(16, 0), pulse: every(4, 0), bass: at([0, 10], 0), hat: every(2, 0, 1), snare: at([4, 12]), kick: at([0, 3, 8, 11]), siren: every(8, 0), lead: seq([4, null, null, 3, null, null, 2, null, null, null, null, null, null, null, null, null]) },
    layer: { pad: 'base', pulse: 'base', bass: 'base', lead: 'suspicion', hat: 'suspicion', kick: 'hunted', snare: 'hunted', siren: 'lockdown' },
  },
  timedZone: { bpm: 128, steps: 16, root: 40, scale: MINOR, tracks: { kick: every(4, 0), hat: every(2, 0, 1), bass: every(2, 0), pulse: every(1, 4), snare: at([4, 12]), pad: every(16, 0) } },
  wren: { bpm: 70, steps: 16, root: 50, scale: DORIAN, tracks: { pad: every(16, 0), lead: seq(WREN_MELODY) } },
  credits: { bpm: 72, steps: 16, root: 50, scale: DORIAN, tracks: { pad: every(8, 0), lead: seq(WREN_MELODY), bass: at([0, 8], 0), bell: seq([null, null, null, null, null, null, null, null, 7, null, null, null, null, null, null, null]) } },
  aegis: { bpm: 96, steps: 16, root: 38, scale: MINOR, tracks: { brass: seq([0, null, null, null, null, null, 4, null, 3, null, null, null, 2, null, null, null, 0, null, null, null, null, null, 5, null, 4, null, null, null, 7, null, null, null]), kick: at([0, 6, 8, 14]), snare: at([4, 12]), bass: every(2, 0), pad: every(16, 0), hat: every(2, 0, 1) } },
  marshal1: { bpm: 104, steps: 16, root: 37, scale: MINOR, tracks: { kick: at([0, 8, 10]), snare: at([4, 12]), bass: at([0, 3, 6, 8, 11, 14], 0), pad: every(16, 0), brass: seq([0, null, null, null, 1, null, null, null, 0, null, null, null, null, null, null, null]) } },
  marshal2: { bpm: 112, steps: 16, root: 37, scale: MINOR, tracks: { kick: at([0, 4, 8, 10, 12]), snare: at([4, 12]), hat: every(1, 0), bass: every(2, 0), pad: every(16, 0), brass: seq([0, null, 1, null, 3, null, 1, null, 0, null, null, null, -2, null, null, null]) } },
  marshal3: { bpm: 124, steps: 16, root: 37, scale: MINOR, tracks: { kick: every(2, 0), snare: at([4, 12, 14]), hat: every(1, 0), bass: every(1, 0), pad: every(8, 0), brass: seq([0, 1, 3, null, 1, 0, -2, null, 0, 1, 3, 5, 3, 1, 0, null]), siren: every(8, 0) } },
  ascent: { bpm: 120, steps: 16, root: 38, scale: MINOR, tracks: { kick: every(4, 0), bass: every(2, 0), pad: every(8, 0), pulse: every(1, 7), brass: seq([0, null, null, null, null, null, null, null, 4, null, null, null, null, null, null, null, 5, null, null, null, null, null, null, null, 7, null, null, null, null, null, null, null]), snare: at([4, 12]) } },
};
export const SCORE_CUES = Object.keys(PATTERNS);

export class Score {
  private out: GainNode;
  private cue: string | null = null;
  private pattern: Pattern | null = null;
  private nextTime = 0;
  private step = 0;
  private bar = 0;
  private tempoMult = 1;
  private layers = { base: 1, suspicion: 0, hunted: 0, lockdown: 0 };
  private target = { suspicion: 0, hunted: 0, lockdown: 0 };
  private noise: AudioBuffer;
  constructor(private readonly ctx: AudioContext, bus: GainNode) {
    this.out = ctx.createGain(); this.out.gain.value = 0; this.out.connect(bus);
    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = this.noise.getChannelData(0); let s = 7; for (let i = 0; i < d.length; i++) { s = (s * 16807) % 2147483647; d[i] = (s / 2147483647) * 2 - 1; }
  }

  get current(): string | null { return this.cue; }

  play(cue: string | null, fade = 1.2): void {
    if (cue === this.cue) return;
    const t = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setTargetAtTime(0, t, fade / 4);
    this.cue = cue;
    this.tempoMult = 1;
    if (!cue || !PATTERNS[cue]) { this.pattern = null; return; }
    const p = PATTERNS[cue]!;
    setTimeout(() => {
      if (this.cue !== cue) return;
      this.pattern = p; this.step = 0; this.bar = 0; this.nextTime = this.ctx.currentTime + 0.05;
      this.out.gain.setTargetAtTime(cue === 'title' || cue === 'wren' ? 0.5 : 0.6, this.ctx.currentTime, 0.4);
    }, this.pattern ? fade * 500 : 0);
  }

  setLayers(l: Partial<Record<'suspicion' | 'hunted' | 'lockdown', number>>): void { Object.assign(this.target, l); }
  setTempoMult(m: number): void { this.tempoMult = m; }

  sting(_kind: 'collapse'): void {
    const t = this.ctx.currentTime;
    this.note('brass', 26, t, 1.6, 0.35);
    this.note('kick', 0, t, 0.8, 0.8);
  }

  update(dt: number): void {
    for (const k of ['suspicion', 'hunted', 'lockdown'] as const) this.layers[k] += (this.target[k] - this.layers[k]) * Math.min(1, dt * 1.5);
    const p = this.pattern; if (!p) return;
    const spb = 60 / (p.bpm * this.tempoMult) / 4;
    while (this.nextTime < this.ctx.currentTime + 0.12) {
      for (const [v, fn] of Object.entries(p.tracks) as [Voice, (s: number, b: number) => number | null][]) {
        const deg = fn(this.step, this.bar);
        if (deg === null) continue;
        const lay = p.layer?.[v] ?? 'base';
        const lg = this.layers[lay];
        if (lg < 0.03) continue;
        const oct = Math.floor(deg / p.scale.length), idx = ((deg % p.scale.length) + p.scale.length) % p.scale.length;
        const midi = p.root + p.scale[idx]! + oct * 12;
        const bassShift = (this.bar % 4 === 3 ? 5 : this.bar % 4 === 2 ? 3 : 0);
        this.note(v, midi + (v === 'pad' || v === 'bass' ? bassShift : 0), this.nextTime, spb, lg);
      }
      this.nextTime += spb;
      this.step = (this.step + 1) % p.steps;
      if (this.step === 0) this.bar++;
    }
  }

  private note(v: Voice, midi: number, t: number, spb: number, g: number): void {
    const ctx = this.ctx; const f = 440 * Math.pow(2, (midi - 69) / 12);
    const gain = ctx.createGain(); gain.connect(this.out);
    const env = (peak: number, att: number, dur: number) => { gain.gain.setValueAtTime(0.0001, t); gain.gain.linearRampToValueAtTime(peak * g, t + att); gain.gain.setTargetAtTime(0.0001, t + att, dur / 4); };
    const osc = (type: OscillatorType, freq: number, dur: number, detune = 0) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq; o.detune.value = detune; o.connect(gain); o.start(t); o.stop(t + dur + 0.1); return o; };
    const noise = (dur: number, ftype: BiquadFilterType, ff: number) => { const s = ctx.createBufferSource(); s.buffer = this.noise; const fl = ctx.createBiquadFilter(); fl.type = ftype; fl.frequency.value = ff; s.connect(fl); fl.connect(gain); s.start(t); s.stop(t + dur); };
    switch (v) {
      case 'pad': { env(0.09, 1.2, spb * 16); const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; gain.disconnect(); gain.connect(lp); lp.connect(this.out); for (const [m, d] of [[0, -6], [7, 5], [12, 0], [3, 8]] as const) osc('sawtooth', f * Math.pow(2, m / 12) / 2, spb * 18, d); break; }
      case 'pulse': env(0.06, 0.005, spb * 1.2); osc('triangle', f * 2, spb * 1.5); break;
      case 'bass': env(0.16, 0.01, spb * 2); osc('sawtooth', f / 2, spb * 2.5); osc('sine', f / 4, spb * 2.5); break;
      case 'lead': env(0.08, 0.04, spb * 6); { const o = osc('triangle', f * 2, spb * 8); const lfo = ctx.createOscillator(); lfo.frequency.value = 5; const lg = ctx.createGain(); lg.gain.value = 6; lfo.connect(lg); lg.connect(o.detune); lfo.start(t); lfo.stop(t + spb * 8); } break;
      case 'bell': env(0.07, 0.005, spb * 16); osc('sine', f * 4, spb * 16); osc('sine', f * 8.01, spb * 8); break;
      case 'brass': env(0.07, 0.06, spb * 8); osc('sawtooth', f, spb * 8, -5); osc('sawtooth', f, spb * 8, 5); osc('square', f / 2, spb * 8); break;
      case 'kick': { env(0.5, 0.002, 0.25); const o = osc('sine', 120, 0.3); o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.15); break; }
      case 'snare': env(0.18, 0.002, 0.18); noise(0.2, 'highpass', 1500); osc('triangle', 190, 0.1); break;
      case 'hat': env(0.05, 0.001, 0.05); noise(0.06, 'highpass', 7000); break;
      case 'siren': { env(0.05, 0.1, spb * 8); const o = osc('sawtooth', 660, spb * 8); o.frequency.setValueAtTime(660, t); o.frequency.linearRampToValueAtTime(520, t + spb * 4); o.frequency.linearRampToValueAtTime(660, t + spb * 8); break; }
    }
  }
}
