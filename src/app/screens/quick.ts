import { QUICK_LEVEL_NAME } from '../../engine/engine';
import { KEYS, load, save } from '../../storage/store';
import { clear, h } from '../../ui/dom';
import { icon } from '../../ui/icons';
import { GAMES } from '../catalog';
import type { Screen } from '../context';
import { screenHeader } from '../kit';

type ColorChoice = 'w' | 'b' | 'r';
interface Setup {
  color: ColorChoice;
  level: number;
}

/** Quick Game setup: pick a colour and a level, then play a normal game from the start. */
export const quickScreen: Screen = async (ctx, root) => {
  const setup = await load<Setup>(KEYS.quick, { color: 'w', level: 3 });
  const colors = h('div.seg', { role: 'group', 'aria-label': 'Your colour' });
  const levels = h('div.level-grid', { role: 'group', 'aria-label': 'Computer level' });
  const levelHint = h('p.level-hint');

  function render() {
    clear(colors);
    for (const [c, label] of [['w', 'White'], ['b', 'Black'], ['r', 'Random']] as const) {
      colors.append(
        h('button', { 'aria-pressed': String(setup.color === c), onclick: () => ((setup.color = c), render()) }, label),
      );
    }
    clear(levels);
    QUICK_LEVEL_NAME.forEach((name, i) => {
      const n = i + 1;
      levels.append(
        h(
          'button.level-btn',
          { 'aria-pressed': String(setup.level === n), onclick: () => ((setup.level = n), render()) },
          h('b', null, String(n)),
          h('span', null, name),
        ),
      );
    });
    levelHint.textContent = `Level ${setup.level}: ${QUICK_LEVEL_NAME[setup.level - 1]}. ${setup.level <= 2 ? 'Gentle and forgiving. Good for learning.' : setup.level <= 4 ? 'Makes mistakes you can punish.' : setup.level <= 6 ? 'Plays solid chess. Expect a fight.' : 'Very strong. Do not hang pieces.'}`;
  }
  render();

  root.append(
    screenHeader(ctx, GAMES.quick.name, 'A normal game from the starting position', undefined, { family: 'bot', back: { name: 'play' }, backLabel: 'Back to Play' }),
    h('div.section-title', null, 'You play'),
    colors,
    h('div.section-title', null, 'Computer level'),
    levels,
    levelHint,
    h(
      'button.hero-cta',
      {
        onclick: async () => {
          await save(KEYS.quick, setup);
          const color = setup.color === 'r' ? (Math.random() < 0.5 ? 'w' : 'b') : setup.color;
          ctx.go({ name: 'game', quick: { color, level: setup.level } });
        },
      },
      'Start game',
      icon('play', 15),
    ),
    h('p.privacy', null, icon('lock', 13), 'Plays on this device. Saved after every move.'),
  );
  return {};
};
