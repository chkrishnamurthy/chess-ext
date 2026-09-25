import positionsJson from '../../data/positions.json';
import { LEVEL_LABEL } from '../../engine/engine';
import { GameSession, newGameState, RESULT_TEXT, type BotLevel, type GameState } from '../../game/gameSession';
import { TIER_LABEL } from '../../game/puzzles';
import type { FinishPosition } from '../../game/types';
import { recordGame } from '../../progress/progress';
import type { Settings } from '../../storage/settings';
import { KEYS, load, save } from '../../storage/store';
import { Board } from '../../ui/board';
import { announce, clear, h, toast } from '../../ui/dom';
import { play } from '../../ui/sound';
import { openSidePanel } from '../nav';
import type { Ctx, Route, Screen, ScreenHandle } from '../context';

export const POSITIONS = positionsJson as FinishPosition[];

type GameRoute = Extract<Route, { name: 'game' }>;

export const gameScreen: Screen = async (ctx, root, r) => {
  const route = r as GameRoute;
  const saved = await load<GameState | null>(KEYS.game, null);
  let level: BotLevel = saved?.level ?? 'beginner';

  if (route.positionId) {
    const pos = POSITIONS.find((p) => p.id === route.positionId)!;
    const st = newGameState(pos.id, pos.fen, level);
    await save(KEYS.game, st);
    // Next time the popup opens it resumes this game, not a brand-new one.
    await save(KEYS.screen, { name: 'game' });
    return playView(ctx, root, st);
  }
  // Resume the saved game (including a finished game's result/review screen).
  if (saved && !route.fresh) return playView(ctx, root, saved);
  return pickerView(ctx, root, level, (l) => (level = l));
};

function levelPicker(current: BotLevel, onPick: (l: BotLevel) => void): HTMLElement {
  const seg = h('div.seg', { role: 'group', 'aria-label': 'Bot difficulty' });
  const render = (cur: BotLevel) => {
    clear(seg);
    for (const l of Object.keys(LEVEL_LABEL) as BotLevel[]) {
      seg.append(
        h('button', { 'aria-pressed': String(l === cur), onclick: () => { onPick(l); render(l); } }, `🤖 ${LEVEL_LABEL[l]}`),
      );
    }
  };
  render(current);
  return seg;
}

function pickerView(ctx: Ctx, root: HTMLElement, level: BotLevel, setLevel: (l: BotLevel) => void): ScreenHandle {
  const list = h('div.position-list');
  for (const p of POSITIONS) {
    list.append(
      h(
        'button.position-item',
        { onclick: () => ctx.go({ name: 'game', positionId: p.id }) },
        h('span.grow', null, h('strong', null, p.title), h('br'), h('span.desc', null, p.goal)),
        h('span.chip', { class: p.tier }, TIER_LABEL[p.tier]),
      ),
    );
  }
  root.append(
    h('div.hero', null, h('h2', null, '♔ Finish the Position'), h('p.sub', null, 'You start from a winning position. Can you convert it against the computer?')),
    h('div.section-title', null, 'Computer strength'),
    levelPicker(level, setLevel),
    h('div.section-title', null, 'Choose a position'),
    list,
  );
  return {};
}

