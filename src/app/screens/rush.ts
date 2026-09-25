import { getPuzzle, rushSequence } from '../../game/puzzles';
import { newPuzzleState, PuzzleSession, type PuzzleState } from '../../game/puzzleSession';
import { recordPuzzle, recordRush } from '../../progress/progress';
import { KEYS, load, save } from '../../storage/store';
import { clear, h, toast } from '../../ui/dom';
import { icon } from '../../ui/icons';
import { celebrate, screenHeader, toolBtn } from '../kit';
import { play } from '../../ui/sound';
import type { Screen } from '../context';
import { PuzzleView } from '../puzzleView';

const DURATION = 3 * 60 * 1000;
const MAX_STRIKES = 3;

/** Autosaved rush run. The clock pauses whenever the popup closes — no lost runs. */
interface RushState {
  seed: string;
  ids: string[];
  index: number;
  score: number;
  strikes: number;
  remainingMs: number;
  status: 'ready' | 'running' | 'paused' | 'over';
  current?: PuzzleState;
  missed: string[];
  recorded?: boolean;
  newBest?: boolean;
}

function freshRun(): RushState {
  const seed = String(Date.now());
  return {
    seed, ids: rushSequence(seed).map((p) => p.id), index: 0, score: 0, strikes: 0,
    remainingMs: DURATION, status: 'ready', missed: [],
  };
}

