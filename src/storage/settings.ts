import { KEYS, load, onChange, save } from './store';

export type BoardTheme = 'wood' | 'green' | 'blue' | 'grey' | 'contrast' | 'slate';
export type PieceSet = 'standard' | 'flat' | 'outline' | 'large';

export interface Settings {
  boardTheme: BoardTheme;
  /** Board theme used while the app is in dark mode. */
  boardThemeDark: BoardTheme;
  pieceSet: PieceSet;
  appTheme: 'light' | 'dark' | 'auto';
  legalDots: boolean;
  lastMove: boolean;
  coords: boolean;
  autoQueen: boolean;
  moveInput: 'click' | 'drag' | 'both';
  /** 'mine' = the side you play is at the bottom; 'white' = always White at the bottom. */
  orientation: 'mine' | 'white';
  hintStyle: 'gradual' | 'instant';
  coach: 'verbose' | 'minimal';
  colorblind: boolean;
  large: boolean;
  reduceMotion: 'auto' | 'on' | 'off';
  sound: boolean;
  streakFreeze: boolean;
  showRating: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  boardTheme: 'wood',
  boardThemeDark: 'slate',
  pieceSet: 'standard',
  appTheme: 'auto',
  legalDots: true,
  lastMove: true,
  coords: true,
  autoQueen: false,
  moveInput: 'both',
  orientation: 'mine',
  hintStyle: 'gradual',
  coach: 'verbose',
  colorblind: false,
  large: false,
  reduceMotion: 'auto',
  sound: true,
  streakFreeze: true,
  showRating: false,
};

export async function loadSettings(): Promise<Settings> {
  const s = await load<Partial<Settings>>(KEYS.settings, {});
  return { ...DEFAULT_SETTINGS, ...s };
}

export async function saveSettings(s: Settings): Promise<void> {
  await save(KEYS.settings, s);
}

export async function patchSettings(p: Partial<Settings>): Promise<Settings> {
  const s = { ...(await loadSettings()), ...p };
  await saveSettings(s);
  return s;
}

export function onSettingsChange(fn: (s: Settings) => void): void {
  onChange((k, v) => {
    if (k === KEYS.settings) fn({ ...DEFAULT_SETTINGS, ...(v as Partial<Settings>) });
  });
}

export function prefersReducedMotion(s: Settings): boolean {
  if (s.reduceMotion === 'on') return true;
  if (s.reduceMotion === 'off') return false;
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function isDark(s: Settings): boolean {
  if (s.appTheme === 'dark') return true;
  if (s.appTheme === 'light') return false;
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches;
}
