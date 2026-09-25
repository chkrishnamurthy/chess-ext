import { getPuzzle, dailyPuzzle } from '../../game/puzzles';
import type { GameState } from '../../game/gameSession';
import type { PuzzleState } from '../../game/puzzleSession';
import type { MateN } from '../../game/types';
import { accuracy, liveStreak } from '../../progress/progress';
import { KEYS, load } from '../../storage/store';
import { h } from '../../ui/dom';
import type { Screen } from '../context';
import { POSITIONS } from './game';

export const homeScreen: Screen = async (ctx, root) => {
  const today = ctx.today();
  const p = ctx.progress;
  const daily = dailyPuzzle(today);
  const dailyDone = p.daily[today];
  const game = await load<GameState | null>(KEYS.game, null);
  const puzzle = await load<PuzzleState | null>(KEYS.puzzle, null);
  const log = p.days[today];
  const streak = liveStreak(p, today, ctx.settings.streakFreeze);

  // Hero: continue an unfinished game/puzzle first, otherwise today's challenge.
  const hero = h('div.hero');
  const unfinishedGame = game && !game.result ? game : null;
  const unfinishedPuzzle = puzzle && puzzle.status === 'playing' && puzzle.played.length > 0 && puzzle.mode !== 'rush' ? puzzle : null;
  if (unfinishedGame) {
    const pos = POSITIONS.find((x) => x.id === unfinishedGame.positionId);
    hero.append(
      h('h2', null, '♟ Continue your game'),
      h('p.sub', null, `${pos?.title ?? 'Finish the Position'} · move ${Math.floor(unfinishedGame.moves.length / 2) + 1}`),
      h('button.btn.primary', { onclick: () => ctx.go({ name: 'game' }) }, 'Continue game'),
    );
  } else if (unfinishedPuzzle) {
    const pz = getPuzzle(unfinishedPuzzle.puzzleId);
    hero.append(
      h('h2', null, '🧩 Continue your puzzle'),
      h('p.sub', null, pz ? `Mate in ${pz.n}` : 'Pick up where you left off'),
      h(
        'button.btn.primary',
        {
          onclick: () =>
            ctx.go(
              unfinishedPuzzle.mode === 'daily'
                ? { name: 'puzzle', mode: 'daily' }
                : unfinishedPuzzle.mode === 'retry'
                  ? { name: 'puzzle', mode: 'retry' }
                  : { name: 'puzzle', mode: 'practice', n: pz?.n ?? 1 },
            ),
        },
        'Continue puzzle',
      ),
    );
  } else {
    hero.append(
      h('h2', null, dailyDone === 'solved' ? '✅ Today’s challenge solved' : '📅 Today’s Challenge'),
      h('p.sub', null, dailyDone === 'solved' ? 'Come back tomorrow for a new one — or keep practising below.' : `Mate in ${daily.n} · a new puzzle every day`),
      h(
        'button.btn.primary',
        { onclick: () => ctx.go({ name: 'puzzle', mode: 'daily' }) },
        dailyDone === 'solved' ? 'See it again' : dailyDone === 'failed' ? 'Try again' : 'Solve today’s challenge',
      ),
    );
  }

  const mateTile = (n: MateN, label: string) =>
    h(
      'button.tile',
      { onclick: () => ctx.go({ name: 'puzzle', mode: 'practice', n }) },
      h('span.big', null, `Mate in ${n}`),
      h('span.small', null, label),
    );

  const tiles = h(
    'div.tiles',
    null,
    mateTile(1, `${p.byN[1]} solved`),
    mateTile(2, `${p.byN[2]} solved`),
    mateTile(3, `${p.byN[3]} solved`),
    h(
      'button.tile.wide',
      { onclick: () => ctx.go({ name: 'game', fresh: !unfinishedGame }) },
      h('span.emoji', null, '♔'),
      h('span', null, h('strong', null, 'Finish the Position'), h('br'), h('span.small', null, 'Convert a winning position vs the computer')),
    ),
    h(
      'button.tile.wide',
      { onclick: () => ctx.go({ name: 'rush' }) },
      h('span.emoji', null, '⚡'),
      h('span', null, h('strong', null, 'Puzzle Rush'), h('br'), h('span.small', null, `3 minutes · 3 strikes · best ${p.rushBest}`)),
    ),
    p.mistakes.length
      ? h(
          'button.tile.wide',
          { onclick: () => ctx.go({ name: 'puzzle', mode: 'retry' }) },
          h('span.emoji', null, '🔁'),
          h('span', null, h('strong', null, 'Retry mistakes'), h('br'), h('span.small', null, `${p.mistakes.length} puzzle${p.mistakes.length === 1 ? '' : 's'} to try again`)),
        )
      : null,
  );

  const solvedToday = log?.solved ?? 0;
  const acc = log && log.attempted ? Math.round((100 * log.firstTry) / log.attempted) : null;
  const stats = h(
    'div.stats-line',
    null,
    h('span', null, `🔥 ${streak}-day streak`),
    h('span', null, `✅ ${solvedToday} solved today`),
    acc !== null ? h('span', null, `🎯 ${acc}% today`) : h('span', null, `🎯 ${accuracy(p)}% overall`),
  );

  root.append(
    hero,
    tiles,
    stats,
    h('p.privacy', null, '🔒 No account. Nothing leaves your device. Works offline.'),
  );
  return {};
};
