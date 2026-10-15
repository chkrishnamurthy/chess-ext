import { dailyPuzzle } from '../../game/puzzles';
import { THEMES, themesMastered } from '../../game/themes';
import type { MateN } from '../../game/types';
import { h } from '../../ui/dom';
import { GAMES, MATE_LEVEL } from '../catalog';
import type { Ctx, Screen } from '../context';
import { gameRow, launch } from '../kit';

/** Puzzles tab: everything where you find the best move, at your own pace or against the clock. */
export const puzzlesScreen: Screen = async (ctx, root) => {
  const p = ctx.progress;
  const today = ctx.today();
  const done = p.daily[today];
  const daily = dailyPuzzle(today);

  const mastered = themesMastered(p.solved);

  root.append(
    h('div.hub-head', null, h('h1', null, 'Puzzles'), h('p', null, 'Find the best move. Take your time, or race the clock.')),
    gameRow(
      GAMES.daily,
      () => void launch(ctx, 'daily', { name: 'puzzle', mode: 'daily' }),
      done === 'solved' ? 'Solved today ✓ · a new one tomorrow' : `Mate in ${daily.n} · new every day`,
    ),
    h('div.section-label', null, 'Checkmate practice'),
    h('div.mate-grid', null, mateCard(ctx, 1), mateCard(ctx, 2), mateCard(ctx, 3)),
    h('div.section-label', null, 'Challenges'),
    gameRow(GAMES.rush, () => ctx.go({ name: 'rush' }), p.rushBest ? `3 min · 3 strikes · Best ${p.rushBest}` : undefined),
    gameRow(GAMES.ghost, () => ctx.go({ name: 'ghost' }), p.ghost ? `90 sec · Ghost ${p.ghost.score}` : undefined),
    gameRow(GAMES.streak, () => void launch(ctx, 'streak', { name: 'streak' }), p.streakBest ? `No clock · Longest ${p.streakBest}` : undefined),
    gameRow(GAMES.coords, () => void launch(ctx, 'coords', { name: 'coords' }), p.coordsBest ? `30 seconds · Best ${p.coordsBest}` : undefined),
    h('div.section-label', null, 'Train'),
    gameRow(GAMES.themes, () => ctx.go({ name: 'themes' }), mastered ? `${mastered} of ${THEMES.length} patterns mastered` : undefined),
    ...(p.mistakes.length
      ? [gameRow(GAMES.retry, () => void launch(ctx, 'retry', { name: 'puzzle', mode: 'retry' }), `${p.mistakes.length} puzzle${p.mistakes.length === 1 ? '' : 's'} to try again`)]
      : []),
  );
  return {};
};

export function mateCard(ctx: Ctx, n: MateN): HTMLElement {
  const game = GAMES[`m${n}` as 'm1' | 'm2' | 'm3'];
  const solved = ctx.progress.byN[n];
  const pct = Math.min(100, (solved % 25) * 4); // bar fills every 25 solves — small, frequent wins
  return h(
    'button.mate-card',
    {
      class: `m${n}`,
      onclick: () => void launch(ctx, game.id, { name: 'puzzle', mode: 'practice', n }),
      'aria-label': `${game.name}, ${MATE_LEVEL[n]}, ${solved} solved`,
    },
    h('span.mate-top', null, h('span.mate-n', null, String(n)), h('span.mate-level', null, MATE_LEVEL[n])),
    h('span.mate-title', null, game.name),
    h('span.mate-bar', null, h('i', { style: `width:${Math.max(pct, 4)}%` })),
    h('span.mate-sub', null, `${solved} solved`),
  );
}
