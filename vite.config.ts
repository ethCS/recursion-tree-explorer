/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Production builds are served from eethan.com/projects/dsa/live/ (the site's
// own /projects/dsa page is the project tile), so the default build base is
// that sub-path. `npm run dev` serves from the root. Override
// either with BASE_PATH (e.g. BASE_PATH=/ npm run build).
export default defineConfig(({ command }) => {
  const base = process.env.BASE_PATH ?? (command === 'build' ? '/projects/dsa/live/' : '/');
  // Mirror the base path inside dist/ so a static host serving dist/ as its
  // root finds index.html at /projects/dsa/live/index.html.
  const outDir = 'dist' + (base === '/' ? '' : base.replace(/\/$/, ''));
  // Stamp the source commit into the page so a deploy can be verified with
  // `curl -s https://eethan.com/projects/dsa/live/ | grep rte-build`.
  // CI sets GITHUB_SHA; local builds say "local".
  const build = (process.env.GITHUB_SHA ?? 'local').slice(0, 40);
  return {
    base,
    plugins: [
      react(),
      {
        name: 'build-stamp',
        transformIndexHtml: () => [{ tag: 'meta', attrs: { name: 'rte-build', content: build }, injectTo: 'head' }],
      },
    ],
    // One page that needs KaTeX + React on first paint: splitting would not
    // reduce what loads, so allow the ~555 kB (~171 kB gzip) bundle.
    build: { outDir, emptyOutDir: true, chunkSizeWarningLimit: 700 },
    test: { include: ['src/**/*.test.ts'] },
  };
});
