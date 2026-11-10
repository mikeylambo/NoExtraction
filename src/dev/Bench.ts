import type { App } from '../game/App';
import { detectGpu, gpuName, quality, tierSettings } from '../render/quality';
import { CHAPTERS } from '../../data/chapters';

/**
 * Benchmark mode for real hardware: open the game with `?bench` (or `?bench=ch1,ch5`, plus `&q=low`
 * to force the low tier). After one click it plays each chapter's heaviest spot (the same spots as
 * tools/perf.mjs) with god mode on and a slow camera sweep, measures unclamped frame times, and
 * shows a report to copy or download. Takes about 2 minutes for all six chapters.
 */

interface NxApi {
  skip(): void; teleport(x: number, y: number, z: number): void; godMode(on?: boolean): void;
  setAlert(level: 'unaware' | 'suspicious' | 'hunted' | 'lockdown'): void;
}

/** Each chapter's representative heavy spot (keep in step with tools/perf.mjs). */
const SPOTS: Record<string, { warmup: number; setup: (n: NxApi, app: App) => void }> = {
  ch1: { warmup: 4, setup: (n) => { n.skip(); n.teleport(0, 0, 40); n.setAlert('hunted'); } },
  ch2: { warmup: 4, setup: (n) => { n.skip(); n.teleport(0, 0, 0); } },
  ch3: { warmup: 4, setup: (n) => { n.skip(); n.teleport(0, 0, -80); } },
  ch4: { warmup: 4, setup: (n) => { n.skip(); n.teleport(0, 0, -40); } },
  ch5: {
    warmup: 12,
    setup: (n, app) => {
      n.skip(); app.session.callHook('enterCockpit'); app.session.callHook('online');
      const w = app.session.w;
      for (const f of ['c5.firstKill', 'c5.wardensDone', 'c5.stormDone', 'c5.ambushDone', 'c5.shelfOnce', 'c5.ambushOnce']) w.state.set(f);
      w.aegis!.frame.pos.set(0, 0, -9000);
    },
  },
  ch6: { warmup: 4, setup: (n) => { n.skip(); } },
};

export interface BenchChapter {
  chapter: string; seconds: number; frames: number;
  fpsAvg: number; msAvg: number; msP50: number; msP95: number; msP99: number; msMax: number;
  /** Share of frames slower than 33.3 ms (below 30 fps), percent. */
  slowPct: number;
  drawCallsMax: number; trianglesMax: number; programs: number; textures: number; geometries: number;
  heapMB?: number;
}
export interface BenchReport {
  version: 1; at: string; url: string;
  machine: { gpu: string; tier: string; userAgent: string; cores: number; memoryGB?: number; screen: string; dpr: number; canvas: string; pixelRatio: number };
  results: BenchChapter[];
}

