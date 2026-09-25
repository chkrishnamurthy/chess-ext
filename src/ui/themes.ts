import { isDark, prefersReducedMotion, type BoardTheme, type PieceSet, type Settings } from '../storage/settings';

export const BOARD_THEMES: Record<BoardTheme, { name: string; light: string; dark: string }> = {
  wood: { name: 'Classic wood', light: '#f0d9b5', dark: '#b58863' },
  green: { name: 'Green', light: '#eeeed2', dark: '#769656' },
  blue: { name: 'Blue', light: '#dee3e6', dark: '#8ca2ad' },
  grey: { name: 'Grey minimal', light: '#ececec', dark: '#b3b3b3' },
  contrast: { name: 'High contrast', light: '#ffffff', dark: '#3d4f6b' },
  slate: { name: 'Dark slate', light: '#8d9aa6', dark: '#4e5d6c' },
};

export const PIECE_SETS: Record<PieceSet, string> = {
  standard: 'Standard',
  flat: 'Flat',
  outline: 'Minimal outline',
  large: 'Large print',
};

export function boardSvg(light: string, dark: string): string {
  let rects = '';
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if ((x + y) % 2) rects += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8" shape-rendering="crispEdges"><rect width="8" height="8" fill="${light}"/><g fill="${dark}">${rects}</g></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** Apply every visual setting to a document (used by popup, side panel and the options preview). */
export function applyTheme(s: Settings, root: HTMLElement = document.documentElement): void {
  const dark = isDark(s);
  const theme = BOARD_THEMES[dark ? s.boardThemeDark : s.boardTheme];
  root.style.setProperty('--board-img', boardSvg(theme.light, theme.dark));
  root.style.setProperty('--board-light', theme.light);
  root.style.setProperty('--board-dark', theme.dark);
  root.dataset.theme = dark ? 'dark' : 'light';
  root.dataset.pieces = s.pieceSet;
  root.classList.toggle('large', s.large || s.pieceSet === 'large');
  root.classList.toggle('colorblind', s.colorblind);
  root.classList.toggle('reduce-motion', prefersReducedMotion(s));
}

/** Re-apply when the OS light/dark preference flips (for "Auto"). */
export function watchSystemTheme(get: () => Settings): void {
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme(get()));
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', () => applyTheme(get()));
}
