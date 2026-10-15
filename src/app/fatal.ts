import { exportData, resetData } from '../storage/backup';
import { KEYS, remove } from '../storage/store';
import { h, toast } from '../ui/dom';
import { icon } from '../ui/icons';

/** Saved sessions that can leave a screen unable to open if they are damaged. */
const SESSION_KEYS = [KEYS.puzzle, KEYS.game, KEYS.rush, KEYS.streak, KEYS.ghost, KEYS.screen];

/**
 * What the user sees instead of a blank window when something fails to load.
 * Recovery goes from gentle to drastic: retry, drop unfinished games, back up, reset.
 * `onHome` is offered when the failure was a single screen rather than the whole app.
 */
export function fatalCard(error: unknown, onHome?: () => void): HTMLElement {
  const detail = error instanceof Error ? error.message : String(error);
  return h(
    'div.fatal',
    { role: 'alert' },
    h('h2', null, 'Something went wrong'),
    h('p', null, 'Chess Break couldn’t open this screen. Your progress is still saved. These steps go from gentle to drastic:'),
    h(
      'div.fatal-actions',
      null,
      onHome ? h('button.btn.primary', { onclick: onHome }, 'Go to Today') : h('button.btn.primary', { onclick: () => location.reload() }, icon('reset', 16), 'Try again'),
      h(
        'button.btn',
        {
          onclick: async () => {
            await Promise.all(SESSION_KEYS.map((k) => remove(k).catch(() => undefined)));
            location.reload();
          },
        },
        'Clear unfinished games and retry',
      ),
      h(
        'button.btn',
        {
          onclick: () =>
            void exportData().then(
              () => toast('Backup downloaded ✓', 'good'),
              () => toast('Couldn’t create a backup.', 'warn'),
            ),
        },
        icon('download', 16),
        'Export a backup',
      ),
      h('button.btn.danger', { onclick: async () => (await resetData()) && location.reload() }, icon('trash', 16), 'Reset everything…'),
    ),
    h('p.fatal-detail', null, detail),
  );
}
