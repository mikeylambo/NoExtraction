// Shared headless browser helpers (Playwright + SwiftShader on CI/containers).
import { spawn, execSync } from 'node:child_process';
import { createRequire } from 'node:module';

// Playwright: project install if present, else the machine's global install (CI image / container).
let pw;
try { pw = await import('playwright'); } catch { pw = createRequire(execSync('npm root -g').toString().trim() + '/')('playwright'); }
const { chromium } = pw;

export async function startPreview(port = 5191) {
  const p = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'pipe', detached: true });
  await new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('preview timeout')), 20000); p.stdout.on('data', (d) => { if (String(d).includes('Local')) { clearTimeout(t); res(); } }); });
  return { url: `http://localhost:${port}/`, stop: () => { try { process.kill(-p.pid, 'SIGTERM'); } catch { p.kill(); } } };
}

export async function openGame(url, { query = '', width = 1280, height = 720, video } = {}) {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext({ viewport: { width, height }, ...(video ? { recordVideo: { dir: video, size: { width, height } } } : {}) });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('GL Driver') && !m.text().includes('404')) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}\n${(e.stack || '').split('\n').slice(0, 4).join('\n')}`));
  await page.goto(url + query, { waitUntil: 'domcontentloaded', timeout: 30000 });
  return { browser, context, page, errors };
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
