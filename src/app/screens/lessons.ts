import { LESSONS } from '../../game/lessons';
import { TIER_LABEL } from '../../game/puzzles';
import { h } from '../../ui/dom';
import { GAMES } from '../catalog';
import type { Screen } from '../context';
import { miniBoard, screenHeader } from '../kit';

/** Endgame Lessons: pick a standard mate to practise against the computer. */
export const lessonsScreen: Screen = async (ctx, root) => {
  const list = h('div.position-list');
  for (const l of LESSONS) {
    const done = !!ctx.progress.learn[l.id];
    list.append(
      h(
        'button.position-item',
        { onclick: () => ctx.go({ name: 'game', positionId: l.id }) },
        miniBoard(l.fen, l.fen.split(' ')[1] === 'w' ? 'white' : 'black'),
        h('span.grow', null, h('strong', null, done ? `✓ ${l.title}` : l.title), h('span.desc', null, l.goal)),
        h('span.chip', { class: l.tier }, TIER_LABEL[l.tier]),
      ),
    );
  }
  root.append(
    screenHeader(ctx, GAMES.lessons.name, 'Learn each mate, then win it for real', undefined, { family: 'learn', back: { name: 'play' }, backLabel: 'Back to Play' }),
    list,
  );
  return {};
};
