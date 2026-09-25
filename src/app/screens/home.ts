import { dailyPuzzle, getPuzzle, TIER_LABEL } from '../../game/puzzles';
import { GameSession, type GameState } from '../../game/gameSession';
import { PuzzleSession, type PuzzleState } from '../../game/puzzleSession';
import type { MateN } from '../../game/types';
import { addDays, liveStreak } from '../../progress/progress';
import { KEYS, load } from '../../storage/store';
import { h } from '../../ui/dom';
import { icon, type IconName } from '../../ui/icons';
import type { Ctx, Screen } from '../context';
import { greeting, miniBoard, ring } from '../kit';
import { POSITIONS } from './game';

export const DAILY_GOAL = 5;
const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const homeScreen: Screen = async (ctx, root) => {
  const p = ctx.progress;
  const game = await load<GameState | null>(KEYS.game, null);
  const puzzle = await load<PuzzleState | null>(KEYS.puzzle, null);
  const totalSolved = Object.keys(p.solved).length;
  const firstVisit = totalSolved === 0 && p.attempts === 0;

  root.append(
    h(
      'div.greet',
      null,
      h('h1', null, firstVisit ? 'Welcome! 👋' : `${greeting()} 👋`),
      h('p', null, firstVisit ? 'Solve a quick checkmate, then get back to work. No signup, no internet needed.' : 'Ready for a five-minute chess break?'),
    ),
    hero(ctx, game, puzzle, firstVisit),
    goalCard(ctx),
    h('div.section-label', null, 'Quick practice'),
    h('div.mate-grid', null, mateCard(ctx, 1, 'Easy', 'm1'), mateCard(ctx, 2, 'Medium', 'm2'), mateCard(ctx, 3, 'Hard', 'm3')),
    h('div.section-label', null, 'More ways to play'),
    h(
      'div.mode-list',
      null,
      modeRow('zap', 'rush', 'Puzzle Rush', p.rushBest ? `3 min · 3 strikes · Best ${p.rushBest}` : '3 minutes · 3 strikes · beat your best', () => ctx.go({ name: 'rush' })),
      modeRow('crown', 'finish', 'Finish the Position', 'Win a winning position vs the computer', () =>
        ctx.go({ name: 'game', fresh: !(game && !game.result) }),
      ),
      p.mistakes.length
        ? modeRow('repeat', 'retry', 'Retry mistakes', `${p.mistakes.length} puzzle${p.mistakes.length === 1 ? '' : 's'} to try again`, () =>
            ctx.go({ name: 'puzzle', mode: 'retry' }),
          )
        : null,
    ),
    h('p.privacy', null, icon('lock', 13), 'No account · nothing leaves your device · works offline'),
  );
  return {};
};

function hero(ctx: Ctx, game: GameState | null, puzzle: PuzzleState | null, firstVisit: boolean): HTMLElement {
  const today = ctx.today();
  // 1) An unfinished game or puzzle always comes first: one tap to resume.
  if (game && !game.result) {
    const s = new GameSession(game);
    const pos = POSITIONS.find((x) => x.id === game.positionId);
    return heroCard(
      'Continue your game',
      pos?.title ?? 'Finish the Position',
      `Move ${Math.floor(game.moves.length / 2) + 1} · you play ${game.userColor === 'w' ? 'White' : 'Black'}`,
      'Continue game',
      () => ctx.go({ name: 'game' }),
      miniBoard(s.fen(), game.userColor === 'w' ? 'white' : 'black', s.lastMove()),
      'play',
    );
  }
  const pz = puzzle ? getPuzzle(puzzle.puzzleId) : undefined;
  if (puzzle && pz && puzzle.status === 'playing' && puzzle.played.length > 0 && puzzle.mode !== 'rush') {
    const s = new PuzzleSession(pz, puzzle);
    const route =
      puzzle.mode === 'daily'
        ? ({ name: 'puzzle', mode: 'daily' } as const)
        : puzzle.mode === 'retry'
          ? ({ name: 'puzzle', mode: 'retry' } as const)
          : ({ name: 'puzzle', mode: 'practice', n: pz.n } as const);
    return heroCard('Pick up where you left off', `Mate in ${pz.n}`, `${TIER_LABEL[pz.tier]} · ${s.movesLeft()} move${s.movesLeft() === 1 ? '' : 's'} to go`, 'Continue puzzle', () => ctx.go(route), miniBoard(s.fen(), s.solverColor(), s.lastMove()), 'play');
  }
  // 2) First visit: the easiest possible start.
  if (firstVisit) {
    return heroCard('Start here', 'Your first checkmate', 'An easy Mate in 1 · about 30 seconds', 'Let’s play', () => ctx.go({ name: 'puzzle', mode: 'practice', n: 1 }), null, 'play');
  }
  // 3) Today's challenge.
  const daily = dailyPuzzle(today);
  const done = ctx.progress.daily[today];
  const [y, m, d] = today.split('-').map(Number);
  const dow = WEEKDAY[new Date(y, m - 1, d).getDay()];
  return heroCard(
    done === 'solved' ? 'Today’s challenge · solved ✓' : 'Today’s challenge',
    `Mate in ${daily.n}`,
    done === 'solved' ? 'Nice! A new one arrives tomorrow.' : `${dow} · ${TIER_LABEL[daily.tier]}`,
    done === 'solved' ? 'See it again' : done === 'failed' ? 'Try again' : 'Solve now',
    () => ctx.go({ name: 'puzzle', mode: 'daily' }),
    miniBoard(daily.fen, daily.fen.split(' ')[1] === 'w' ? 'white' : 'black', daily.last),
    done === 'solved' ? 'check' : 'arrow',
  );
}

