// Project lint: the rules the brief/GDD make enforceable. Exits non-zero on any violation.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const ts = (d) => walk(path.join(root, d)).filter((f) => f.endsWith('.ts'));
const rel = (f) => path.relative(root, f);
const errors = [];
const fail = (f, line, msg) => errors.push(`${rel(f)}:${line} ${msg}`);
const lines = (f) => fs.readFileSync(f, 'utf8').split('\n');

// 1. packages are game-agnostic
const GAME_WORDS = /\b(No ?Extraction|Ballast|Wren|AEGIS|Aegis|Sable|Marshal|Halcyon|Ilvane|Sovereign)\b/;
for (const f of ['narrative', 'mech-frame', 'perception'].flatMap((p) => ts(`packages/${p}/src`))) {
  lines(f).forEach((l, i) => {
    if (/from ['"](\.\.\/)+(src|data)\//.test(l) || /from ['"]@\/|from ['"].*\/src\/game/.test(l)) fail(f, i + 1, 'package imports game code');
    if (GAME_WORDS.test(l)) fail(f, i + 1, `package mentions game content: ${l.trim().slice(0, 80)}`);
  });
}
// 2. platform access only through the shell's platform module
const PLATFORM = /\b(localStorage|sessionStorage|navigator\.getGamepads)|(?<!platform)\.(requestPointerLock|requestFullscreen)\(|document\.(exitPointerLock|exitFullscreen)\(/;
for (const f of [...ts('src'), ...ts('packages')]) lines(f).forEach((l, i) => { if (PLATFORM.test(l) && !l.includes('lint-allow')) fail(f, i + 1, 'direct platform access (use @slu/web-shell platform/input/storage)'); });
// 3. deterministic simulation: no Math.random in simulation code
for (const f of [...ts('src/ai'), ...ts('src/player'), ...ts('src/mech'), ...ts('src/story'), ...ts('packages/perception/src'), ...ts('packages/narrative/src'), path.join(root, 'src/game/Session.ts'), path.join(root, 'packages/mech-frame/src/MechFrame.ts')])
  lines(f).forEach((l, i) => { if (/Math\.random\(/.test(l)) fail(f, i + 1, 'Math.random in simulation code (use World.rng)'); });
// 4. readability law: meaning colours only come from data/palette.ts
const LAW = /0x(ff2a3a|ffb02e|3ee6ff|d7c7ff)\b|#(ff2a3a|ffb02e|3ee6ff)\b/i;
for (const f of [...ts('src'), ...ts('data')]) {
  if (rel(f) === path.join('data', 'palette.ts') || rel(f) === path.join('src', 'ui', 'hudStyles.ts')) continue;
  lines(f).forEach((l, i) => { if (LAW.test(l)) fail(f, i + 1, 'law colour literal outside data/palette.ts'); });
}
// 5. no stubs / placeholder logic
for (const f of [...ts('src'), ...ts('packages')]) lines(f).forEach((l, i) => { if (/\b(TODO|FIXME|XXX|NotImplemented|not implemented)\b/.test(l)) fail(f, i + 1, 'stub/TODO marker'); });
// 6. every referenced VO line id exists
const lineIds = new Set();
for (const f of ts('data/story')) for (const m of fs.readFileSync(f, 'utf8').matchAll(/L\('([\w.]+)'|b\('([\w.]+)'/g)) lineIds.add(m[1] ?? m[2]);
for (const f of [...ts('src/story'), ...ts('data')]) {
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(/'((?:c[1-6]|sable)\.[a-z]+\.[A-Za-z0-9]+)'/g)) if (!lineIds.has(m[1]) && !/sequence|seq|c[1-6]\.(intro|end|hangar|sabotage|window|bridge|pad|lift|flood|boot|shelf|ambush|marshal)/.test(m[1])) {
    const id = m[1]; if (/^c[1-6]\.(halcyon|wren|ballast|aegis|marshal)\./.test(id) || id.startsWith('sable.')) fail(f, 1, `unknown VO line id ${id}`);
  }
}
if (errors.length) { console.error(errors.join('\n')); console.error(`lint: ${errors.length} problem(s)`); process.exit(1); }
console.log(`lint: ok (${lineIds.size} VO lines indexed)`);
