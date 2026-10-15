import { dailyPuzzle, getPuzzle, TIER_LABEL } from '../../game/puzzles';
import { GameSession, type GameState } from '../../game/gameSession';
import { PuzzleSession, type PuzzleState } from '../../game/puzzleSession';
import { addDays, liveStreak } from '../../progress/progress';
import { KEYS, load } from '../../storage/store';
import { clear, h } from '../../ui/dom';
import { icon, type IconName } from '../../ui/icons';
import { BY_TIME, GAMES, type Family, type GameId } from '../catalog';
import type { Ctx, Route, Screen } from '../context';
import { familyTag, gameRow, greeting, launch, miniBoard, ring } from '../kit';
import { gameTitle } from './game';

export const DAILY_GOAL = 5;
const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** The length of break the user last picked; it lives for as long as the window is open. */
let chosenTime: keyof typeof BY_TIME = '3';

/** Today tab: what to do right now. One resume/daily card, then games that fit the time you have. */
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
    timePicker(ctx),
    h('p.privacy', null, icon('lock', 13), 'No account · nothing leaves your device · works offline'),
  );
  return {};
};

/** "I have 1 / 3 / 10 min" chips, and three games that fit. */
function timePicker(ctx: Ctx): HTMLElement {
  const list = h('div.mode-list');
  const chips = h('div.seg.time-seg', { role: 'group', 'aria-label': 'How long do you have?' });
  const render = () => {
    clear(chips);
    clear(list);
    for (const t of Object.keys(BY_TIME) as (keyof typeof BY_TIME)[]) {
      chips.append(
        h(
          'button',
          {
            'aria-pressed': String(t === chosenTime),
            onclick: () => {
              chosenTime = t;
              render();
            },
          },
          `${t} min`,
        ),
      );
    }
    for (const id of BY_TIME[chosenTime]) list.append(gameRow(GAMES[id], () => void open(ctx, id)));
  };
  render();
  return h('div.time-picker', null, h('div.section-label', null, 'How long do you have?'), chips, list);
}

function open(ctx: Ctx, id: GameId): Promise<void> {
  const routes: Record<GameId, Route> = {
    daily: { name: 'puzzle', mode: 'daily' },
    m1: { name: 'puzzle', mode: 'practice', n: 1 },
    m2: { name: 'puzzle', mode: 'practice', n: 2 },
    m3: { name: 'puzzle', mode: 'practice', n: 3 },
    rush: { name: 'rush' },
    ghost: { name: 'ghost' },
    streak: { name: 'streak' },
    themes: { name: 'themes' },
    lessons: { name: 'lessons' },
    pieces: { name: 'learn' },
    coords: { name: 'coords' },
    quick: { name: 'quick' },
    retry: { name: 'puzzle', mode: 'retry' },
    endgame: { name: 'game', fresh: true },
  };
  return launch(ctx, id, routes[id]);
}

function hero(ctx: Ctx, game: GameState | null, puzzle: PuzzleState | null, firstVisit: boolean): HTMLElement {
  const today = ctx.today();
  // 1) An unfinished game or puzzle always comes first: one tap to resume.
  if (game && !game.result) {
    const s = new GameSession(game);
    return heroCard(
      'bot',
      'Continue your game',
      gameTitle(game),
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
          : puzzle.mode === 'theme' && puzzle.theme
            ? ({ name: 'puzzle', mode: 'theme', theme: puzzle.theme } as const)
            : ({ name: 'puzzle', mode: 'practice', n: pz.n } as const);
    return heroCard('puzzle', 'Continue your puzzle', `Mate in ${pz.n}`, `${TIER_LABEL[pz.tier]} · ${s.movesLeft()} move${s.movesLeft() === 1 ? '' : 's'} to go`, 'Continue puzzle', () => ctx.go(route), miniBoard(s.fen(), s.solverColor(), s.lastMove()), 'play');
  }
  // 2) First visit: the easiest possible start.
  if (firstVisit) {
    return heroCard('puzzle', 'Start here', 'Your first checkmate', 'An easy Mate in 1 · about 30 seconds', 'Let’s play', () => ctx.go({ name: 'puzzle', mode: 'practice', n: 1 }), null, 'play');
  }
  // 3) Today's challenge.
  const daily = dailyPuzzle(today);
  const done = ctx.progress.daily[today];
  const [y, m, d] = today.split('-').map(Number);
  const dow = WEEKDAY[new Date(y, m - 1, d).getDay()];
  return heroCard(
    'puzzle',
    done === 'solved' ? 'Daily Puzzle · solved ✓' : 'Daily Puzzle',
    `Mate in ${daily.n}`,
    done === 'solved' ? 'Nice! A new one arrives tomorrow.' : `${dow} · ${TIER_LABEL[daily.tier]}`,
    done === 'solved' ? 'See it again' : done === 'failed' ? 'Try again' : 'Solve now',
    () => ctx.go({ name: 'puzzle', mode: 'daily' }),
    miniBoard(daily.fen, daily.fen.split(' ')[1] === 'w' ? 'white' : 'black', daily.last),
    done === 'solved' ? 'check' : 'arrow',
  );
}

function heroCard(family: Family, eyebrow: string, title: string, sub: string, cta: string, onclick: () => void, thumb: HTMLElement | null, ctaIcon: IconName): HTMLElement {
  return h(
    'div.hero',
    null,
    h(
      'div.hero-text',
      null,
      h('div.eyebrow', null, icon('calendar', 13), eyebrow, familyTag(family)),
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
    const active = (p.days[day]?.solved ?? 0) > 0 || (p.days[day]?.rush ?? 0) > 0 || (p.days[day]?.streak ?? 0) > 0 || (p.days[day]?.coords ?? 0) > 0 || (p.days[day]?.ghost ?? 0) > 0 || p.streak.frozenDays.includes(day);
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
