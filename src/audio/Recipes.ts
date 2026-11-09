/**
 * Synth fallback recipes for every SFX id in data/audio.ts. Rendered once to AudioBuffers at boot;
 * a real file at the manifest path replaces the recipe with no code change.
 */
export type Wave = 'noise' | 'sine' | 'square' | 'sawtooth' | 'triangle';
export interface Layer {
  wave: Wave;
  f0?: number; f1?: number;
  dur: number;
  attack?: number;
  /** Exponential decay shape: larger = faster. */
  curve?: number;
  gain?: number;
  delay?: number;
  filter?: { type: BiquadFilterType; f0: number; f1?: number; q?: number };
  /** Amplitude tremolo Hz. */
  trem?: number;
  repeat?: { n: number; every: number };
}
export interface Recipe { layers: Layer[]; length?: number }

const thud = (f: number, d: number, g = 1): Layer => ({ wave: 'sine', f0: f, f1: f * 0.4, dur: d, curve: 6, gain: g });
const hiss = (lo: number, hi: number, d: number, g = 0.6, type: BiquadFilterType = 'bandpass'): Layer => ({ wave: 'noise', dur: d, curve: 5, gain: g, filter: { type, f0: lo, f1: hi, q: 0.8 } });
const crack = (d = 0.08, g = 1): Layer => ({ wave: 'noise', dur: d, curve: 14, gain: g, filter: { type: 'highpass', f0: 1800 } });