const fmt = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export const rushScreen: Screen = async (ctx, root) => {
  let run = await load<RushState | null>(KEYS.rush, null);
  if (!run || run.status === 'over') run = run?.status === 'over' ? run : freshRun();
  if (run.status === 'running') run.status = 'paused';

  const timerEl = h('span.rush-timer');
  const scoreEl = h('span.rush-score');
  const strikesEl = h('span.strikes', { 'aria-label': 'Strikes' });
  const bar = h('div.rush-bar', null, timerEl, scoreEl, strikesEl);
  const boardHost = h('div.board-card');
  const controls = h('div');
  const overlay = h('div');
  const intro = h(
    'div.rush-intro',
    null,
    h('div.big-icon', null, icon('zap', 30)),
    h('h2', null, 'Puzzle Rush'),
    h('p', null, 'Solve as many checkmates as you can. They start easy and get harder.'),
    h(
      'div.rush-rules',
      null,
      h('span', null, '⏱ 3:00'),
      h('span', null, '✕ 3 strikes'),
      h('span', null, `🏆 Best ${ctx.progress.rushBest}`),
    ),
    h('button.hero-cta', { onclick: () => begin() }, 'Start the clock', icon('play', 15)),
  );
  root.append(screenHeader(ctx, 'Puzzle Rush', '3 minutes · 3 strikes'), intro, bar, boardHost, controls, overlay);

  let session: PuzzleSession | undefined;
  let tick: number | undefined;
  let lastTs = 0;
  let advanceTimer: number | undefined;

  const view = new PuzzleView(boardHost, () => ctx.settings, {
    onChange: () => persist(),
    onSolved: () => {
      run!.score += 1;
      advance(350);
    },
    onWrong: (s) => {
      run!.strikes += 1;
      run!.missed.push(s.puzzle.id);
      if (run!.strikes >= MAX_STRIKES) end();
      else advance(700);
    },
  });
  view.rush = true;
  boardHost.after(view.feedback);

  /** The intro card replaces the board until the run starts (no peeking at puzzle #1). */
  function renderStage() {
    const ready = run!.status === 'ready';
    ctx.focus(!ready);
    intro.hidden = !ready;
    bar.hidden = ready;
    boardHost.hidden = ready;
    view.feedback.hidden = ready;
  }

  function persist() {
    if (session) run!.current = session.state;
    void save(KEYS.rush, run);
  }

  function renderBar() {
    clear(timerEl);
    timerEl.append(icon('zap', 18), fmt(run!.remainingMs));
    timerEl.classList.toggle('low', run!.remainingMs < 20000);
    clear(scoreEl);
    scoreEl.append(h('b', null, String(run!.score)), h('span', null, 'solved'));
    clear(strikesEl);
    for (let i = 0; i < MAX_STRIKES; i++) strikesEl.append(h('span', { class: i < run!.strikes ? 'on' : '' }, icon('x', 13)));
  }

  function loadPuzzle() {
    const id = run!.ids[run!.index % run!.ids.length];
    const pz = getPuzzle(id)!;
    const st = run!.current && run!.current.puzzleId === id ? run!.current : newPuzzleState(pz, 'rush');
    session = new PuzzleSession(pz, st);
    view.load(session);
    if (run!.status !== 'running') view.board.lock();
    view.setFeedback(`${session.solverColor() === 'white' ? 'White' : 'Black'} to move — Mate in ${pz.n}`, 'info');
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

  function startClock() {
    stopClock();
    lastTs = performance.now();
    tick = window.setInterval(() => {
      const now = performance.now();
      const before = run!.remainingMs;
      run!.remainingMs -= now - lastTs;
      if (Math.ceil(before / 1000) !== Math.ceil(run!.remainingMs / 1000)) persist();
      lastTs = now;
      if (run!.remainingMs <= 0) {
        run!.remainingMs = 0;
        end();
      }
      renderBar();
    }, 200);
  }

  function stopClock() {
    if (tick) clearInterval(tick);
    tick = undefined;
  }

  function renderControls() {
    renderStage();
    clear(controls);
    if (run!.status === 'paused') {
      controls.append(
        h(
          'div.btn-row',
          null,
          h('button.btn.primary', { onclick: () => begin() }, icon('play', 16), 'Resume'),
          h('button.btn', { onclick: () => restart() }, icon('reset', 16), 'New run'),
        ),
      );
    } else if (run!.status === 'running') {
      controls.append(
        h(
          'div.toolbar',
          null,
          toolBtn('pause', 'Pause', () => pause()),
          toolBtn('flip', 'Flip', () => view.board.flip(), { 'aria-label': 'Flip board' }),
          toolBtn('flag', 'End run', () => void end()),
        ),
      );
    }
  }

  function begin() {
    run!.status = 'running';
    clear(overlay);
    loadPuzzle();
    startClock();
    renderControls();
    persist();
  }

  function pause() {
    run!.status = 'paused';
    stopClock();
    view.board.lock();
    renderControls();
    persist();
  }

  function restart() {
    run = freshRun();
    session = undefined;
    clear(overlay);
    renderBar();
    renderControls();
    loadPuzzle();
    view.setFeedback('Solve as many as you can in 3 minutes. Three strikes and you’re out.', 'info');
  }

  async function end() {
    if (run!.status === 'over' && run!.recorded) return;
    stopClock();
    clearTimeout(advanceTimer);
    run!.status = 'over';
    view.board.lock();
    view.setFeedback(run!.remainingMs <= 0 ? '⏱ Time’s up!' : run!.strikes >= MAX_STRIKES ? 'Three strikes — run over.' : 'Run ended.', 'info');
    play('end');
    if (!run!.recorded) {
      run!.recorded = true;
      const p = ctx.progress;
      const today = ctx.today();
      const prevToday = p.days[today]?.rush ?? 0;
      for (const id of run!.missed) {
        const pz = getPuzzle(id);
        if (pz) recordPuzzle(p, { puzzle: pz, solved: false, firstTry: false, rush: true }, today, ctx.settings.streakFreeze);
      }
      const { best, badges } = recordRush(p, run!.score, today, ctx.settings.streakFreeze);
      run!.newBest = best;
      if (!best && run!.score > prevToday && prevToday > 0) toast('New best for today!', 'good');
      await ctx.saveProgress();
      for (const b of badges) toast(`${b.icon} Badge unlocked: ${b.name}`, 'good', 3200);
    }
    persist();
    renderOver();
    renderControls();
  }

  function renderOver() {
    clear(overlay);
    const p = ctx.progress;
    const todayBest = p.days[ctx.today()]?.rush ?? run!.score;
    const r = run!;
    overlay.append(
      h(
        'div.result-sheet',
        null,
        h(
          'div.result-head',
          null,
          h('div.result-badge', { class: r.newBest ? '' : 'neutral' }, r.newBest ? '🏆' : '⚡'),
          h(
            'div',
            null,
            h('h2', null, r.newBest ? 'New personal best!' : r.remainingMs <= 0 ? 'Time’s up!' : 'Run over'),
            h('p', null, `Today’s best ${todayBest} · All-time best ${p.rushBest}`),
          ),
        ),
        h('div.big-score.pop', null, String(r.score)),
        h('p', { style: 'text-align:center;color:var(--muted)' }, r.score === 1 ? 'puzzle solved' : 'puzzles solved'),
        r.missed.length
          ? h('p', { style: 'color:var(--muted)' }, `🔁 ${r.missed.length} missed puzzle${r.missed.length === 1 ? ' was' : 's were'} added to “Retry mistakes”.`)
          : r.score > 0
            ? h('p', { style: 'color:var(--muted)' }, 'No strikes — flawless! ✨')
            : h('p', { style: 'color:var(--muted)' }, 'Ended early — give it the full three minutes next time!'),
        h(
          'div.btn-row',
          null,
          h('button.btn.primary', { onclick: () => { restart(); begin(); } }, icon('zap', 16), 'Play again'),
          h('button.btn', { onclick: () => ctx.go({ name: 'home' }) }, icon('home', 16), 'Home'),
        ),
      ),
    );
    if (r.newBest) celebrate();
  }

  renderBar();
  renderControls();
  if (run.status === 'over') {
    loadPuzzle(); // show the last position (locked) behind the recap
    view.setFeedback('Run over.', 'info');
    renderOver();
  } else {
    loadPuzzle();
    if (run.status === 'ready') view.setFeedback('Solve as many as you can in 3 minutes. Three strikes and you’re out.', 'info');
    else view.setFeedback('Paused — the clock stops while you’re away.', 'info');
  }

  // Pause automatically if the page is hidden (popup closed or tab switched).
  const onHide = (e: Event) => {
    if ((e.type === 'pagehide' || document.visibilityState === 'hidden') && run!.status === 'running') pause();
  };
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', onHide);

  return {
    destroy: () => {
      if (run!.status === 'running') pause();
      stopClock();
      clearTimeout(advanceTimer);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onHide);
      view.destroy();
    },
    onSettings: (s) => view.applySettings(s),
  };
};
