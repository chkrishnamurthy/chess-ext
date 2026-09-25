import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Multi-page MV3 build: each extension surface is its own HTML entry.
export default defineConfig({
  base: './',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'chrome116',
    // Keep the WASM engine out of the inline-asset path; it is copied from public/.
    assetsInlineLimit: 0,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'popup.html'),
        sidepanel: resolve(__dirname, 'sidepanel.html'),
        options: resolve(__dirname, 'options.html'),
        background: resolve(__dirname, 'src/background.ts'),
      },
      output: {
        entryFileNames: (chunk) => (chunk.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js'),
      },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 60000,
  },
});
