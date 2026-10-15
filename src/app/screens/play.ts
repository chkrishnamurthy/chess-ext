import { DRILLS } from '../../game/learn';
import { LESSONS } from '../../game/lessons';
import { GameSession, gameStateOk, type GameState } from '../../game/gameSession';
import { KEYS, load } from '../../storage/store';
import { h } from '../../ui/dom';
import { GAMES } from '../catalog';
import type { Route, Screen } from '../context';
import { gameRow, miniBoard, familyTag } from '../kit';
import { gameTitle } from './game';

/** Play tab: games against the computer. */
export const playScreen: Screen = async (ctx, root) => {
  const saved = await load<GameState | null>(KEYS.game, null);
  const unfinished = saved && !saved.result && gameStateOk(saved) ? saved : null;

  const p = ctx.progress;
  const lessonsDone = Object.keys(p.learn).filter((k) => k.startsWith('lesson-')).length;
  const piecesDone = Object.keys(p.learn).filter((k) => k.startsWith('piece-')).length;
  /** Both games share one save slot, so ask before replacing a game in progress. */
  const startNew = (route: Route) => {
    if (unfinished && !confirm('You have a game in progress. Start a new one and discard it?')) return;
    ctx.go(route);
  };

  root.append(h('div.hub-head', null, h('h1', null, 'Play'), h('p', null, 'Play the computer. Your game is saved after every move.')));

  if (unfinished) {
    const s = new GameSession(unfinished);
    root.append(
      h(
        'button.resume-card',
        { onclick: () => ctx.go({ name: 'game' }) },
        miniBoard(s.fen(), unfinished.userColor === 'w' ? 'white' : 'black', s.lastMove()),
        h(
          'span.game-text',
          null,
          familyTag('bot'),
          h('strong', null, `Continue: ${gameTitle(unfinished)}`),
          h('span', null, `Move ${Math.floor(unfinished.moves.length / 2) + 1} · you play ${unfinished.userColor === 'w' ? 'White' : 'Black'}`),
        ),
      ),
    );
  }

  root.append(
    h('div.section-label', null, 'Play a game'),
    gameRow(GAMES.quick, () => startNew({ name: 'quick' }), p.quick.w + p.quick.d + p.quick.l ? `Record ${p.quick.w}W ${p.quick.d}D ${p.quick.l}L` : undefined),
    h('div.section-label', null, 'Finish the job'),
    gameRow(GAMES.endgame, () => startNew({ name: 'game', fresh: true }), unfinished ? 'Start a new position' : undefined),
    h('div.section-label', null, 'Learn'),
    gameRow(GAMES.lessons, () => ctx.go({ name: 'lessons' }), lessonsDone ? `${lessonsDone} of ${LESSONS.length} won` : undefined),
    gameRow(GAMES.pieces, () => ctx.go({ name: 'learn' }), piecesDone ? `${piecesDone} of ${DRILLS.length} done` : undefined),
  );
  return {};
};
