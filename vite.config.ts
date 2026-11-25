import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { cpSync, existsSync } from 'node:fs';

const pkg = (p: string) => fileURLToPath(new URL(`./packages/${p}/src/index.ts`, import.meta.url));

/** Drop-in assets (GLBs, audio, LUT) are fetched by path at runtime, so ship assets/ beside the bundle. */
const shipAssets = () => ({
  name: 'ship-assets',
  apply: 'build' as const,
  closeBundle() {
    if (existsSync('assets')) cpSync('assets', 'dist/assets', { recursive: true, filter: (src: string) => !src.endsWith('.ts') });
  },
});

export default defineConfig({
  plugins: [shipAssets()],
  resolve: {
    alias: {
      '@slu/narrative': pkg('narrative'),
      '@slu/mech-frame': pkg('mech-frame'),
      '@slu/perception': pkg('perception'),
    },
  },
  build: { target: 'es2022', chunkSizeWarningLimit: 2000, sourcemap: false },
  server: { host: true },
});
