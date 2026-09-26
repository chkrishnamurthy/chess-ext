import { Chessground } from '@lichess-org/chessground';
import type { Api } from '@lichess-org/chessground/api';
import type { Config } from '@lichess-org/chessground/config';
import type { DrawShape } from '@lichess-org/chessground/draw';
import type { Key } from '@lichess-org/chessground/types';
import { Chess, type Square } from 'chess.js';
import { prefersReducedMotion, type Settings } from '../storage/settings';
import { h } from './dom';

export type Color = 'white' | 'black';

export interface BoardPosition {
  fen: string;
  orientation: Color;
  /** Side the user may move (only when it's that side's turn), or null for view-only. */
  movable: Color | null;
  lastMove?: string;
}

const ROLE_OF: Record<string, 'queen' | 'rook' | 'bishop' | 'knight'> = { q: 'queen', r: 'rook', b: 'bishop', n: 'knight' };

/**
 * Chessground board driven by chess.js legal moves, with promotion picker,
 * feedback flashes, hint arrows and keyboard (typed-move) input.
 */
export class Board {
  readonly el: HTMLElement;
  private cg: Api;
  private pos?: BoardPosition;
  private promo?: HTMLElement;
  private kbd: HTMLInputElement;
  /** Highlights that stay until the next position (the last move's landing square). */
  private baseHighlight = new Map<Key, string>();
  onMove: (uci: string) => void = () => {};
  /** Set when the user flips the board with the in-board button; persists until the next puzzle/game. */
  flipped = false;

  constructor(host: HTMLElement, private settings: Settings) {
    const wrap = h('div.cb-board-wrap');
    const boardEl = h('div.cb-board');
    this.kbd = h('input.kbd-input', {
      type: 'text',
      placeholder: 'Type a move (e.g. Qh5 or e2e4) and press Enter',
      'aria-label': 'Type a move',
      autocomplete: 'off',
      spellcheck: false,
      onkeydown: (e: KeyboardEvent) => {
        if (e.key === 'Enter') this.submitTyped();
      },
    });
    wrap.append(boardEl);
    host.append(wrap, this.kbd);
    this.el = wrap;
    this.cg = Chessground(boardEl, this.baseConfig());
  }

  private baseConfig(): Config {
    const s = this.settings;
    return {
      addDimensionsCssVarsTo: this.el,
      coordinates: s.coords,
      animation: { enabled: !prefersReducedMotion(s), duration: 180 },
      highlight: { lastMove: s.lastMove, check: true },
      draggable: { enabled: s.moveInput !== 'click', showGhost: true },
      selectable: { enabled: s.moveInput !== 'drag' },
      premovable: { enabled: false },
      drawable: { enabled: true, visible: true },
      movable: {
        free: false,
        showDests: s.legalDots,
        events: { after: (orig, dest) => void this.handleUserMove(orig, dest) },
      },
    };
  }

  applySettings(s: Settings): void {
    this.settings = s;
    this.cg.set(this.baseConfig());
    if (this.pos) this.set(this.pos);
  }

  /** Show a position. `animate: false` for brand-new positions (no sliding from the old one). */
  set(p: BoardPosition, animate = true): void {
    if (!animate) this.cg.set({ animation: { enabled: false } });
    this.pos = p;
    this.hidePromotion();
    const chess = new Chess(p.fen);
    const turn: Color = chess.turn() === 'w' ? 'white' : 'black';
    const dest = p.lastMove?.slice(2, 4) as Key | undefined;
    this.baseHighlight = new Map(dest && this.settings.lastMove ? [[dest, 'last-dest']] : []);
    const canMove = p.movable === turn;
    const orientation = this.flipped ? (p.orientation === 'white' ? 'black' : 'white') : p.orientation;
    this.cg.set({
      fen: p.fen,
      orientation,
      turnColor: turn,
      check: chess.inCheck() ? turn : false,
      lastMove: p.lastMove ? ([p.lastMove.slice(0, 2), p.lastMove.slice(2, 4)] as Key[]) : undefined,
      highlight: { custom: this.baseHighlight },
      movable: { color: canMove ? turn : undefined, dests: canMove ? dests(chess) : new Map() },
    });
    this.cg.setAutoShapes([]);
    this.kbd.disabled = !canMove;
    if (!animate) this.cg.set({ animation: { enabled: !prefersReducedMotion(this.settings) } });
  }

