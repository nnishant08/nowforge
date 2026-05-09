import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync } from 'fs';

// Plugin to copy manifest.json and static assets to dist
function copyExtensionFiles() {
  return {
    name: 'copy-extension-files',
    closeBundle() {
      // Copy manifest
      copyFileSync(
        resolve(__dirname, 'manifest.json'),
        resolve(__dirname, 'dist/manifest.json')
      );

      // Copy icons
      const iconsSrc = resolve(__dirname, 'public/icons');
      const iconsDst = resolve(__dirname, 'dist/icons');
      if (!existsSync(iconsDst)) mkdirSync(iconsDst, { recursive: true });

      for (const size of [16, 48, 128]) {
        const src = resolve(iconsSrc, `icon${size}.png`);
        const dst = resolve(iconsDst, `icon${size}.png`);
        if (existsSync(src)) copyFileSync(src, dst);
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), copyExtensionFiles()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/index.html'),
        sidepanel: resolve(__dirname, 'src/sidepanel/index.html'),
        options: resolve(__dirname, 'src/options/index.html'),
        diff: resolve(__dirname, 'src/diff/index.html'),
        // background is a service worker with `type: module` in the manifest —
        // it can use ES module imports, so it stays in the Vite build.
        // content script is built separately by tsup (see tsup.content.config.ts)
        // because classic content scripts cannot use ES `import` statements.
        background: resolve(__dirname, 'src/background/index.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'background') return 'src/background/index.js';
          return 'assets/[name]-[hash].js';
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
    minify: process.env.NODE_ENV === 'production',
    sourcemap: process.env.NODE_ENV !== 'production',
    target: 'chrome110',
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