export const RECIPES: Record<string, Recipe> = {
  'foot.snow': { layers: [hiss(500, 300, 0.16, 0.5, 'lowpass'), { ...hiss(2200, 1200, 0.08, 0.25), delay: 0.02 }] },
  'foot.ice': { layers: [crack(0.04, 0.4), thud(180, 0.08, 0.3)] },
  'foot.metal': { layers: [{ wave: 'square', f0: 340, f1: 280, dur: 0.06, curve: 12, gain: 0.12 }, thud(120, 0.1, 0.4), hiss(3000, 2000, 0.05, 0.15)] },
  'foot.water': { layers: [hiss(900, 400, 0.3, 0.5), { wave: 'sine', f0: 600, f1: 1400, dur: 0.12, curve: 8, gain: 0.08, delay: 0.04 }] },
  'breath.calm': { layers: [{ ...hiss(700, 500, 1.1, 0.12, 'bandpass'), attack: 0.5, curve: 2 }, { ...hiss(500, 400, 1.3, 0.08, 'bandpass'), attack: 0.6, curve: 2, delay: 1.5 }] },
  'breath.exert': { layers: [{ ...hiss(900, 600, 0.45, 0.2), attack: 0.15, curve: 3, repeat: { n: 4, every: 0.6 } }] },
  'breath.hurt': { layers: [{ ...hiss(800, 500, 0.5, 0.22), attack: 0.1, curve: 3, repeat: { n: 3, every: 0.8 } }, { wave: 'sine', f0: 140, f1: 110, dur: 0.4, curve: 3, gain: 0.05, delay: 0.1 }] },
  'takedown.hit': { layers: [thud(90, 0.35, 1), hiss(1200, 300, 0.2, 0.5, 'lowpass'), { wave: 'square', f0: 60, f1: 40, dur: 0.12, curve: 10, gain: 0.15 }] },
  'takedown.chain': { layers: [thud(110, 0.25, 0.9), crack(0.05, 0.5), hiss(1500, 400, 0.12, 0.35, 'lowpass')] },
  'slide': { layers: [{ ...hiss(1800, 600, 0.6, 0.45), curve: 2.5 }] },
  'mantle': { layers: [thud(150, 0.12, 0.35), hiss(2500, 1500, 0.2, 0.2), { ...thud(100, 0.15, 0.4), delay: 0.25 }] },
  'gear.rattle': { layers: [{ ...hiss(4000, 3000, 0.04, 0.25), repeat: { n: 4, every: 0.05 } }] },
  'land': { layers: [thud(80, 0.3, 0.8), hiss(600, 200, 0.25, 0.5, 'lowpass')] },
  'sidearm.fire': { layers: [{ wave: 'noise', dur: 0.12, curve: 12, gain: 0.7, filter: { type: 'bandpass', f0: 1400, f1: 800, q: 1.2 } }, thud(160, 0.08, 0.35), { ...crack(0.03, 0.3), delay: 0.08 }] },
  'carbine.fire': { layers: [crack(0.06, 1), { wave: 'noise', dur: 0.45, curve: 6, gain: 0.7, filter: { type: 'lowpass', f0: 2400, f1: 500 } }, thud(70, 0.25, 0.8)] },
  'shotgun.fire': { layers: [crack(0.08, 1), { wave: 'noise', dur: 0.9, curve: 4, gain: 0.9, filter: { type: 'lowpass', f0: 1800, f1: 200 } }, thud(50, 0.5, 1)] },
  'reload': { layers: [{ wave: 'square', f0: 900, f1: 700, dur: 0.04, curve: 14, gain: 0.15 }, { wave: 'square', f0: 600, f1: 500, dur: 0.05, curve: 14, gain: 0.18, delay: 0.55 }, { ...crack(0.04, 0.4), delay: 1.1 }] },
  'empty': { layers: [{ wave: 'square', f0: 1400, f1: 1200, dur: 0.03, curve: 16, gain: 0.2 }] },
  'shell.ice': { layers: [{ wave: 'sine', f0: 3200, f1: 2800, dur: 0.08, curve: 10, gain: 0.08, repeat: { n: 3, every: 0.09 } }] },
  'hit.flesh': { layers: [thud(140, 0.12, 0.6), hiss(900, 400, 0.08, 0.4)] },
  'hit.world': { layers: [crack(0.05, 0.4), hiss(3000, 1500, 0.1, 0.2)] },
  'throw': { layers: [{ ...hiss(800, 2400, 0.3, 0.3), attack: 0.1, curve: 3 }] },
  'flash.bang': { layers: [crack(0.1, 1), { wave: 'sine', f0: 5200, f1: 4800, dur: 1.4, curve: 2, gain: 0.08 }, thud(60, 0.5, 1)] },
  'decoy.ping': { layers: [{ wave: 'noise', dur: 0.1, curve: 10, gain: 0.4, filter: { type: 'bandpass', f0: 900, q: 2 }, repeat: { n: 3, every: 0.25 } }] },
  'sting.suspicious': { layers: [{ wave: 'sine', f0: 220, f1: 330, dur: 1.2, attack: 0.3, curve: 2, gain: 0.25 }, { wave: 'sine', f0: 233, f1: 349, dur: 1.2, attack: 0.3, curve: 2, gain: 0.2 }] },
  'sting.hunted': { layers: [{ wave: 'sawtooth', f0: 110, f1: 104, dur: 1.4, curve: 3, gain: 0.3, filter: { type: 'lowpass', f0: 1800, f1: 600 } }, { wave: 'sawtooth', f0: 165, f1: 156, dur: 1.4, curve: 3, gain: 0.25, filter: { type: 'lowpass', f0: 1800, f1: 600 } }, thud(55, 0.6, 1)] },
  'siren.lockdown': { layers: [{ wave: 'sawtooth', f0: 660, f1: 660, dur: 0.6, attack: 0.02, curve: 0.5, gain: 0.14, filter: { type: 'lowpass', f0: 2000 }, repeat: { n: 3, every: 1.0 } }, { wave: 'sawtooth', f0: 520, f1: 520, dur: 0.4, attack: 0.02, curve: 0.5, gain: 0.14, delay: 0.6, filter: { type: 'lowpass', f0: 2000 }, repeat: { n: 3, every: 1.0 } }] },
  'gate.slam': { layers: [thud(45, 1.1, 1), crack(0.1, 0.7), hiss(400, 100, 0.8, 0.5, 'lowpass')] },
  'alarm.pulse': { layers: [{ wave: 'square', f0: 880, f1: 880, dur: 0.2, curve: 4, gain: 0.12, filter: { type: 'lowpass', f0: 2400 } }] },
  'hack.tick': { layers: [{ wave: 'square', f0: 1800, f1: 1700, dur: 0.05, curve: 10, gain: 0.25, repeat: { n: 2, every: 0.12 } }, { wave: 'sawtooth', f0: 220, f1: 200, dur: 0.25, curve: 6, gain: 0.2 }] },
  'visor.pulse': { layers: [{ wave: 'sine', f0: 1800, f1: 600, dur: 1.2, curve: 3, gain: 0.25 }, { wave: 'sine', f0: 2400, f1: 900, dur: 0.6, curve: 4, gain: 0.1, delay: 0.05 }] },
  'rumble.bed': { layers: [{ wave: 'noise', dur: 8, attack: 1, curve: 0.6, gain: 0.5, filter: { type: 'lowpass', f0: 90, q: 0.7 } }, { wave: 'sine', f0: 34, f1: 30, dur: 8, attack: 1.5, curve: 0.5, gain: 0.3 }] },
  'ice.crack.near': { layers: [crack(0.12, 1), { wave: 'sine', f0: 900, f1: 120, dur: 0.6, curve: 5, gain: 0.3 }, { ...crack(0.06, 0.6), delay: 0.15 }, thud(60, 0.9, 0.6)] },
  'ice.crack.far': { layers: [{ ...crack(0.15, 0.5), filter: { type: 'bandpass', f0: 900, q: 0.6 } }, { wave: 'sine', f0: 500, f1: 80, dur: 1.5, curve: 3, gain: 0.25 }] },
  'structure.groan': { layers: [{ wave: 'sawtooth', f0: 70, f1: 52, dur: 2.4, attack: 0.4, curve: 1.2, gain: 0.25, filter: { type: 'bandpass', f0: 300, f1: 180, q: 3 }, trem: 5 }, { ...crack(0.2, 0.4), delay: 1.8 }] },
  'debris.whistle': { layers: [{ wave: 'sine', f0: 2600, f1: 400, dur: 1.5, attack: 0.3, curve: 0.6, gain: 0.25 }, { wave: 'noise', dur: 1.5, attack: 0.8, curve: 0.5, gain: 0.25, filter: { type: 'bandpass', f0: 3000, f1: 600, q: 2 } }] },
  'debris.impact': { layers: [thud(40, 1.4, 1), crack(0.15, 1), { wave: 'noise', dur: 1.6, curve: 3, gain: 0.8, filter: { type: 'lowpass', f0: 1200, f1: 120 } }] },
  'shelf.tilt': { layers: [{ wave: 'sine', f0: 30, f1: 22, dur: 3, attack: 0.3, curve: 0.8, gain: 0.6 }, { wave: 'sawtooth', f0: 48, f1: 40, dur: 3, attack: 1, curve: 1, gain: 0.15, filter: { type: 'lowpass', f0: 240 }, trem: 3 }, { ...crack(0.2, 0.6), delay: 2.4 }] },
  'steam.vent': { layers: [{ wave: 'noise', dur: 3, attack: 0.15, curve: 1, gain: 0.55, filter: { type: 'highpass', f0: 2200 } }] },
  'aurora.flare': { layers: [{ wave: 'noise', dur: 1.5, attack: 0.6, curve: 2, gain: 0.35, filter: { type: 'bandpass', f0: 3000, f1: 6000, q: 0.5 } }, { wave: 'sine', f0: 3000, f1: 7000, dur: 1.3, attack: 0.5, curve: 2, gain: 0.05 }] },
  'cache.chime': { layers: [{ wave: 'sine', f0: 880, f1: 880, dur: 1, curve: 3, gain: 0.25 }, { wave: 'sine', f0: 1318, f1: 1318, dur: 0.9, curve: 3, gain: 0.18, delay: 0.12 }, { wave: 'sine', f0: 1760, f1: 1760, dur: 0.8, curve: 3, gain: 0.1, delay: 0.24 }] },
  'cache.click': { layers: [{ wave: 'square', f0: 2000, f1: 1500, dur: 0.02, curve: 20, gain: 0.3 }, { ...crack(0.03, 0.2), delay: 0.05 }] },
  'cache.hiss': { layers: [{ wave: 'noise', dur: 4, attack: 0.2, curve: 0.4, gain: 0.08, filter: { type: 'bandpass', f0: 3500, q: 0.5 } }] },
  'mech.servo': { layers: [{ wave: 'sawtooth', f0: 180, f1: 260, dur: 0.6, attack: 0.05, curve: 3, gain: 0.12, filter: { type: 'lowpass', f0: 900 } }] },
  'mech.step': { layers: [thud(45, 0.7, 1), crack(0.08, 0.5), hiss(500, 120, 0.5, 0.6, 'lowpass')] },
  'mech.boost': { layers: [{ wave: 'noise', dur: 0.6, attack: 0.01, curve: 4, gain: 0.9, filter: { type: 'lowpass', f0: 4000, f1: 600 } }, thud(70, 0.4, 0.7)] },
  'mech.assault': { layers: [{ wave: 'noise', dur: 3, attack: 0.2, curve: 0.3, gain: 0.6, filter: { type: 'lowpass', f0: 1400, q: 0.8 } }, { wave: 'sawtooth', f0: 55, f1: 60, dur: 3, attack: 0.3, curve: 0.3, gain: 0.15, filter: { type: 'lowpass', f0: 400 } }] },
  'mech.lock': { layers: [{ wave: 'square', f0: 1200, f1: 1200, dur: 0.08, curve: 6, gain: 0.15 }, { wave: 'square', f0: 1600, f1: 1600, dur: 0.1, curve: 6, gain: 0.15, delay: 0.1 }] },
  'mech.rifle': { layers: [crack(0.05, 0.8), { wave: 'noise', dur: 0.35, curve: 7, gain: 0.6, filter: { type: 'lowpass', f0: 1600, f1: 300 } }, thud(60, 0.2, 0.7)] },
  'mech.cannon': { layers: [thud(32, 1.5, 1), crack(0.15, 1), { wave: 'noise', dur: 1.6, curve: 2.5, gain: 1, filter: { type: 'lowpass', f0: 900, f1: 80 } }] },
  'mech.missile': { layers: [{ wave: 'noise', dur: 0.8, attack: 0.02, curve: 3, gain: 0.6, filter: { type: 'bandpass', f0: 1200, f1: 3000, q: 0.7 } }] },
  'mech.blade': { layers: [{ wave: 'sawtooth', f0: 180, f1: 900, dur: 0.35, attack: 0.02, curve: 3, gain: 0.25, filter: { type: 'bandpass', f0: 1500, q: 2 } }, hiss(3000, 6000, 0.4, 0.4)] },
  'mech.shove': { layers: [thud(70, 0.4, 1), hiss(800, 200, 0.3, 0.5, 'lowpass')] },
  'mech.alarm': { layers: [{ wave: 'square', f0: 740, f1: 740, dur: 0.25, curve: 1, gain: 0.12, filter: { type: 'lowpass', f0: 2200 }, repeat: { n: 2, every: 0.4 } }] },
  'mech.systemloss': { layers: [{ wave: 'sine', f0: 880, f1: 220, dur: 0.9, curve: 2, gain: 0.25 }, { wave: 'square', f0: 110, f1: 100, dur: 0.6, curve: 3, gain: 0.08 }] },
  'mech.explosion': { layers: [thud(30, 2.2, 1), crack(0.2, 1), { wave: 'noise', dur: 2.4, curve: 2, gain: 1, filter: { type: 'lowpass', f0: 1400, f1: 60 } }] },
  'ascent.roar': { layers: [{ wave: 'noise', dur: 4, attack: 0.5, curve: 0.2, gain: 0.8, filter: { type: 'lowpass', f0: 700, q: 0.6 } }, { wave: 'sawtooth', f0: 40, f1: 42, dur: 4, attack: 0.5, curve: 0.2, gain: 0.2, filter: { type: 'lowpass', f0: 300 } }] },
  'ascent.buffet': { layers: [{ wave: 'noise', dur: 2, attack: 0.1, curve: 1.5, gain: 0.6, filter: { type: 'lowpass', f0: 300 }, trem: 9 }] },
  'ascent.jettison': { layers: [thud(55, 0.8, 1), { wave: 'square', f0: 140, f1: 70, dur: 0.3, curve: 8, gain: 0.3 }, { ...crack(0.1, 0.8), delay: 0.25 }, { wave: 'noise', dur: 1, curve: 3, gain: 0.4, delay: 0.3, filter: { type: 'highpass', f0: 1500 } }] },
  'ascent.debris': { layers: [crack(0.06, 0.8), thud(90, 0.3, 0.6)] },
  'cockpit.breath': { layers: [{ ...hiss(600, 450, 1.6, 0.16), attack: 0.8, curve: 1.6 }, { ...hiss(450, 380, 2.0, 0.12), attack: 0.9, curve: 1.6, delay: 2.4 }] },
  'reactor.tick': { layers: [{ wave: 'sine', f0: 1100, f1: 1000, dur: 0.05, curve: 12, gain: 0.12 }, { wave: 'sine', f0: 60, f1: 55, dur: 0.6, curve: 4, gain: 0.08 }] },
  'ui.tick': { layers: [{ wave: 'sine', f0: 1600, f1: 1500, dur: 0.05, curve: 12, gain: 0.15 }] },
  'ui.confirm': { layers: [{ wave: 'sine', f0: 900, f1: 900, dur: 0.12, curve: 8, gain: 0.2 }, { wave: 'sine', f0: 1350, f1: 1350, dur: 0.14, curve: 8, gain: 0.15, delay: 0.06 }] },
  'ui.back': { layers: [{ wave: 'sine', f0: 900, f1: 600, dur: 0.15, curve: 8, gain: 0.18 }] },
  'ui.title': { layers: [thud(40, 2.4, 1), { wave: 'sawtooth', f0: 55, f1: 55, dur: 2.4, attack: 0.02, curve: 1.6, gain: 0.2, filter: { type: 'lowpass', f0: 800, f1: 200 } }, { wave: 'noise', dur: 2.2, curve: 2, gain: 0.3, filter: { type: 'lowpass', f0: 2000, f1: 200 } }] },
  'ui.ping': { layers: [{ wave: 'sine', f0: 1400, f1: 1400, dur: 0.5, curve: 4, gain: 0.15 }, { wave: 'sine', f0: 2100, f1: 2100, dur: 0.4, curve: 4, gain: 0.08, delay: 0.1 }] },
  'ui.checkpoint': { layers: [{ wave: 'sine', f0: 700, f1: 1050, dur: 0.35, curve: 4, gain: 0.12 }] },
  'enemy.shot': { layers: [crack(0.05, 0.8), { wave: 'noise', dur: 0.35, curve: 7, gain: 0.55, filter: { type: 'bandpass', f0: 1800, f1: 600, q: 0.8 } }, thud(90, 0.15, 0.5)] },
  'enemy.glint': { layers: [{ wave: 'sine', f0: 3400, f1: 3600, dur: 0.06, curve: 10, gain: 0.07 }] },
  'enemy.lmg': { layers: [{ ...crack(0.04, 0.6), repeat: { n: 8, every: 0.08 } }, { wave: 'noise', dur: 0.9, curve: 3, gain: 0.4, filter: { type: 'lowpass', f0: 1200, f1: 300 } }] },
  'enemy.drone': { layers: [{ wave: 'sawtooth', f0: 210, f1: 210, dur: 2, attack: 0.3, curve: 0.2, gain: 0.05, filter: { type: 'bandpass', f0: 420, q: 3 }, trem: 31 }] },
  'enemy.hound': { layers: [{ wave: 'sawtooth', f0: 90, f1: 140, dur: 0.6, attack: 0.05, curve: 3, gain: 0.25, filter: { type: 'bandpass', f0: 500, q: 2 }, trem: 24 }, thud(80, 0.2, 0.5)] },
  'enemy.death': { layers: [thud(70, 0.5, 0.7), hiss(500, 200, 0.4, 0.5, 'lowpass')] },
  'enemy.flare': { layers: [{ wave: 'noise', dur: 1.2, attack: 0.02, curve: 2, gain: 0.5, filter: { type: 'bandpass', f0: 2000, f1: 900, q: 0.8 } }, { ...crack(0.08, 0.6), delay: 0.9 }] },
  'enemy.rocket': { layers: [{ wave: 'noise', dur: 1, attack: 0.02, curve: 2.5, gain: 0.7, filter: { type: 'lowpass', f0: 2600, f1: 500 } }] },
  'radio.click': { layers: [{ wave: 'square', f0: 1800, f1: 1600, dur: 0.03, curve: 20, gain: 0.2 }, { wave: 'noise', dur: 0.12, curve: 8, gain: 0.15, filter: { type: 'bandpass', f0: 2500, q: 1 } }] },
  'voice.mumble': { layers: [{ wave: 'sawtooth', f0: 140, f1: 120, dur: 0.5, attack: 0.05, curve: 2, gain: 0.05, filter: { type: 'bandpass', f0: 700, q: 4 }, trem: 7 }] },
};
