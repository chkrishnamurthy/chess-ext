import { Chess } from 'chess.js';
import { hintFor } from '../game/explain';
import { PuzzleSession, type MoveVerdict } from '../game/puzzleSession';
import { prefersReducedMotion, type Settings } from '../storage/settings';
import { Board } from '../ui/board';
import { announce, h } from '../ui/dom';
import { play } from '../ui/sound';

const PRAISE = ['Nicely done!', 'Brilliant!', 'Clean finish!', 'That’s the one!', 'Sharp eyes!', 'Checkmate — well played!'];
const ALMOST = ['Almost — try again.', 'Not quite — look for something more forcing.', 'Close! There’s a stronger move.', 'Good try — the king still escapes. Try again.'];

export const pickOne = (list: string[]) => list[Math.floor(Math.random() * list.length)];

export interface PuzzleViewEvents {
  /** Called after every state change worth autosaving. */
  onChange(): void;
  onSolved(session: PuzzleSession): void;
  onWrong?(session: PuzzleSession, verdict: MoveVerdict): void;
}

/**
 * Board + feedback line for a puzzle session. Handles the move → verdict → animation
 * loop, gradual hints and resets. Used by the Puzzle and Rush screens.
 */
export class PuzzleView {
  readonly board: Board;
  readonly feedback = h('div.feedback', { 'aria-live': 'polite' });
  session?: PuzzleSession;
  /** In rush mode a wrong move ends the puzzle instead of allowing a retry. */
  rush = false;
  private busy = false;
  private timers: number[] = [];

  constructor(host: HTMLElement, private settings: () => Settings, private ev: PuzzleViewEvents) {
    this.board = new Board(host, settings());
    this.board.onMove = (uci) => this.userMove(uci);
  }

  orientation(): 'white' | 'black' {
    if (!this.session) return 'white';
    return this.settings().orientation === 'white' ? 'white' : this.session.solverColor();
  }

  load(session: PuzzleSession): void {
    this.clearTimers();
    this.session = session;
    this.busy = false;
    this.board.resetFlip();
    this.setFeedback('', 'info');
    this.render(false);
  }

  render(animate = true): void {
    const s = this.session;
    if (!s) return;
    const playing = s.state.status === 'playing';
    this.board.set({
      fen: s.fen(),
      orientation: this.orientation(),
      movable: playing ? s.solverColor() : null,
      lastMove: s.lastMove(),
    }, animate);
  }

  private delay(): number {
    return prefersReducedMotion(this.settings()) ? 150 : 450;
  }

  private userMove(uci: string): void {
    const s = this.session;
    if (!s || this.busy) return;
    const before = s.fen();
    const verdict = s.tryMove(uci);
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);

    switch (verdict.kind) {
      case 'illegal':
        this.render();
        return;
      case 'wrong': {
        play('wrong');
        if (this.rush) {
          this.board.set({ fen: afterMove(before, uci), orientation: this.orientation(), movable: null, lastMove: uci });
          this.board.flash([from, to], 'bad');
          this.setFeedback(`${verdict.san} doesn’t force mate.`, 'bad');
          this.ev.onWrong?.(s, verdict);
          return;
        }
        this.render();
        this.board.flash([from, to], 'bad');
        this.setFeedback(`${verdict.san}? ${pickOne(ALMOST)}`, 'bad');
        this.ev.onWrong?.(s, verdict);
        this.ev.onChange();
        return;
      }
      case 'mate': {
        play('solve');
        this.render();
        this.board.flash([from, to], 'good', 1400);
        this.setFeedback(`✅ ${verdict.san} — ${pickOne(PRAISE)}`, 'good');
        this.ev.onChange();
        this.ev.onSolved(s);
        return;
      }
      case 'good': {
        play('good');
        this.busy = true;
        const afterUser = s.fenAt(s.state.played.length - 1);
        this.board.set({ fen: afterUser, orientation: this.orientation(), movable: null, lastMove: uci });
        this.board.flash([from, to], 'good');
        this.setFeedback(`✓ ${verdict.san} — good! Keep going.`, 'good');
        this.ev.onChange();
        this.timers.push(
          window.setTimeout(() => {
            this.busy = false;
            play(verdict.replySan.includes('x') ? 'capture' : 'move');
            this.render();
            this.setFeedback(`They reply ${verdict.replySan}. ${s.movesLeft() === 1 ? 'Now finish it!' : 'Your move.'}`, 'info');
          }, this.delay()),
        );
        return;
      }
    }
  }

  /** Show the next hint level. */
  hint(): void {
    const s = this.session;
    if (!s || s.state.status !== 'playing' || this.busy) return;
    const { level, move } = s.nextHint(this.settings().hintStyle === 'instant');
    const hnt = hintFor(s.fen(), move, level);
    this.board.showHint(level === 1 ? [hnt.squares[0]] : level === 2 ? hnt.squares : [], hnt.arrow);
    this.setFeedback(`💡 ${hnt.text}`, 'info');
    this.ev.onChange();
  }

  reset(): void {
    if (!this.session || this.busy) return;
    this.session.reset();
    this.clearTimers();
    this.render();
    this.setFeedback('Back to the start position.', 'info');
    this.ev.onChange();
  }

  /** Give up and play out the solution. */
  reveal(): void {
    const s = this.session;
    if (!s || s.state.status !== 'playing') return;
    this.clearTimers();
    this.busy = false;
    s.reveal();
    this.render();
    this.setFeedback('Here’s the solution. You’ll get another go at this one later.', 'info');
    this.ev.onChange();
  }

  setFeedback(text: string, kind: 'good' | 'bad' | 'info'): void {
    this.feedback.textContent = text;
    this.feedback.className = `feedback ${kind}`;
    if (text) announce(text);
  }

  applySettings(s: Settings): void {
    this.board.applySettings(s);
    this.render();
  }

  private clearTimers(): void {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }

  destroy(): void {
    this.clearTimers();
    this.board.destroy();
  }
}

function afterMove(fen: string, uci: string): string {
  const c = new Chess(fen);
  try {
    c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  } catch {
    return fen;
  }
  return c.fen();
}
