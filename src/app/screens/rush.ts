import { getPuzzle, rushSequence } from '../../game/puzzles';
import { newPuzzleState, PuzzleSession, type PuzzleState } from '../../game/puzzleSession';
import { recordPuzzle, recordRush } from '../../progress/progress';
import { KEYS, load, save } from '../../storage/store';
import { clear, h, toast } from '../../ui/dom';
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
  const scoreEl = h('span');
  const strikesEl = h('span.strikes', { 'aria-label': 'Strikes' });
  const bar = h('div.rush-bar', null, timerEl, scoreEl, strikesEl);
  const boardHost = h('div');
  const controls = h('div.btn-row');
  const overlay = h('div');
  root.append(bar, boardHost, h('div'), controls, overlay);

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

  function persist() {
    if (session) run!.current = session.state;
    void save(KEYS.rush, run);
  }

  function renderBar() {
    timerEl.textContent = `⏱ ${fmt(run!.remainingMs)}`;
    timerEl.classList.toggle('low', run!.remainingMs < 20000);
    scoreEl.textContent = `Score ${run!.score}`;
    clear(strikesEl);
    for (let i = 0; i < MAX_STRIKES; i++) strikesEl.append(h('span', { class: i < run!.strikes ? 'on' : '' }, '✕'));
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
    clear(controls);
    if (run!.status === 'ready') {
      controls.append(h('button.btn.primary', { onclick: () => begin() }, '⚡ Start — 3:00'));
    } else if (run!.status === 'paused') {
      controls.append(h('button.btn.primary', { onclick: () => begin() }, '▶ Resume'), h('button.btn', { onclick: () => restart() }, 'New run'));
    } else if (run!.status === 'running') {
      controls.append(
        h('button.btn', { onclick: () => pause() }, '⏸ Pause'),
        h('button.btn', { onclick: () => view.board.flip(), 'aria-label': 'Flip board' }, '⇅'),
        h('button.btn.ghost', { onclick: () => end() }, 'End run'),
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
    overlay.append(
      h(
        'div.card',
        null,
        h('div.big-score.pop', null, String(run!.score)),
        h('p', { style: 'text-align:center' }, run!.newBest ? '🏆 New personal best!' : `Today’s best: ${todayBest} · All-time best: ${p.rushBest}`),
        run!.missed.length ? h('p', null, `🔁 ${run!.missed.length} missed puzzle${run!.missed.length === 1 ? ' was' : 's were'} added to “Retry mistakes”.`) : run!.score > 0 ? h('p', null, 'No strikes — flawless!') : h('p', null, 'Ended early — give it a full three minutes next time!'),
        h(
          'div.btn-row',
          null,
          h('button.btn.primary', { onclick: () => { restart(); begin(); } }, '⚡ Play again'),
          h('button.btn', { onclick: () => ctx.go({ name: 'home' }) }, 'Home'),
        ),
      ),
    );
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