  flip(): void {
    this.flipped = !this.flipped;
    this.cg.toggleOrientation();
  }

  resetFlip(): void {
    this.flipped = false;
  }

  /** Flash squares green/red (blue/orange in colorblind mode). */
  flash(squares: string[], kind: 'good' | 'bad', ms = 900): void {
    const map = new Map(this.baseHighlight);
    for (const s of squares) map.set(s as Key, `flash-${kind}`);
    this.cg.set({ highlight: { custom: map } });
    const base = this.baseHighlight;
    // Put the last-move ring back, unless a newer position has replaced it meanwhile.
    setTimeout(() => this.baseHighlight === base && this.cg.set({ highlight: { custom: base } }), ms);
  }

  showHint(squares: string[], arrow?: [string, string]): void {
    const shapes: DrawShape[] = squares.map((s) => ({ orig: s as Key, brush: 'blue' }));
    if (arrow) shapes.push({ orig: arrow[0] as Key, dest: arrow[1] as Key, brush: 'green' });
    this.cg.setAutoShapes(shapes);
  }

  clearHint(): void {
    this.cg.setAutoShapes([]);
  }

  /** Lock the board (e.g. while the bot is thinking). */
  lock(): void {
    this.cg.set({ movable: { color: undefined, dests: new Map() } });
    this.kbd.disabled = true;
  }

  destroy(): void {
    this.cg.destroy();
  }

  private async handleUserMove(orig: Key, dest: Key): Promise<void> {
    if (!this.pos) return;
    const chess = new Chess(this.pos.fen);
    const piece = chess.get(orig as Square);
    let promotion = '';
    if (piece?.type === 'p' && (dest[1] === '8' || dest[1] === '1')) {
      promotion = this.settings.autoQueen ? 'q' : await this.askPromotion(dest, piece.color === 'w' ? 'white' : 'black');
      if (!promotion) {
        this.set(this.pos); // cancelled: put the pawn back
        return;
      }
    }
    this.onMove(orig + dest + promotion);
  }

  private askPromotion(dest: string, color: Color): Promise<string> {
    return new Promise((resolve) => {
      this.hidePromotion();
      const choose = (r: string) => {
        this.hidePromotion();
        resolve(r);
      };
      const box = h(
        'div.promo',
        { role: 'dialog', 'aria-label': 'Choose promotion piece' },
        h('div.promo-title', null, `Promote ${dest} to…`),
        h(
          'div.promo-row.cg-wrap',
          null,
          ['q', 'r', 'b', 'n'].map((r) =>
            h('button.promo-piece', { 'aria-label': ROLE_OF[r], title: ROLE_OF[r], onclick: () => choose(r) }, pieceEl(ROLE_OF[r], color)),
          ),
        ),
        h('button.link', { onclick: () => choose('') }, 'Cancel'),
      );
      this.promo = box;
      this.el.append(box);
      (box.querySelector('button') as HTMLButtonElement).focus();
    });
  }

  private hidePromotion(): void {
    this.promo?.remove();
    this.promo = undefined;
  }

  private submitTyped(): void {
    if (!this.pos || this.kbd.disabled) return;
    const text = this.kbd.value.trim();
    if (!text) return;
    const chess = new Chess(this.pos.fen);
    let m;
    try {
      m = chess.move(text);
    } catch {
      try {
        m = chess.move({ from: text.slice(0, 2), to: text.slice(2, 4), promotion: text[4] || undefined });
      } catch {
        m = null;
      }
    }
    if (!m) {
      this.kbd.classList.add('shake');
      setTimeout(() => this.kbd.classList.remove('shake'), 400);
      return;
    }
    this.kbd.value = '';
    this.onMove(m.from + m.to + (m.promotion ?? ''));
  }
}

export function dests(chess: Chess): Map<Key, Key[]> {
  const out = new Map<Key, Key[]>();
  for (const m of chess.moves({ verbose: true })) {
    const list = out.get(m.from as Key) ?? [];
    if (!list.includes(m.to as Key)) list.push(m.to as Key);
    out.set(m.from as Key, list);
  }
  return out;
}

/** A <piece> element styled by the active piece set (usable outside the board). */
export function pieceEl(role: string, color: Color): HTMLElement {
  const el = document.createElement('piece');
  el.className = `${role} ${color}`;
  return el;
}
