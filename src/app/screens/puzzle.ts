import { explain } from '../../game/explain';
import { allPuzzles, dailyPuzzle, getPuzzle, nextPuzzle, TIER_LABEL, TIERS } from '../../game/puzzles';
import { newPuzzleState, PuzzleSession, type PuzzleState } from '../../game/puzzleSession';
import type { Puzzle, Tier } from '../../game/types';
import { liveStreak, recordPuzzle } from '../../progress/progress';
import { KEYS, load, save } from '../../storage/store';
import { clear, h, toast } from '../../ui/dom';
import type { Ctx, Route, Screen } from '../context';
import { PuzzleView } from '../puzzleView';

type PuzzleRoute = Extract<Route, { name: 'puzzle' }>;

function choosePuzzle(ctx: Ctx, route: PuzzleRoute, excludeId?: string): Puzzle | undefined {
  const p = ctx.progress;
  if (route.mode === 'daily') return dailyPuzzle(ctx.today());
  if (route.mode === 'retry') return p.mistakes.map(getPuzzle).find((x) => x && x.id !== excludeId) ?? undefined;
  const exclude = new Set(Object.keys(p.solved));
  if (excludeId) exclude.add(excludeId);
  const pick = nextPuzzle({ n: route.n, tier: route.tier ?? 'all', exclude, rating: p.rating, seed: ctx.today() });
  // Everything in this bucket solved: start over with ones solved longest ago rather than stopping.
  return pick ?? nextPuzzle({ n: route.n, tier: route.tier ?? 'all', exclude: new Set(excludeId ? [excludeId] : []), rating: p.rating, seed: String(Date.now()) });
}

