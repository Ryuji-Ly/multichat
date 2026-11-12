/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

const here = import.meta.dirname;

// Builds the extension pages and the background service worker into dist/.
// The TikTok content script is built separately (vite.content.config.ts): content scripts can't be
// ES modules, so it must be a single self-contained file.
export default defineConfig({
  root: 'src',
  publicDir: false,
  plugins: [manifestWithBuildStamp()],
  build: {
    outDir: resolve(here, 'dist'),
    emptyOutDir: true,
    target: 'chrome120',
    rollupOptions: {
      input: {
        dashboard: resolve(here, 'src/dashboard/dashboard.html'),
        background: resolve(here, 'src/extension/background.ts'),
      },
      output: {
        entryFileNames: (chunk) =>
          chunk.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js',
      },
    },
  },
  test: {
    root: here,
    include: ['test/**/*.test.ts'],
  },
});

/**
 * Copies the manifest into dist/ with `version_name` set to the build time. Chrome keeps running the
 * content script it loaded until the extension is reloaded, while pages come fresh from disk; the
 * dashboard compares the two stamps to warn about a forgotten reload.
 */
function manifestWithBuildStamp(): Plugin {
  return {
    name: 'manifest-with-build-stamp',
    generateBundle() {
      const manifest = JSON.parse(readFileSync(resolve(here, 'src/extension/manifest.json'), 'utf8'));
      manifest.version_name = `${manifest.version} (built ${new Date().toISOString()})`;
      this.emitFile({ type: 'asset', fileName: 'manifest.json', source: JSON.stringify(manifest, null, 2) });
    },
  };
}
