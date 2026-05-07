#!/usr/bin/env node
/**
 * Build a ZIP archive of packages/chrome-extension/dist/ for Chrome Web Store
 * upload. Output filename includes the manifest version so successive builds
 * don't overwrite each other:
 *
 *   nowforge-extension-0.1.0.zip
 *
 * Pure Node — no external dependencies; uses the system `zip` binary which
 * ships with macOS and most Linux distros.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const distDir = resolve(repoRoot, 'packages/chrome-extension/dist');
const manifestPath = resolve(distDir, 'manifest.json');

if (!existsSync(distDir) || !statSync(distDir).isDirectory()) {
  console.error(`✗ ${distDir} does not exist. Run \`pnpm build\` first.`);
  process.exit(1);
}
if (!existsSync(manifestPath)) {
  console.error(`✗ ${manifestPath} not found. Build seems incomplete.`);
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const version = manifest.version ?? '0.0.0';
const outFile = resolve(repoRoot, `nowforge-extension-${version}.zip`);

// Remove any previous archive at the same path so zip doesn't append/update
try {
  execFileSync('rm', ['-f', outFile]);
} catch { /* ignore */ }

console.log(`▸ packaging ${distDir}`);
console.log(`▸ output:    ${outFile}`);

// Run from inside dist/ so the archive has manifest.json at its root
execFileSync(
  'zip',
  ['-r', '-q', outFile, '.', '-x', '*.DS_Store', '-x', '*.map'],
  { cwd: distDir, stdio: 'inherit' }
);

const sizeBytes = statSync(outFile).size;
const sizeKb = (sizeBytes / 1024).toFixed(1);
console.log(`✓ wrote ${outFile} (${sizeKb} KB)`);