const sleep = (s: number) => new Promise((r) => setTimeout(r, s * 1000));
const pct = (sorted: number[], p: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0;
const r2 = (v: number) => Math.round(v * 100) / 100;

export class Bench {
  private el = document.createElement('div');
  constructor(private readonly app: App) {
    Object.assign(this.el.style, {
      position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', zIndex: '9999', background: 'rgba(8,12,18,0.94)',
      color: '#e8eef3', font: '14px/1.5 system-ui, sans-serif', padding: '24px 28px', borderRadius: '10px', maxWidth: 'min(92vw, 880px)',
      maxHeight: '88vh', overflow: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,0.5)', textAlign: 'left',
    });
  }

  /** Show the start card; the click doubles as the browser gesture that unlocks audio. */
  start(): void {
    detectGpu(this.app.renderer); // also when the tier was chosen in options rather than detected
    const list = this.chapters();
    this.el.innerHTML = `<h2 style="margin:0 0 8px;font-size:20px">Benchmark</h2>
      <p style="margin:0 0 6px">Plays ${list.length} chapter${list.length > 1 ? 's' : ''} (${list.join(', ')}) at their heaviest spot, about ${Math.round(list.length * 20 / 60 * 10) / 10} min.</p>
      <p style="margin:0 0 6px">GPU: <b>${gpuName()}</b> · quality tier: <b>${quality()}</b> · window ${innerWidth}×${innerHeight} @ ${devicePixelRatio}x</p>
      <p style="margin:0 0 14px;color:#9fb0c0">Keep this tab in front and the window at the size you play at (fullscreen is best). Plug laptops in.</p>
      <button style="font:inherit;padding:8px 18px;border-radius:6px;border:0;background:#3a6ea5;color:#fff;cursor:pointer">Start</button>`;
    document.body.appendChild(this.el);
    this.el.querySelector('button')!.addEventListener('click', () => { void this.run(list); }, { once: true });
  }

  private chapters(): string[] {
    const want = (new URLSearchParams(location.search).get('bench') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    const all = CHAPTERS.map((c) => c.id);
    const pick = want.filter((c) => all.includes(c));
    return pick.length ? pick : all;
  }

  private async run(list: string[]): Promise<void> {
    const results: BenchChapter[] = [];
    await sleep(0.8); // let the splash hand over to the title
    for (const [i, ch] of list.entries()) {
      this.status(`Chapter ${ch} (${i + 1}/${list.length}): loading…`);
      results.push(await this.chapter(ch, (s) => this.status(`Chapter ${ch} (${i + 1}/${list.length}): ${s}`)));
    }
    this.app.input.scripted = null;
    this.report(this.build(results));
  }

  private status(s: string): void {
    this.el.innerHTML = `<b>Benchmark</b> · ${s}<div style="color:#9fb0c0;font-size:12px">Keep this tab in front.</div>`;
    Object.assign(this.el.style, { top: '24px', transform: 'translate(-50%,0)', padding: '10px 16px', pointerEvents: 'none' });
  }

  private async chapter(ch: string, say: (s: string) => void): Promise<BenchChapter> {
    const app = this.app;
    const nx = (window as unknown as { __nx: NxApi }).__nx;
    app.launch(ch);
    while (!(app.mode === 'playing' && app.session.loaded && app.session.w.chapterId === ch)) await sleep(0.1);
    await sleep(1.5);
    const spot = SPOTS[ch] ?? { warmup: 4, setup: (n: NxApi) => n.skip() };
    spot.setup(nx, app);
    nx.godMode(true);
    // slow camera sweep through the scripted-input path the bot uses
    app.input.scripted = { move: [0, 0], look: [0.35, 0], down: new Set<string>() };
    say(`warming up (${spot.warmup} s)…`);
    await sleep(spot.warmup);
    say('measuring (10 s)…');
    const frames: number[] = [];
    let draws = 0, tris = 0;
    const info = app.renderer.info;
    await new Promise<void>((done) => {
      let last = performance.now();
      const end = last + 10_000;
      const tick = (now: number) => {
        frames.push(now - last); last = now;
        draws = Math.max(draws, info.render.calls); tris = Math.max(tris, info.render.triangles);
        if (now < end) requestAnimationFrame(tick); else done();
      };
      requestAnimationFrame((t) => { last = t; requestAnimationFrame(tick); });
    });
    app.input.scripted = null;
    const sorted = [...frames].sort((a, b) => a - b);
    const total = frames.reduce((a, b) => a + b, 0);
    const heap = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize;
    return {
      chapter: ch, seconds: r2(total / 1000), frames: frames.length,
      fpsAvg: r2(frames.length / (total / 1000)), msAvg: r2(total / frames.length),
      msP50: r2(pct(sorted, 0.5)), msP95: r2(pct(sorted, 0.95)), msP99: r2(pct(sorted, 0.99)), msMax: r2(sorted.at(-1) ?? 0),
      slowPct: r2((frames.filter((f) => f > 33.4).length / frames.length) * 100),
      drawCallsMax: draws, trianglesMax: tris,
      programs: info.programs?.length ?? 0, textures: info.memory.textures, geometries: info.memory.geometries,
      ...(heap ? { heapMB: Math.round(heap / 1048576) } : {}),
    };
  }

  private build(results: BenchChapter[]): BenchReport {
    const c = this.app.renderer.domElement;
    const nav = navigator as Navigator & { deviceMemory?: number };
    return {
      version: 1, at: new Date().toISOString(), url: location.href,
      machine: {
        gpu: gpuName(), tier: quality(), userAgent: navigator.userAgent, cores: navigator.hardwareConcurrency ?? 0,
        ...(nav.deviceMemory ? { memoryGB: nav.deviceMemory } : {}),
        screen: `${screen.width}x${screen.height}`, dpr: devicePixelRatio, canvas: `${c.width}x${c.height}`,
        pixelRatio: Math.min(devicePixelRatio, tierSettings().maxPixelRatio),
      },
      results,
    };
  }

  private report(r: BenchReport): void {
    const json = JSON.stringify(r, null, 2);
    (window as unknown as { __bench: BenchReport }).__bench = r;
    console.info('benchmark', r);
    const verdict = (x: BenchChapter) => (x.msP95 <= 16.7 ? '60 fps' : x.msP95 <= 33.4 ? '30 fps' : 'below 30');
    const rows = r.results.map((x) => `<tr><td>${x.chapter}</td><td>${x.fpsAvg}</td><td>${x.msP50}</td><td>${x.msP95}</td><td>${x.msP99}</td><td>${x.slowPct}%</td><td>${x.drawCallsMax}</td><td>${Math.round(x.trianglesMax / 1000)}k</td><td>${verdict(x)}</td></tr>`).join('');
    Object.assign(this.el.style, { top: '50%', transform: 'translate(-50%,-50%)', padding: '24px 28px', pointerEvents: 'auto' });
    this.el.innerHTML = `<h2 style="margin:0 0 6px;font-size:20px">Benchmark results</h2>
      <p style="margin:0 0 10px;color:#9fb0c0">${r.machine.gpu} · tier ${r.machine.tier} · canvas ${r.machine.canvas}</p>
      <table style="border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums;margin-bottom:12px">
        <thead><tr style="text-align:left;color:#9fb0c0"><th>Chapter</th><th>fps</th><th>ms p50</th><th>ms p95</th><th>ms p99</th><th>&gt;33 ms</th><th>Draws</th><th>Tris</th><th>Holds</th></tr></thead>
        <tbody>${rows}</tbody></table>
      <p style="margin:0 0 8px">Send the full report back (Copy, then paste it in chat, or Download the file).</p>
      <button data-a="copy" style="font:inherit;padding:6px 14px;border-radius:6px;border:0;background:#3a6ea5;color:#fff;cursor:pointer">Copy report</button>
      <button data-a="save" style="font:inherit;padding:6px 14px;border-radius:6px;border:0;background:#2c3a48;color:#fff;cursor:pointer;margin-left:6px">Download JSON</button>
      <textarea readonly style="display:block;width:100%;height:160px;margin-top:12px;background:#0d141c;color:#cfd8e0;border:1px solid #2c3a48;border-radius:6px;font:12px/1.4 ui-monospace,monospace">${json.replace(/</g, '&lt;')}</textarea>`;
    this.el.querySelectorAll('td,th').forEach((td) => { (td as HTMLElement).style.padding = '3px 10px 3px 0'; });
    this.el.querySelector('[data-a=copy]')!.addEventListener('click', (e) => {
      void navigator.clipboard?.writeText(json).then(() => { (e.target as HTMLElement).textContent = 'Copied'; }, () => { this.el.querySelector('textarea')!.select(); });
    });
    this.el.querySelector('[data-a=save]')!.addEventListener('click', () => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      a.download = `no-extraction-bench-${r.machine.tier}-${r.at.slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
  }
}
