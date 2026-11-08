import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const pkg = (p: string) => fileURLToPath(new URL(`./packages/${p}/src/index.ts`, import.meta.url));

export default defineConfig({
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
