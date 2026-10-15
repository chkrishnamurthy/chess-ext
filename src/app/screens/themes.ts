import { h } from '../../ui/dom';
import { MASTER_AT, THEMES, themeSolved } from '../../game/themes';
import { GAMES } from '../catalog';
import type { Screen } from '../context';
import { screenHeader } from '../kit';

/** Themes: pick one tactical pattern, solve 10 puzzles of it to master it. */
export const themesScreen: Screen = async (ctx, root) => {
  const list = h('div.mode-list');
  for (const t of THEMES) {
    const n = themeSolved(ctx.progress.solved, t.id);
    const done = n >= MASTER_AT;
    list.append(
      h(
        'button.theme-row',
        { class: done ? 'done' : '', onclick: () => ctx.go({ name: 'puzzle', mode: 'theme', theme: t.id }), 'aria-label': `${t.name}, ${Math.min(n, MASTER_AT)} of ${MASTER_AT} solved` },
        h('span.game-text', null, h('strong', null, t.name), h('span', null, t.blurb)),
        h('span.theme-meter', null, h('b', null, done ? '✓' : `${n}/${MASTER_AT}`), h('span.mate-bar', null, h('i', { style: `width:${Math.min(100, (n / MASTER_AT) * 100)}%` }))),
      ),
    );
  }
  root.append(
    screenHeader(ctx, GAMES.themes.name, 'Solve 10 of a pattern to master it', undefined, { family: 'learn', back: { name: 'puzzles' }, backLabel: 'Back to Puzzles' }),
    list,
  );
  return {};
};
