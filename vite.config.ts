/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Multi-page MV3 build: each extension surface is its own HTML entry.
export default defineConfig({
  base: './',
  publicDir: 'public',
  // The puzzle library is large; JSON.parse on a string loads faster than a JS object literal.
  json: { stringify: true },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'chrome116',
    // Stockfish (JS + WASM) is copied verbatim from public/engine — never inlined or fetched remotely.
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      input: {
        popup: resolve(import.meta.dirname, 'popup.html'),
        sidepanel: resolve(import.meta.dirname, 'sidepanel.html'),
        options: resolve(import.meta.dirname, 'options.html'),
        // The app framed inside the in-page window (see src/content/overlay.ts).
        overlay: resolve(import.meta.dirname, 'overlay.html'),
        worker: resolve(import.meta.dirname, 'src/background/worker.ts'),
      },
      // manifest.json names the service worker, so its file name can't carry a hash.
      output: { entryFileNames: (chunk) => (chunk.name === 'worker' ? 'worker.js' : 'assets/[name]-[hash].js') },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 60000,
  },
});
