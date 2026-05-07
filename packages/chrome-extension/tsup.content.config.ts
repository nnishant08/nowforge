import { defineConfig } from 'tsup';

/**
 * Content scripts run as classic scripts inside the host page —
 * they cannot use ES module `import` statements. We must produce a
 * single self-contained IIFE where every dependency is inlined.
 *
 * tsup with a single entry + noExternal bundles everything into
 * one file with zero top-level import statements.
 */
export default defineConfig({
  entry: {
    // The manifest expects dist/src/content/index.js
    index: 'src/content/index.ts',
  },
  outDir: 'dist/src/content',
  format: ['iife'],
  // Inline every import — workspace packages, shared utilities, everything.
  noExternal: [/.*/],
  bundle: true,
  // Don't wipe the folder; Vite already built the rest of dist/
  clean: false,
  // No declaration files needed for a content script
  dts: false,
  sourcemap: false,
  target: 'chrome110',
  // tsup appends ".global" for IIFE by default — override to keep "index.js"
  // so it matches what the manifest expects: src/content/index.js
  outExtension() {
    return { js: '.js' };
  },
});
