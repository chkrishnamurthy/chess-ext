import { clearAll, loadAll, save } from './store';

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

export function parseBackup(text: string): Backup {
  const b = JSON.parse(text) as Partial<Backup>;
  if (b.app !== 'chess-break' || typeof b.data !== 'object' || !b.data) throw new Error('This file is not a Chess Break backup.');
  for (const k of Object.keys(b.data)) if (!k.startsWith('cb.')) throw new Error(`Unexpected key in backup: ${k}`);
  return b as Backup;
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
  return true;
}
