import { Chessground } from '@lichess-org/chessground';
import { h } from '../ui/dom';
import { icon, type IconName } from '../ui/icons';
import type { Ctx } from './context';

/** Screen title bar: back arrow, title/subtitle, optional trailing element. */
export function screenHeader(ctx: Ctx, title: string, sub?: string | Node, right?: Node): HTMLElement {
  return h(
    'div.screen-head',
    null,
    h('button.back', { onclick: () => ctx.go({ name: 'home' }), 'aria-label': 'Back to home', title: 'Home' }, icon('back', 18)),
    h('div.head-text', null, h('h1', null, title), sub ? h('div.head-sub', null, sub) : null),
    right ?? null,
  );
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