function heroCard(eyebrow: string, title: string, sub: string, cta: string, onclick: () => void, thumb: HTMLElement | null, ctaIcon: IconName): HTMLElement {
  return h(
    'div.hero',
    null,
    h(
      'div.hero-text',
      null,
      h('div.eyebrow', null, icon('calendar', 13), eyebrow),
      h('h2', null, title),
      h('p', null, sub),
      h('button.hero-cta', { onclick }, cta, icon(ctaIcon, 16)),
    ),
    thumb ? h('button.hero-thumb', { onclick, 'aria-label': cta, tabindex: -1 }, thumb) : null,
  );
}

function goalCard(ctx: Ctx): HTMLElement {
  const p = ctx.progress;
  const today = ctx.today();
  const solved = p.days[today]?.solved ?? 0;
  const streak = liveStreak(p, today, ctx.settings.streakFreeze);
  const week = h('div.week', { 'aria-label': 'Last 7 days' });
  for (let i = 6; i >= 0; i--) {
    const day = addDays(today, -i);
    const [y, m, d] = day.split('-').map(Number);
    const active = (p.days[day]?.solved ?? 0) > 0 || (p.days[day]?.rush ?? 0) > 0 || p.streak.frozenDays.includes(day);
    week.append(
      h(
        'div.day',
        { class: [active ? 'on' : '', i === 0 ? 'today' : ''].join(' '), title: day },
        h('span.dot', null, active ? (p.streak.frozenDays.includes(day) ? '🧊' : '🔥') : ''),
        h('span.dl', null, WEEKDAY[new Date(y, m - 1, d).getDay()][0]),
      ),
    );
  }
  const goalMet = solved >= DAILY_GOAL;
  return h(
    'div.goal-card',
    null,
    ring(solved, DAILY_GOAL, h('span', null, h('b', null, String(Math.min(solved, 99))), `/${DAILY_GOAL}`), 58),
    h(
      'div.goal-text',
      null,
      h('div.goal-title', null, goalMet ? 'Daily goal reached! 🎉' : 'Daily goal'),
      h('div.goal-sub', null, goalMet ? `${solved} solved today · ${streak}-day streak` : `${DAILY_GOAL - solved} more puzzle${DAILY_GOAL - solved === 1 ? '' : 's'} today · 🔥 ${streak}`),
      week,
    ),
  );
}

function mateCard(ctx: Ctx, n: MateN, level: string, cls: string): HTMLElement {
  const solved = ctx.progress.byN[n];
  const pct = Math.min(100, (solved % 25) * 4); // bar fills every 25 solves — small, frequent wins
  return h(
    'button.mate-card',
    { class: cls, onclick: () => ctx.go({ name: 'puzzle', mode: 'practice', n }), 'aria-label': `Mate in ${n}, ${level}, ${solved} solved` },
    h('span.mate-top', null, h('span.mate-n', null, String(n)), h('span.mate-level', null, level)),
    h('span.mate-title', null, `Mate in ${n}`),
    h('span.mate-bar', null, h('i', { style: `width:${Math.max(pct, 4)}%` })),
    h('span.mate-sub', null, `${solved} solved`),
  );
}

function modeRow(ic: IconName, cls: string, title: string, sub: string, onclick: () => void): HTMLElement {
  return h(
    'button.mode-row',
    { class: cls, onclick },
    h('span.mode-icon', null, icon(ic, 20)),
    h('span.mode-text', null, h('strong', null, title), h('span', null, sub)),
    icon('chevron', 18),
  );
}
