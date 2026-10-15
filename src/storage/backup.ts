import { Chess } from 'chess.js';
import { playUci } from '../game/chessUtil';
import { KEYS, clearAll, loadAll, save } from './store';

/** Users own their data: export everything to a JSON file, import it back, or wipe it. */

interface Backup {
  app: 'chess-break';
  version: 1;
  exportedAt: string;
  data: Record<string, unknown>;
}

export async function exportData(): Promise<void> {
  const backup: Backup = { app: 'chess-break', version: 1, exportedAt: new Date().toISOString(), data: await loadAll() };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `chess-break-progress-${backup.exportedAt.slice(0, 10)}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Whether a stored value has the shape the app expects for its key. A backup that fails
 * this is refused before anything is overwritten, so a damaged or hand-edited file cannot
 * leave the app unable to start.
 */
export function isValidEntry(key: string, v: unknown): boolean {
  switch (key) {
    case KEYS.settings:
    case KEYS.progress:
    case KEYS.seen:
    case KEYS.quick:
      return isObj(v);
    case KEYS.puzzle:
      return isObj(v) && typeof v.puzzleId === 'string' && Array.isArray(v.played);
    case KEYS.rush:
    case KEYS.streak:
    case KEYS.ghost:
      return isObj(v) && Array.isArray(v.ids) && v.ids.every((x) => typeof x === 'string') && typeof v.index === 'number' && typeof v.score === 'number';
    case KEYS.screen:
      return isObj(v) && typeof v.name === 'string';
    case KEYS.game:
      if (v === null) return true;
      if (!isObj(v) || typeof v.startFen !== 'string' || typeof v.positionId !== 'string' || !Array.isArray(v.moves) || (v.userColor !== 'w' && v.userColor !== 'b')) return false;
      try {
        const chess = new Chess(v.startFen); // throws on an invalid FEN
        return v.moves.every((u) => typeof u === 'string' && playUci(chess, u) !== null); // every move must be legal in turn
      } catch {
        return false;
      }
    default:
      return true; // unknown "cb." keys (from a newer version) are kept untouched
  }
}

export function parseBackup(text: string): Backup {
  let b: Partial<Backup>;
  try {
    b = JSON.parse(text) as Partial<Backup>;
  } catch {
    throw new Error('This file is not a Chess Break backup.');
  }
  if (!isObj(b) || b.app !== 'chess-break' || !isObj(b.data)) throw new Error('This file is not a Chess Break backup.');
  for (const [k, v] of Object.entries(b.data)) {
    if (!k.startsWith('cb.')) throw new Error(`Unexpected key in backup: ${k}`);
    if (!isValidEntry(k, v)) throw new Error(`The backup is damaged (${k}). Nothing was changed.`);
  }
  return b as Backup;
}

/** Tells the service worker to re-check the optional corner button (settings may have just changed). */
function notifyLauncher(): void {
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) void chrome.runtime.sendMessage({ type: 'launcher-changed' }).catch(() => undefined);
  } catch {
    // Not running as an extension page: nothing to notify.
  }
}

/** Opens a file picker and restores a backup. Resolves true on success. */
export function importData(): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(false);
      try {
        const b = parseBackup(await file.text());
        await clearAll();
        for (const [k, v] of Object.entries(b.data)) await save(k, v);
        notifyLauncher();
        resolve(true);
      } catch (e) {
        reject(e);
      }
    };
    input.click();
  });
}

export async function resetData(): Promise<boolean> {
  if (!confirm('Reset all progress, streaks and settings? This cannot be undone. (Tip: export first.)')) return false;
  await clearAll();
  notifyLauncher(); // settings are gone, so a registered corner button must go too
  return true;
}
