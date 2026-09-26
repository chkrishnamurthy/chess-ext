import { defineConfig } from 'vite';
import { resolve } from 'node:path';

/**
 * Separate builds for the two scripts that run inside web pages:
 *   --mode overlay  → content.js  (the in-page window, injected on click)
 *   --mode launcher → launcher.js (the optional corner button)
 *
 * They can't share the main build: a script injected with `scripting.executeScript` is
 * not a module, so each must be one self-contained IIFE with its CSS inlined. The
 * launcher is kept apart from the window so the script that runs on every page stays tiny.
 */
const ENTRIES: Record<string, { src: string; out: string }> = {
  overlay: { src: 'src/content/overlay.ts', out: 'content.js' },
  launcher: { src: 'src/content/launcher.ts', out: 'launcher.js' },
};

export default defineConfig(({ mode }) => {
  const entry = ENTRIES[mode];
  if (!entry) throw new Error(`vite.content.config: unknown --mode "${mode}"`);
  return {
    publicDir: false,
    build: {
      outDir: 'dist',
      // The main build runs first and owns the directory.
      emptyOutDir: false,
      target: 'chrome116',
      cssCodeSplit: false,
      rollupOptions: {
        input: resolve(import.meta.dirname, entry.src),
        output: { format: 'iife', entryFileNames: entry.out },
      },
    },
  };
});
