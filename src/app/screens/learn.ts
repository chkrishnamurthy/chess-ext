import { Chessground } from '@lichess-org/chessground';
import type { Api } from '@lichess-org/chessground/api';
import type { Key } from '@lichess-org/chessground/types';
import { DRILLS, drillFen, parMoves, pieceMoves, stars, type Drill } from '../../game/learn';
import { recordLearn } from '../../progress/progress';
import { clear, h, toast } from '../../ui/dom';
import { icon } from '../../ui/icons';
import { play } from '../../ui/sound';
import { GAMES } from '../catalog';
import type { Screen } from '../context';
import { celebrate, screenHeader } from '../kit';

const drillId = (d: Drill) => `piece-${d.role}`;

/** Learn the Pieces: a list of six pieces, then a short drill for the one you pick. */
export const learnScreen: Screen = async (ctx, root, route) => {
  const piece = route.name === 'learn' ? route.piece : undefined;
  const drill = DRILLS.find((d) => d.role === piece);
  if (!drill) return listView(ctx, root);
  return drillView(ctx, root, drill);
};

function listView(ctx: Parameters<Screen>[0], root: HTMLElement) {
  const list = h('div.mode-list');
  for (const d of DRILLS) {
    const done = !!ctx.progress.learn[drillId(d)];
    list.append(
      h(
        'button.theme-row',
        { class: done ? 'done' : '', onclick: () => ctx.go({ name: 'learn', piece: d.role }) },
        h('span.game-text', null, h('strong', null, d.name), h('span', null, d.how)),
        h('span.theme-meter', null, h('b', null, done ? '✓' : 'Start')),
      ),
    );
  }
  root.append(
    screenHeader(ctx, GAMES.pieces.name, 'Capture every pawn with each piece', undefined, { family: 'learn', back: { name: 'play' }, backLabel: 'Back to Play' }),
    list,
  );
  return {};
}

function drillView(ctx: Parameters<Screen>[0], root: HTMLElement, drill: Drill) {
  const par = parMoves(drill) ?? drill.targets.length;
  let at = drill.start;
  let left = [...drill.targets];
  let moves = 0;
  let finished = false;

  const wrap = h('div.cb-board-wrap');
  const boardEl = h('div.cb-board');
  wrap.append(boardEl);
  const boardHost = h('div.board-card', null, wrap);
  const status = h('div.feedback', { 'aria-live': 'polite' });
  const info = h('div.rush-bar');
  const resultBox = h('div');

  root.append(
    screenHeader(ctx, drill.name, drill.how, undefined, { family: 'learn', back: { name: 'learn' }, backLabel: 'Back to the piece list' }),
    info,
    boardHost,
    status,
    resultBox,
  );
  ctx.focus(true);

  const cg: Api = Chessground(boardEl, {
    fen: drillFen(drill.role, at, left),
    orientation: 'white',
    coordinates: ctx.settings.coords,
    addDimensionsCssVarsTo: wrap,
    animation: { enabled: !document.documentElement.classList.contains('reduce-motion'), duration: 180 },
    highlight: { lastMove: true, check: false },
    draggable: { enabled: ctx.settings.moveInput !== 'click', showGhost: true },
    selectable: { enabled: ctx.settings.moveInput !== 'drag' },
    movable: { free: false, color: 'white', showDests: true, events: { after: (_o, dest) => onMove(dest) } },
    premovable: { enabled: false },
    drawable: { enabled: false, visible: false },
  });

  function dests() {
    return new Map<Key, Key[]>([[at as Key, pieceMoves(drill.role, at, new Set(left)) as Key[]]]);
  }

  function refresh() {
    cg.set({ fen: drillFen(drill.role, at, left), turnColor: 'white', movable: { color: finished ? undefined : 'white', dests: finished ? new Map() : dests() } });
    clear(info);
    info.append(
      h('span.rush-timer', null, icon('target', 16), `${drill.targets.length - left.length}/${drill.targets.length} captured`),
      h('span.rush-score', null, h('b', null, String(moves)), h('span', null, `moves · par ${par}`)),
    );
  }

  function onMove(dest: string) {
    moves += 1;
    const captured = left.includes(dest);
    at = dest;
    left = left.filter((t) => t !== dest);
    play(captured ? 'capture' : 'move');
    if (!left.length) return void finish();
    status.className = 'feedback info';
    status.textContent = captured ? 'Captured! Now the next one.' : 'Good move. Look for a pawn this piece can capture.';
    refresh();
  }

  function finish() {
    finished = true;
    refresh();
    const n = stars(moves, par);
    status.className = 'feedback good';
    status.textContent = `✅ All captured in ${moves} move${moves === 1 ? '' : 's'}!`;
    const badges = recordLearn(ctx.progress, drillId(drill), ctx.today());
    void ctx.saveProgress().then(() => badges.forEach((b) => toast(`${b.icon} Badge unlocked: ${b.name}`, 'good', 3200)));
    play('solve');
    celebrate();
    const idx = DRILLS.indexOf(drill);
    const nextDrill = DRILLS[idx + 1];
    resultBox.append(
      h(
        'div.result-sheet',
        null,
        h('div.result-head', null, h('div.result-badge', null, '⭐'), h('div', null, h('h2', null, '★'.repeat(n) + '☆'.repeat(3 - n)), h('p', null, n === 3 ? 'Perfect: the fewest possible moves.' : `Par is ${par}. Can you do it in fewer?`))),
        h(
          'div.btn-row',
          null,
          nextDrill ? h('button.btn.primary', { onclick: () => ctx.go({ name: 'learn', piece: nextDrill.role }) }, `Next: ${nextDrill.name}`, icon('arrow', 16)) : h('button.btn.primary', { onclick: () => ctx.go({ name: 'learn' }) }, 'All pieces'),
          h('button.btn', { onclick: () => ctx.go({ name: 'learn', piece: drill.role }) }, icon('reset', 16), 'Again'),
        ),
      ),
    );
  }

  status.className = 'feedback info';
  status.textContent = `Move the ${drill.name.toLowerCase()} to capture all ${drill.targets.length} black pawns.`;
  refresh();

  return { destroy: () => cg.destroy() };
}
