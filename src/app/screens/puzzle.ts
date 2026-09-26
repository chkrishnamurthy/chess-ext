import { explain } from '../../game/explain';
import { allPuzzles, dailyPuzzle, getPuzzle, nextPuzzle, TIER_LABEL, TIERS } from '../../game/puzzles';
import { newPuzzleState, PuzzleSession, type PuzzleState } from '../../game/puzzleSession';
import type { Puzzle, Tier } from '../../game/types';
import { liveStreak, recordPuzzle } from '../../progress/progress';
import { KEYS, load, save } from '../../storage/store';
import { clear, h, toast } from '../../ui/dom';
import { icon } from '../../ui/icons';
import { celebrate, screenHeader, toolBtn } from '../kit';
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
  // Reopening on an already-finished puzzle would show the old mating position and
  // look like a live one. It's already recorded, so go straight to a fresh puzzle.
  if (ctx.reopened && puzzle && state && state.status !== 'playing' && state.recorded) {
    const done = puzzle;
    if (route.mode === 'daily') {
      const pz = choosePuzzle(ctx, { name: 'puzzle', mode: 'practice', n: done.n }, done.id);
      if (pz) await save(KEYS.puzzle, newPuzzleState(pz, 'practice'));
      ctx.go({ name: 'puzzle', mode: 'practice', n: done.n });
      return {};
    }
    puzzle = choosePuzzle(ctx, route, done.id);
    state = undefined;
    if (puzzle) toast('Last puzzle finished ✓ — here’s a new one', 'good');
  }
  if (!puzzle || !state) {
    puzzle ??= choosePuzzle(ctx, route);
    if (!puzzle) {
      root.append(
        h('div.card', null, h('h3', null, 'All clear! 🎉'), h('p', null, 'No mistakes left to retry. Nice work.')),
        h('button.btn.primary', { onclick: () => ctx.go({ name: 'home' }) }, 'Back home'),
      );
      return {};
    }
    state = newPuzzleState(puzzle, route.mode);
  }

  const header = h('div');
  const tierSelect = h('select.tier-select', { 'aria-label': 'Difficulty' });
  const boardHost = h('div.board-card');
  const controls = h('div');
  const after = h('div');
  const view = new PuzzleView(boardHost, () => ctx.settings, {
    onChange: () => void save(KEYS.puzzle, session.state),
    onSolved: () => void finish(true),
  });
  let session = new PuzzleSession(puzzle, state!);

  if (route.mode === 'practice') {
    const n = route.n;
    const available = TIERS.filter((t) => allPuzzles().some((p) => p.n === n && p.tier === t));
    const current = route.tier ?? 'all';
    for (const t of ['all', ...available] as (Tier | 'all')[]) {
      tierSelect.append(h('option', { value: t, selected: current === t }, t === 'all' ? 'All levels' : TIER_LABEL[t]));
    }
    tierSelect.addEventListener('change', () => ctx.go({ name: 'puzzle', mode: 'practice', n, tier: tierSelect.value as Tier | 'all' }));
  }

  ctx.focus(true);
  root.append(header, boardHost, view.feedback, controls, after);

  function renderHeader() {
    const p = session.puzzle;
    const color = session.solverColor();
    const title = route.mode === 'daily' ? 'Today’s challenge' : route.mode === 'retry' ? 'Retry a mistake' : `Mate in ${p.n}`;
    clear(header);
    header.append(
      screenHeader(
        ctx,
        title,
        h(
          'span',
          { style: 'display:contents' },
          h('span.turn-pill', null, h('span.turn-dot', { class: color }), `${color === 'white' ? 'White' : 'Black'} to move`),
          h('span.chip', { class: p.tier }, TIER_LABEL[p.tier]),
          route.mode === 'practice' ? '' : `Mate in ${p.n}`,
        ),
        route.mode === 'practice' ? tierSelect : undefined,
      ),
    );
  }

  function renderControls() {
    clear(controls);
    if (session.state.status !== 'playing') return;
    controls.append(
      h(
        'div.toolbar',
        null,
        toolBtn('bulb', 'Hint', () => view.hint(), { class: 'accent' }),
        toolBtn('reset', 'Reset', () => view.reset()),
        toolBtn('flip', 'Flip', () => view.board.flip(), { 'aria-label': 'Flip board' }),
        toolBtn('eye', 'Solution', () => {
          view.reveal();
          void finish(false);
        }),
      ),
    );
  }

  function renderResult() {
    clear(after);
    const verbose = ctx.settings.coach === 'verbose';
    const ex = explain(session.puzzle, session.state.played, verbose);
    const solved = session.state.status === 'solved';
    const first = session.firstTry();
    const p = ctx.progress;
    const log = p.days[ctx.today()];
    const streak = liveStreak(p, ctx.today(), ctx.settings.streakFreeze);
    after.append(
      h(
        'div.result-sheet',
        null,
        h(
          'div.result-head',
          null,
          h('div.result-badge', { class: solved ? '' : 'neutral' }, solved ? (first ? '🏆' : '✅') : '📖'),
          h(
            'div',
            null,
            h('h2', null, solved ? (first ? 'Solved first try!' : 'Solved!') : 'Here’s how it works'),
            h('p', null, solved ? 'Great pattern — you’ll spot it faster next time.' : 'Saved to “Retry mistakes” so you can try again later.'),
          ),
        ),
        h('div.explain-title', null, icon('bulb', 16), ex.title),
        h('p', null, ex.idea),
        ex.defence ? h('p', { style: 'color:var(--muted)' }, ex.defence) : '',
        h('p.line', null, ex.line),
        log
          ? h(
              'div.recap-line',
              null,
              h('span', null, `✅ ${log.solved} today`),
              h('span', null, `🎯 ${log.attempted ? Math.round((100 * log.firstTry) / log.attempted) : 0}% first try`),
              h('span', null, `🔥 ${streak}-day streak`),
            )
          : '',
        h(
          'div.btn-row',
          null,
          h('button.btn.primary', { onclick: () => next() }, route.mode === 'daily' ? 'Keep practising' : 'Next puzzle', icon('arrow', 16)),
          h(
            'button.btn',
            {
              onclick: () => {
                session.state.status = 'playing';
                view.reset();
                renderControls();
                clear(after);
              },
            },
            icon('reset', 16),
            'Replay',
          ),
        ),
        session.puzzle.src ? h('p.src', null, 'Puzzle from the Lichess database (CC0).') : '',
      ),
    );
  }

  async function finish(justSolved: boolean) {
    renderControls();
    if (justSolved) celebrate();
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
    renderResult();
    after.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
  if (session.state.status !== 'playing') renderResult();
  void save(KEYS.puzzle, session.state);

  return {
    destroy: () => view.destroy(),
    onSettings: (s) => view.applySettings(s),
  };
};
