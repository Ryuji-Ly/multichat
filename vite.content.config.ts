import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Content scripts run as classic scripts, so this one is bundled into a single IIFE file.
// Runs after the main build and adds to dist/ without emptying it.
export default defineConfig({
  publicDir: false,
  build: {
    outDir: resolve(import.meta.dirname, 'dist'),
    emptyOutDir: false,
    target: 'chrome120',
    lib: {
      entry: resolve(import.meta.dirname, 'src/extension/content/tiktok-crop.ts'),
      formats: ['iife'],
      name: 'multichatTikTokCrop',
      fileName: () => 'tiktok-crop.js',
    },
  },
});