export const puzzleScreen: Screen = async (ctx, root, r) => {
  const route = r as PuzzleRoute;
  const saved = await load<PuzzleState | null>(KEYS.puzzle, null);

  // Resume the saved attempt when it belongs to this route.
  let puzzle: Puzzle | undefined;
  let state: PuzzleState | undefined;
  const savedPuzzle = saved ? getPuzzle(saved.puzzleId) : undefined;
  if (saved && savedPuzzle && saved.mode === route.mode) {
    const matches =
      route.mode === 'daily'
        ? saved.puzzleId === dailyPuzzle(ctx.today()).id
        : route.mode === 'retry'
          ? true
          : savedPuzzle.n === route.n && (!route.tier || route.tier === 'all' || savedPuzzle.tier === route.tier);
    if (matches) {
      puzzle = savedPuzzle;
      state = saved;
    }
  }
  if (!puzzle) {
    puzzle = choosePuzzle(ctx, route);
    if (!puzzle) {
      root.append(
        h('div.card', null, h('h3', null, 'All clear! 🎉'), h('p', null, 'No mistakes left to retry. Nice work.')),
        h('button.btn.primary', { onclick: () => ctx.go({ name: 'home' }) }, 'Back home'),
      );
      return {};
    }
    state = newPuzzleState(puzzle, route.mode);
  }

  const header = h('div.objective');
  const tierBar = h('div.seg', { role: 'group', 'aria-label': 'Difficulty' });
  const boardHost = h('div');
  const controls = h('div.btn-row');
  const after = h('div');
  const view = new PuzzleView(boardHost, () => ctx.settings, {
    onChange: () => void save(KEYS.puzzle, session.state),
    onSolved: () => void finish(),
  });
  let session = new PuzzleSession(puzzle, state!);

  if (route.mode === 'practice') {
    const n = route.n;
    const available = TIERS.filter((t) => allPuzzles().some((p) => p.n === n && p.tier === t));
    const current = route.tier ?? 'all';
    for (const t of ['all', ...available] as (Tier | 'all')[]) {
      tierBar.append(
        h(
          'button',
          {
            'aria-pressed': String(current === t),
            onclick: () => {
              if (t !== current) ctx.go({ name: 'puzzle', mode: 'practice', n, tier: t });
            },
          },
          t === 'all' ? 'All' : TIER_LABEL[t],
        ),
      );
    }
  }

  root.append(header, route.mode === 'practice' ? tierBar : '', boardHost, view.feedback, controls, after);

  function renderHeader() {
    const p = session.puzzle;
    const color = session.solverColor();
    clear(header);
    header.append(
      h('span.turn-dot', { class: color }),
      h('strong', null, `${color === 'white' ? 'White' : 'Black'} to move — Mate in ${p.n}`),
      h('span.chip', { class: p.tier }, TIER_LABEL[p.tier]),
      route.mode === 'daily' ? h('span.chip', null, '📅 Daily') : '',
      route.mode === 'retry' ? h('span.chip', null, '🔁 Retry') : '',
    );
  }

  function renderControls() {
    clear(controls);
    const playing = session.state.status === 'playing';
    if (playing) {
      controls.append(
        h('button.btn', { onclick: () => view.hint(), title: 'Reveal a hint, step by step' }, '💡 Hint'),
        h('button.btn', { onclick: () => view.reset(), title: 'Back to the start position' }, '↺ Reset'),
        h('button.btn', { onclick: () => view.board.flip(), title: 'Flip board', 'aria-label': 'Flip board' }, '⇅'),
        h('button.btn.ghost', { onclick: () => { view.reveal(); void finish(); } }, 'Show solution'),
      );
    } else {
      controls.append(
        h('button.btn.primary', { onclick: () => next() }, route.mode === 'daily' ? 'Practice more' : 'Next puzzle →'),
        h('button.btn', { onclick: () => { session.state.status = 'playing'; view.reset(); renderControls(); clear(after); } }, '↺ Try again'),
      );
    }
  }

  function renderExplanation() {
    clear(after);
    const verbose = ctx.settings.coach === 'verbose';
    const ex = explain(session.puzzle, session.state.played, verbose);
    const solved = session.state.status === 'solved';
    const card = h(
      'div.card',
      null,
      solved ? h('div.solved-banner.pop', null, '✅', session.firstTry() ? 'Solved first try!' : 'Solved!') : null,
      h('h3', null, `💡 ${ex.title}`),
      h('p', null, ex.idea),
      ex.defence ? h('p', null, ex.defence) : null,
      h('p.line', null, ex.line),
      session.puzzle.src
        ? h('p.line', null, 'Puzzle from the Lichess database (CC0).')
        : null,
    );
    const p = ctx.progress;
    const log = p.days[ctx.today()];
    const recap = log
      ? h(
          'div.card.recap',
          null,
          h(
            'p',
            null,
            `Today: ${log.solved} solved · ${log.attempted ? Math.round((100 * log.firstTry) / log.attempted) : 0}% first try · streak ${liveStreak(p, ctx.today(), ctx.settings.streakFreeze)} 🔥`,
          ),
        )
      : null;
    after.append(card, recap ?? '');
  }

  async function finish() {
    renderControls();
    if (!session.state.recorded) {
      session.state.recorded = true;
      const solved = session.state.status === 'solved';
      const badges = recordPuzzle(
        ctx.progress,
        { puzzle: session.puzzle, solved, firstTry: session.firstTry(), daily: route.mode === 'daily' },
        ctx.today(),
        ctx.settings.streakFreeze,
      );
      await ctx.saveProgress();
      for (const b of badges) toast(`${b.icon} Badge unlocked: ${b.name}`, 'good', 3200);
    }
    await save(KEYS.puzzle, session.state);
    renderExplanation();
  }

  function next() {
    const nextRoute: PuzzleRoute = route.mode === 'daily' ? { name: 'puzzle', mode: 'practice', n: session.puzzle.n } : route;
    const pz = choosePuzzle(ctx, nextRoute, session.puzzle.id);
    if (!pz) {
      ctx.go({ name: 'home' });
      return;
    }
    if (nextRoute !== route) {
      // Switch to practice; the new route resumes the fresh state saved here.
      void save(KEYS.puzzle, newPuzzleState(pz, 'practice')).then(() => ctx.go(nextRoute));
      return;
    }
    session = new PuzzleSession(pz, newPuzzleState(pz, route.mode));
    void save(KEYS.puzzle, session.state);
    clear(after);
    renderHeader();
    view.load(session);
    renderControls();
  }

  renderHeader();
  view.load(session);
  renderControls();
  if (session.state.status !== 'playing') renderExplanation();
  void save(KEYS.puzzle, session.state);

  return {
    destroy: () => view.destroy(),
    onSettings: (s) => view.applySettings(s),
  };
};
