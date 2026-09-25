/**
 * Thin typed wrapper over chrome.storage.local (falls back to localStorage when the
 * pages are opened outside the extension, e.g. `vite preview` or unit tests).
 * Everything stays on the device — no sync storage, no network.
 */

type Listener = (key: string, value: unknown) => void;

const hasChrome = typeof chrome !== 'undefined' && !!chrome.storage?.local;
const mem = new Map<string, string>();

function ls(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export async function load<T>(key: string, fallback: T): Promise<T> {
  if (hasChrome) {
    const r = await chrome.storage.local.get(key);
    return (r[key] as T | undefined) ?? fallback;
  }
  const raw = ls()?.getItem(key) ?? mem.get(key);
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function save<T>(key: string, value: T): Promise<void> {
  if (hasChrome) {
    await chrome.storage.local.set({ [key]: value });
    return;
  }
  const raw = JSON.stringify(value);
  const s = ls();
  if (s) s.setItem(key, raw);
  else mem.set(key, raw);
}

export async function remove(key: string): Promise<void> {
  if (hasChrome) return chrome.storage.local.remove(key);
  ls()?.removeItem(key);
  mem.delete(key);
}

export async function loadAll(): Promise<Record<string, unknown>> {
  if (hasChrome) return chrome.storage.local.get(null);
  const out: Record<string, unknown> = {};
  const s = ls();
  if (s) {
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i)!;
      if (k.startsWith('cb.')) out[k] = JSON.parse(s.getItem(k)!);
    }
  }
  for (const [k, v] of mem) out[k] = JSON.parse(v);
  return out;
}

export async function clearAll(): Promise<void> {
  if (hasChrome) return chrome.storage.local.clear();
  const s = ls();
  if (s) Object.keys(s).filter((k) => k.startsWith('cb.')).forEach((k) => s.removeItem(k));
  mem.clear();
}

/** Called when another surface (popup ↔ side panel ↔ options) writes a key. */
export function onChange(fn: Listener): void {
  if (hasChrome) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      for (const [k, c] of Object.entries(changes)) fn(k, c.newValue);
    });
  } else if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (e.key) fn(e.key, e.newValue ? JSON.parse(e.newValue) : undefined);
    });
  }
}

export const KEYS = {
  settings: 'cb.settings',
  progress: 'cb.progress',
  puzzle: 'cb.session.puzzle',
  game: 'cb.session.game',
  rush: 'cb.session.rush',
  screen: 'cb.session.screen',
} as const;