function playView(ctx: Ctx, root: HTMLElement, state: GameState): ScreenHandle {
  const game = new GameSession(state);
  const pos = POSITIONS.find((p) => p.id === state.positionId);
  const userColor = state.userColor === 'w' ? 'white' : 'black';
  let token = 0; // invalidates in-flight bot searches after undo / leaving the screen
  let reviewPly: number | null = null;

  const header = h(
    'div.objective',
    null,
    h('span.turn-dot', { class: userColor }),
    h('strong', null, pos?.title ?? 'Finish the Position'),
    pos ? h('span.chip', { class: pos.tier }, TIER_LABEL[pos.tier]) : null,
  );
  const goal = h('p', { style: 'margin:0;color:var(--muted)' }, `You play ${userColor === 'white' ? 'White' : 'Black'}. ${pos?.goal ?? ''}`);
  const tip = h('div.card', { hidden: true }, h('p', null, `💡 ${pos?.tip ?? ''}`));
  const levelRow = levelPicker(state.level, (l) => {
    game.state.level = l;
    persist();
  });
  const boardHost = h('div');
  const status = h('div.feedback', { 'aria-live': 'polite' });
  const moves = h('div.moves', { 'aria-label': 'Moves' });
  const controls = h('div.btn-row');
  const resultBox = h('div');

  root.append(header, goal, levelRow, boardHost, status, moves, controls, tip, resultBox);
  const board = new Board(boardHost, ctx.settings);
  if (ctx.surface === 'popup') {
    root.append(
      h(
        'button.btn.ghost.small',
        {
          onclick: async () => {
            if (await openSidePanel()) window.close();
            else toast('Side panel isn’t available in this browser.');
          },
        },
        '↗ Continue in the side panel (stays open while you browse)',
      ),
    );
  }

  function persist() {
    void save(KEYS.game, game.state);
  }

  function render(animate = true) {
    const ended = !!game.state.result;
    const ply = reviewPly ?? game.state.moves.length;
    board.set({
      fen: reviewPly === null ? game.fen() : game.fenAt(ply),
      orientation: ctx.settings.orientation === 'white' ? 'white' : userColor,
      movable: !ended && reviewPly === null && game.isUserTurn() ? userColor : null,
      lastMove: ply > 0 ? game.state.moves[ply - 1] : undefined,
    }, animate);
    renderMoves(ply);
    renderControls();
    if (!ended) {
      status.className = 'feedback info';
      status.textContent = game.isUserTurn() ? (game.chess.inCheck() ? 'You’re in check!' : 'Your move.') : '🤖 Thinking…';
    }
  }

  function renderMoves(ply: number) {
    clear(moves);
    const sans = game.sanHistory();
    const startNum = Number(game.state.startFen.split(' ')[5] ?? 1);
    const blackFirst = game.state.startFen.split(' ')[1] === 'b';
    sans.forEach((san, i) => {
      const idx = i + (blackFirst ? 1 : 0);
      const num = startNum + Math.floor(idx / 2);
      const label = idx % 2 === 0 ? `${num}. ${san}` : i === 0 ? `${num}… ${san}` : san;
      moves.append(h('span', { class: i === ply - 1 ? 'cur' : '' }, label));
    });
    moves.scrollTop = moves.scrollHeight;
  }

  function renderControls() {
    clear(controls);
    if (game.state.result) return;
    controls.append(
      h('button.btn', { onclick: () => undo(), disabled: game.state.moves.length === 0, title: 'Take back your last move' }, '↶ Undo'),
      h('button.btn', { onclick: () => board.flip(), 'aria-label': 'Flip board', title: 'Flip board' }, '⇅'),
      h('button.btn', { onclick: () => (tip.hidden = !tip.hidden), title: 'Show a tip' }, '💡 Tip'),
      h('button.btn', { onclick: () => resign() }, '🏳 Resign'),
    );
  }

  function renderResult() {
    clear(resultBox);
    const res = game.state.result;
    if (!res) return;
    const icon = res.outcome === 'win' ? '🏆' : res.outcome === 'draw' ? '🤝' : '💪';
    const userMoves = Math.ceil(game.state.moves.length / 2);
    const head =
      res.outcome === 'win'
        ? `You won in ${userMoves} move${userMoves === 1 ? '' : 's'}!`
        : res.outcome === 'draw'
          ? 'Draw — so close!'
          : res.reason === 'resigned' ? 'Game over' : 'The bot got you this time';
    const tipLine =
      res.reason === 'stalemate'
        ? 'Tip: before each move, check the enemy king still has a legal move.'
        : res.outcome === 'win' ? 'That’s exactly how you convert an advantage.' : 'Every game is practice. Try the position again?';
    const stepper = h(
      'div.btn-row',
      null,
      h('button.btn.small', { onclick: () => step(0), 'aria-label': 'First move' }, '⏮'),
      h('button.btn.small', { onclick: () => step((reviewPly ?? game.state.moves.length) - 1), 'aria-label': 'Previous move' }, '◀'),
      h('button.btn.small', { onclick: () => step((reviewPly ?? game.state.moves.length) + 1), 'aria-label': 'Next move' }, '▶'),
      h('button.btn.small', { onclick: () => step(game.state.moves.length), 'aria-label': 'Last move' }, '⏭'),
    );
    resultBox.append(
      h(
        'div.card',
        null,
        h('div.solved-banner.pop', null, icon, head),
        h('p', null, `${RESULT_TEXT[res.reason]}. ${tipLine}`),
        h('div.section-title', null, 'Review your moves'),
        stepper,
        h(
          'div.btn-row',
          null,
          h('button.btn.primary', { onclick: () => ctx.go({ name: 'game', positionId: game.state.positionId }) }, '↺ Play again'),
          h('button.btn', { onclick: () => ctx.go({ name: 'game', fresh: true }) }, 'Other positions'),
        ),
      ),
    );
    levelRow.hidden = true;
    status.className = `feedback ${res.outcome === 'win' ? 'good' : 'info'}`;
    status.textContent = RESULT_TEXT[res.reason];
  }

  function step(ply: number) {
    const max = game.state.moves.length;
    reviewPly = Math.max(0, Math.min(max, ply));
    if (reviewPly === max) reviewPly = null;
    render();
  }

  async function onEnd() {
    const res = game.state.result!;
    play(res.outcome === 'win' ? 'solve' : 'end');
    announce(RESULT_TEXT[res.reason]);
    if (!game.state.recorded) {
      game.state.recorded = true;
      const badges = recordGame(ctx.progress, res.outcome, ctx.today(), ctx.settings.streakFreeze);
      await ctx.saveProgress();
      for (const b of badges) toast(`${b.icon} Badge unlocked: ${b.name}`, 'good', 3200);
    }
    persist();
    render();
    renderResult();
  }

  function soundFor(san: string) {
    play(san.includes('+') || san.includes('#') ? 'check' : san.includes('x') ? 'capture' : 'move');
  }

  board.onMove = (uci) => {
    if (!game.isUserTurn()) return;
    const san = game.play(uci);
    if (!san) {
      render();
      return;
    }
    soundFor(san);
    persist();
    render();
    if (game.state.result) void onEnd();
    else void botMove();
  };

  async function botMove() {
    if (game.state.result || game.isUserTurn()) return;
    const my = ++token;
    board.lock();
    const started = performance.now();
    const uci = await ctx.engine().bestMove(game.fen(), game.state.level);
    // A short pause so instant replies don't feel jarring.
    await new Promise((res) => setTimeout(res, Math.max(0, 350 - (performance.now() - started))));
    if (my !== token) return;
    const san = game.play(uci);
    if (san) soundFor(san);
    persist();
    render();
    if (game.state.result) void onEnd();
  }

  function undo() {
    token++;
    if (game.undo()) {
      persist();
      render();
      if (!game.isUserTurn()) void botMove();
    }
  }

  function resign() {
    if (!confirm('Resign this game?')) return;
    token++;
    game.resign();
    void onEnd();
  }

  render(false);
  if (game.state.result) renderResult();
  else if (!game.isUserTurn()) void botMove();

  return {
    destroy: () => {
      token++;
      ctx.engine().stop();
      board.destroy();
    },
    onSettings: (s: Settings) => {
      board.applySettings(s);
      render();
    },
  };
}
