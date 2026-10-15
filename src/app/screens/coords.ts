import { Chessground } from '@lichess-org/chessground';
import type { Api } from '@lichess-org/chessground/api';
import type { Key } from '@lichess-org/chessground/types';
import { randomSquare, squareAt, type Orientation } from '../../game/coords';
import { recordCoords } from '../../progress/progress';
import { prefersReducedMotion } from '../../storage/settings';
import { clear, h, toast } from '../../ui/dom';
import { icon } from '../../ui/icons';
import { play } from '../../ui/sound';
import { GAMES } from '../catalog';
import type { Screen } from '../context';
import { celebrate, screenHeader, toolBtn } from '../kit';

const DURATION = 30;
const EMPTY = '8/8/8/8/8/8/8/8';

/** Coordinates: a 30-second drill. A square name appears; tap that square on the empty board. */
export const coordsScreen: Screen = async (ctx, root) => {
  let status: 'ready' | 'running' | 'over' = 'ready';
  let orientation: Orientation = 'white';
  let showCoords = false;
  let target = randomSquare(undefined);
  let score = 0;
  let misses = 0;
  let remaining = DURATION;
  let timer: number | undefined;
  let nextTimer: number | undefined;
  let locked = false;

  const wrap = h('div.cb-board-wrap');
  const boardEl = h('div.cb-board');
  wrap.append(boardEl);
  const boardHost = h('div.board-card', null, wrap);
  const targetEl = h('div.coord-target', { 'aria-live': 'polite' });
  const timerEl = h('span.rush-timer');
  const scoreEl = h('span.rush-score');
  const bar = h('div.rush-bar', null, timerEl, targetEl, scoreEl);
  const controls = h('div');
  const overlay = h('div');
  const intro = h(
    'div.rush-intro',
    null,
    h('div.big-icon', null, icon('board', 30)),
    h('h2', null, GAMES.coords.name),
    h('p', null, 'A square name appears. Tap that square on the empty board.'),
    h('div.rush-rules', null, h('span', null, `⏱ ${DURATION} sec`), h('span', null, `🏆 Best ${ctx.progress.coordsBest}`)),
    h('button.hero-cta', { onclick: () => begin() }, 'Start', icon('play', 15)),
  );

  root.append(
    screenHeader(ctx, GAMES.coords.name, `${DURATION} seconds`, undefined, { family: 'timed', back: { name: 'puzzles' }, backLabel: 'Back to Puzzles' }),
    intro,
    bar,
    boardHost,
    controls,
    overlay,
  );

  const cg: Api = Chessground(boardEl, {
    fen: EMPTY,
    orientation,
    viewOnly: true,
    coordinates: showCoords,
    addDimensionsCssVarsTo: wrap,
    animation: { enabled: false },
    highlight: { lastMove: false, check: false },
    drawable: { enabled: false, visible: false },
  });

  function flash(squares: [string, 'good' | 'bad'][], ms = 450) {
    cg.set({ highlight: { custom: new Map(squares.map(([s, k]) => [s as Key, `flash-${k}`])) } });
    window.setTimeout(() => cg.set({ highlight: { custom: new Map() } }), ms);
  }

  wrap.addEventListener('pointerdown', (e) => {
    if (status !== 'running' || locked) return;
    const rect = (boardEl.querySelector('cg-board') ?? boardEl).getBoundingClientRect();
    const sq = squareAt(e.clientX - rect.left, e.clientY - rect.top, rect.width, orientation);
    if (!sq) return;
    e.preventDefault();
    answer(sq);
  });

  function answer(sq: string) {
    locked = true;
    if (sq === target) {
      score += 1;
      play('move');
      flash([[sq, 'good']]);
    } else {
      misses += 1;
      play('end');
      flash([[sq, 'bad'], [target, 'good']], 700);
    }
    renderBar();
    nextTimer = window.setTimeout(next, sq === target ? 220 : 750);
  }

  function next() {
    if (status !== 'running') return;
    target = randomSquare(target);
    targetEl.textContent = target;
    locked = false;
  }

  function renderBar() {
    clear(timerEl);
    timerEl.append(icon('zap', 18), `0:${String(Math.max(0, Math.ceil(remaining))).padStart(2, '0')}`);
    timerEl.classList.toggle('low', remaining <= 10);
    clear(scoreEl);
    scoreEl.append(h('b', null, String(score)), h('span', null, 'correct'));
  }

  function renderStage() {
    const ready = status === 'ready';
    ctx.focus(!ready);
    intro.hidden = !ready;
    bar.hidden = ready;
    targetEl.hidden = status !== 'running';
    boardHost.hidden = status !== 'running';
    clear(controls);
    if (status === 'running') {
      controls.append(
        h(
          'div.toolbar',
          null,
          toolBtn('flip', 'Flip', () => {
            orientation = orientation === 'white' ? 'black' : 'white';
            cg.set({ orientation });
          }, { 'aria-label': 'Flip board' }),
          toolBtn('eye', showCoords ? 'Hide labels' : 'Show labels', () => {
            showCoords = !showCoords;
            cg.set({ coordinates: showCoords });
            renderStage();
          }),
        ),
      );
    }
  }

  function begin() {
    status = 'running';
    score = 0;
    misses = 0;
    remaining = DURATION;
    locked = false;
    target = randomSquare(undefined);
    targetEl.textContent = target;
    clear(overlay);
    renderStage();
    renderBar();
    requestAnimationFrame(() => cg.redrawAll());
    const end = performance.now() + DURATION * 1000;
    timer = window.setInterval(() => {
      remaining = (end - performance.now()) / 1000;
      if (remaining <= 0) {
        remaining = 0;
        void finish();
      }
      renderBar();
    }, 200);
  }

  async function finish() {
    if (status === 'over') return;
    status = 'over';
    clearInterval(timer);
    clearTimeout(nextTimer);
    play('end');
    const { best, badges } = recordCoords(ctx.progress, score, ctx.today(), ctx.settings.streakFreeze);
    await ctx.saveProgress();
    for (const b of badges) toast(`${b.icon} Badge unlocked: ${b.name}`, 'good', 3200);
    renderStage();
    const total = score + misses;
    overlay.append(
      h(
        'div.result-sheet',
        null,
        h(
          'div.result-head',
          null,
          h('div.result-badge', { class: best && score > 0 ? '' : 'neutral' }, best && score > 0 ? '🏆' : '🧭'),
          h('div', null, h('h2', null, best && score > 0 ? 'New personal best!' : 'Time’s up!'), h('p', null, `All-time best ${ctx.progress.coordsBest}`)),
        ),
        h('div.big-score.pop', null, String(score)),
        h('p', { style: 'text-align:center;color:var(--muted)' }, total ? `${Math.round((100 * score) / total)}% accuracy` : 'No answers'),
        h(
          'div.btn-row',
          null,
          h('button.btn.primary', { onclick: () => begin() }, icon('reset', 16), 'Play again'),
          h('button.btn', { onclick: () => ctx.go({ name: 'puzzles' }) }, icon('home', 16), 'Puzzles'),
        ),
      ),
    );
    if (best && score > 0 && !prefersReducedMotion(ctx.settings)) celebrate();
  }

  renderStage();
  renderBar();

  return {
    destroy: () => {
      clearInterval(timer);
      clearTimeout(nextTimer);
      cg.destroy();
    },
  };
};
