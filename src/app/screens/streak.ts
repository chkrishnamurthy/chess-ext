import { getPuzzle, streakSequence } from '../../game/puzzles';
import { newPuzzleState, PuzzleSession, type PuzzleState } from '../../game/puzzleSession';
import { recordPuzzle, recordStreak } from '../../progress/progress';
import { KEYS, load, save } from '../../storage/store';
import { clear, h, toast } from '../../ui/dom';
import { icon } from '../../ui/icons';
import { play } from '../../ui/sound';
import { GAMES } from '../catalog';
import type { Screen } from '../context';
import { celebrate, screenHeader, toolBtn } from '../kit';
import { PuzzleView } from '../puzzleView';

/** Autosaved streak run: no clock, so it simply picks up where you left off. */
interface StreakState {
  seed: string;
  ids: string[];
  index: number;
  score: number;
  status: 'running' | 'over';
  current?: PuzzleState;
  missed?: string;
  recorded?: boolean;
  newBest?: boolean;
}

function freshRun(): StreakState {
  const seed = String(Date.now());
  return { seed, ids: streakSequence(seed).map((p) => p.id), index: 0, score: 0, status: 'running' };
}

export const streakScreen: Screen = async (ctx, root) => {
  let run = await load<StreakState | null>(KEYS.streak, null);
  // A finished run keeps its recap on screen, except on reopening: then start fresh.
  if (!run || (run.status === 'over' && run.recorded && ctx.reopened)) run = freshRun();

  const scoreEl = h('span.rush-score');
  const bestEl = h('span.rush-timer');
  const bar = h('div.rush-bar', null, bestEl, scoreEl);
  const boardHost = h('div.board-card');
  const controls = h('div');
  const overlay = h('div');
  root.append(
    screenHeader(ctx, GAMES.streak.name, 'Keep going until you miss', undefined, { family: 'puzzle', back: { name: 'puzzles' }, backLabel: 'Back to Puzzles' }),
    bar,
    boardHost,
    controls,
    overlay,
  );
  ctx.focus(true);

  let session: PuzzleSession | undefined;
  let advanceTimer: number | undefined;

  const view = new PuzzleView(boardHost, () => ctx.settings, {
    onChange: () => persist(),
    onSolved: () => {
      run!.score += 1;
      advance(450);
    },
    onWrong: (s) => {
      run!.missed = s.puzzle.id;
      void end();
    },
  });
  view.rush = true; // a wrong move ends the puzzle, no second try
  boardHost.after(view.feedback);

  function persist() {
    if (session) run!.current = session.state;
    void save(KEYS.streak, run);
  }

  function renderBar() {
    clear(bestEl);
    bestEl.append(icon('trophy', 16), `Best ${Math.max(ctx.progress.streakBest, run!.score)}`);
    clear(scoreEl);
    scoreEl.append(h('b', null, String(run!.score)), h('span', null, 'in a row'));
  }

  function loadPuzzle() {
    const id = run!.ids[run!.index % run!.ids.length];
    const pz = getPuzzle(id)!;
    const st = run!.current && run!.current.puzzleId === id ? run!.current : newPuzzleState(pz, 'rush');
    session = new PuzzleSession(pz, st);
    view.load(session);
    if (run!.status === 'over') view.board.lock();
    else view.setFeedback(`${session.solverColor() === 'white' ? 'White' : 'Black'} to move — Mate in ${pz.n}`, 'info');
    persist();
  }

  function advance(ms: number) {
    renderBar();
    clearTimeout(advanceTimer);
    advanceTimer = window.setTimeout(() => {
      if (run!.status !== 'running') return;
      run!.index += 1;
      run!.current = undefined;
      loadPuzzle();
    }, ms);
    persist();
  }

  function renderControls() {
    clear(controls);
    if (run!.status === 'running') {
      controls.append(
        h('div.toolbar', null, toolBtn('flip', 'Flip', () => view.board.flip(), { 'aria-label': 'Flip board' }), toolBtn('flag', 'End streak', () => void end())),
      );
    }
  }

  function restart() {
    run = freshRun();
    session = undefined;
    clear(overlay);
    renderBar();
    renderControls();
    loadPuzzle();
  }

  async function end() {
    if (run!.status === 'over' && run!.recorded) return;
    clearTimeout(advanceTimer);
    run!.status = 'over';
    view.board.lock();
    view.setFeedback(run!.missed ? 'That move doesn’t force mate. Streak over.' : 'Streak ended.', 'info');
    play('end');
    if (!run!.recorded) {
      run!.recorded = true;
      const p = ctx.progress;
      const today = ctx.today();
      if (run!.missed) {
        const pz = getPuzzle(run!.missed);
        if (pz) recordPuzzle(p, { puzzle: pz, solved: false, firstTry: false, rush: true }, today, ctx.settings.streakFreeze);
      }
      const { best, badges } = recordStreak(p, run!.score, today, ctx.settings.streakFreeze);
      run!.newBest = best && run!.score > 0;
      await ctx.saveProgress();
      for (const b of badges) toast(`${b.icon} Badge unlocked: ${b.name}`, 'good', 3200);
    }
    persist();
    renderOver();
    renderControls();
  }

  function renderOver() {
    clear(overlay);
    const r = run!;
    overlay.append(
      h(
        'div.result-sheet',
        null,
        h(
          'div.result-head',
          null,
          h('div.result-badge', { class: r.newBest ? '' : 'neutral' }, r.newBest ? '🏆' : '🔥'),
          h('div', null, h('h2', null, r.newBest ? 'New longest streak!' : 'Streak over'), h('p', null, `Longest streak: ${ctx.progress.streakBest}`)),
        ),
        h('div.big-score.pop', null, String(r.score)),
        h('p', { style: 'text-align:center;color:var(--muted)' }, r.score === 1 ? 'puzzle in a row' : 'puzzles in a row'),
        r.missed ? h('p', { style: 'color:var(--muted)' }, '🔁 The puzzle you missed was added to “Retry mistakes”.') : null,
        h(
          'div.btn-row',
          null,
          h('button.btn.primary', { onclick: () => restart() }, icon('repeat', 16), 'Try again'),
          h('button.btn', { onclick: () => ctx.go({ name: 'puzzles' }) }, icon('home', 16), 'Puzzles'),
        ),
      ),
    );
    if (r.newBest) celebrate();
  }

  renderBar();
  renderControls();
  loadPuzzle();
  if (run.status === 'over') {
    view.setFeedback('Streak over.', 'info');
    renderOver();
  }

  return {
    destroy: () => {
      clearTimeout(advanceTimer);
      view.destroy();
    },
    onSettings: (s) => view.applySettings(s),
  };
};
