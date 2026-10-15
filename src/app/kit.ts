import { Chessground } from '@lichess-org/chessground';
import { KEYS, load, save } from '../storage/store';
import { h } from '../ui/dom';
import { icon, type IconName } from '../ui/icons';
import { FAMILY_LABEL, GAMES, type Family, type GameId, type GameInfo } from './catalog';
import type { Ctx, Route } from './context';

/** Coloured tag that says what kind of game this is: Puzzle, Timed, Vs computer, Learn. */
export function familyTag(family: Family): HTMLElement {
  return h('span.fam', { class: family }, FAMILY_LABEL[family]);
}

/**
 * Screen title bar: back arrow, title/subtitle, optional trailing element.
 * `family` adds the game-type tag above the title; `back` sets where the arrow goes
 * (the hub the game belongs to, Today by default).
 */
export function screenHeader(
  ctx: Ctx,
  title: string,
  sub?: string | Node,
  right?: Node,
  opts: { family?: Family; back?: Route; backLabel?: string } = {},
): HTMLElement {
  const label = opts.backLabel ?? 'Back to Today';
  return h(
    'div.screen-head',
    null,
    h('button.back', { onclick: () => ctx.go(opts.back ?? { name: 'home' }), 'aria-label': label, title: label }, icon('back', 18)),
    h('div.head-text', null, opts.family ? familyTag(opts.family) : null, h('h1', null, title), sub ? h('div.head-sub', null, sub) : null),
    right ?? null,
  );
}

/** A game as a tappable row: icon, name, one-line description, family tag and time. */
export function gameRow(game: GameInfo, onclick: () => void, sub?: string): HTMLElement {
  return h(
    'button.game-row',
    { class: game.family, onclick },
    h('span.game-ic', null, icon(game.icon, 20)),
    h('span.game-text', null, h('strong', null, game.name), h('span', null, sub ?? game.short)),
    h('span.game-meta', null, familyTag(game.family), h('em', null, game.time)),
  );
}

const SHEETED: GameId[] = ['daily', 'm1', 'm2', 'm3', 'retry', 'streak', 'coords'];

/**
 * Opens a game. The first time, a short sheet explains the rule, length and goal;
 * after that it is one tap. Rush, Win the Endgame and Quick Game already open on their own intro or setup.
 */
export async function launch(ctx: Ctx, id: GameId, route: Route): Promise<void> {
  const seen = await load<Partial<Record<GameId, true>>>(KEYS.seen, {});
  if (!SHEETED.includes(id) || seen[id]) return ctx.go(route);
  const g = GAMES[id];
  const opener = document.activeElement as HTMLElement | null;
  const close = () => {
    sheet.remove();
    document.removeEventListener('keydown', onKey);
    opener?.focus?.(); // hand focus back to what opened the sheet
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'Tab') {
      // Keep Tab inside the sheet: it is modal, so the page behind must not take focus.
      const items = [...sheet.querySelectorAll<HTMLElement>('button:not([disabled])')];
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      const outside = !sheet.contains(active);
      if (e.shiftKey && (active === first || outside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || outside)) {
        e.preventDefault();
        first.focus();
      }
    }
  };
  const start = h(
    'button.btn.primary',
    {
      onclick: () => {
        close();
        void save(KEYS.seen, { ...seen, [id]: true });
        ctx.go(route);
      },
    },
    'Start',
    icon('play', 14),
  );
  const sheet = h(
    'div.sheet-scrim',
    { onclick: (e: Event) => e.target === sheet && close() },
    h(
      'div.sheet',
      { role: 'dialog', 'aria-modal': 'true', 'aria-label': g.name },
      familyTag(g.family),
      h('h2', null, g.name),
      h('p', null, g.rule),
      h('div.sheet-facts', null, h('div', null, h('small', null, 'Time'), h('b', null, g.time)), h('div', null, h('small', null, 'Goal'), h('b', null, g.goal)), h('div', null, h('small', null, 'Clock'), h('b', null, g.family === 'timed' ? 'Yes' : 'No'))),
      start,
      h('button.btn.ghost', { onclick: close }, 'Not now'),
    ),
  );
  document.addEventListener('keydown', onKey);
  document.body.append(sheet);
  start.focus();
}

/** Button with an icon above a short label (used in the board toolbars). */
export function toolBtn(name: IconName, label: string, onclick: () => void, extra: Record<string, unknown> = {}): HTMLButtonElement {
  return h('button.tool', { onclick, title: label, ...extra }, icon(name, 18), h('span', null, label));
}

/** Small read-only board thumbnail. */
export function miniBoard(fen: string, orientation: 'white' | 'black', lastMove?: string): HTMLElement {
  const el = h('div.mini-board');
  const inner = h('div.mini-cg');
  el.append(inner);
  Chessground(inner, {
    fen,
    orientation,
    viewOnly: true,
    coordinates: false,
    animation: { enabled: false },
    lastMove: lastMove ? ([lastMove.slice(0, 2), lastMove.slice(2, 4)] as never) : undefined,
    drawable: { enabled: false, visible: false },
  });
  return el;
}

/** Circular progress ring (SVG). */
export function ring(value: number, max: number, label: string | Node, size = 64): HTMLElement {
  const r = size / 2 - 5;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, max ? value / max : 0));
  const wrap = h('div.ring', { style: `width:${size}px;height:${size}px`, role: 'img', 'aria-label': `${value} of ${max}` });
  wrap.innerHTML = `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-bg"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-fg" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct)}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg>`;
  wrap.append(h('div.ring-label', null, label));
  return wrap;
}

/** A short confetti burst for a solve (skipped when reduced motion is on). */
export function celebrate(): void {
  if (document.documentElement.classList.contains('reduce-motion')) return;
  const host = h('div.confetti', { 'aria-hidden': 'true' });
  const colors = ['#34c16f', '#ffc53d', '#5b8def', '#ff7a59', '#b07cff'];
  for (let i = 0; i < 28; i++) {
    const s = h('i');
    s.style.left = `${50 + (Math.random() - 0.5) * 30}%`;
    s.style.background = colors[i % colors.length];
    s.style.setProperty('--dx', `${(Math.random() - 0.5) * 320}px`);
    s.style.setProperty('--dy', `${-120 - Math.random() * 200}px`);
    s.style.setProperty('--r', `${Math.random() * 720 - 360}deg`);
    s.style.animationDelay = `${Math.random() * 80}ms`;
    host.append(s);
  }
  document.body.append(host);
  setTimeout(() => host.remove(), 1400);
}

export function greeting(d = new Date()): string {
  const hr = d.getHours();
  return hr < 5 ? 'Late-night chess' : hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
}
