import { Chess } from 'chess.js';
import { playUci } from './chessUtil';
import { MateSolver } from './mateSolver';
import type { Puzzle } from './types';

/**
 * One puzzle attempt, as plain serializable state so it can be autosaved after every
 * move and resumed exactly when the popup is reopened.
 */
export interface PuzzleState {
  puzzleId: string;
  mode: 'practice' | 'daily' | 'rush' | 'retry';
  /** Moves played so far from the puzzle FEN (solver, defender, …). */
  played: string[];
  status: 'playing' | 'solved' | 'revealed';
  /** Wrong tries on this puzzle (0 at the end = solved first try). */
  mistakes: number;
  hintLevel: 0 | 1 | 2 | 3;
  /** The move the current hints are about (kept stable across hint levels). */
  hintMove?: string;
  /** Set once the result has been written to progress (so a resume never double-counts). */
  recorded?: boolean;
  /** Highest hint level used (level 3 = the move was shown, so it doesn't count as first try). */
  maxHint?: number;
}

export type MoveVerdict =
  | { kind: 'illegal' }
  | { kind: 'wrong'; san: string }
  | { kind: 'mate'; san: string }
  | { kind: 'good'; san: string; reply: string; replySan: string };

export function newPuzzleState(p: Puzzle, mode: PuzzleState['mode']): PuzzleState {
  return { puzzleId: p.id, mode, played: [], status: 'playing', mistakes: 0, hintLevel: 0 };
}

export class PuzzleSession {
  private solver = new MateSolver(1_500_000);

  constructor(readonly puzzle: Puzzle, public state: PuzzleState) {}

  /** Current position (after all played moves). */
  fen(): string {
    return this.fenAt(this.state.played.length);
  }

  /** Position after the first `ply` played moves. */
  fenAt(ply: number): string {
    const c = new Chess(this.puzzle.fen);
    for (const u of this.state.played.slice(0, ply)) playUci(c, u);
    return c.fen();
  }

  /** Solved on the first attempt, without being shown the move. */
  firstTry(): boolean {
    return this.state.status === 'solved' && this.state.mistakes === 0 && (this.state.maxHint ?? 0) < 3;
  }

  lastMove(): string | undefined {
    return this.state.played.length ? this.state.played[this.state.played.length - 1] : this.puzzle.last;
  }

  solverColor(): 'white' | 'black' {
    return this.puzzle.fen.split(' ')[1] === 'w' ? 'white' : 'black';
  }

  /** How many of the solver's moves remain, including the next one. */
  movesLeft(): number {
    return this.puzzle.n - Math.floor(this.state.played.length / 2);
  }

  /** True while the game so far matches the reference line. */
  private onReferenceLine(): boolean {
    return this.state.played.every((u, i) => this.puzzle.line[i] === u);
  }

  /**
   * Judge the solver's move. Any move that keeps a forced mate within the remaining
   * moves is accepted — not just the stored line.
   */
  tryMove(uci: string): MoveVerdict {
    if (this.state.status !== 'playing') return { kind: 'illegal' };
    const fen = this.fen();
    const chess = new Chess(fen);
    const m = playUci(chess, uci);
    if (!m) return { kind: 'illegal' };
    const uciNorm = m.from + m.to + (m.promotion ?? '');
    const left = this.movesLeft();

    if (chess.isCheckmate()) {
      this.state.played.push(uciNorm);
      this.state.status = 'solved';
      this.state.hintLevel = 0;
      return { kind: 'mate', san: m.san };
    }

    let keepsMate = false;
    if (left > 1) {
      const onLine = this.onReferenceLine() && this.puzzle.line[this.state.played.length] === uciNorm;
      try {
        keepsMate = this.solver.defenderIsLost(chess.fen(), left - 1);
      } catch {
        // Search budget exceeded (very rare): fall back to the verified reference line.
        keepsMate = onLine;
      }
    }
    if (!keepsMate) {
      this.state.mistakes += 1;
      return { kind: 'wrong', san: m.san };
    }

    const reply = this.chooseReply(chess.fen(), left - 1, uciNorm);
    this.state.played.push(uciNorm);
    const replyMove = playUci(chess, reply)!;
    this.state.played.push(reply);
    this.state.hintLevel = 0;
    this.state.hintMove = undefined;
    return { kind: 'good', san: m.san, reply, replySan: replyMove.san };
  }

  /** The defender's reply: the most resilient defence, preferring the reference line. */
  private chooseReply(fen: string, left: number, justPlayed: string): string {
    const idx = this.state.played.length + 1;
    const refReply = this.onReferenceLine() && this.puzzle.line[idx - 1] === justPlayed ? this.puzzle.line[idx] : undefined;
    let best: { uci: string }[] = [];
    try {
      best = this.solver.bestDefences(fen, left);
    } catch {
      /* fall through to reference / any legal move */
    }
    if (refReply && (!best.length || best.some((b) => b.uci === refReply))) return refReply;
    if (best.length) return best[0].uci;
    return refReply ?? new Chess(fen).moves({ verbose: true })[0].lan;
  }

  /** A winning move from the current position (reference line when still on it). */
  solutionMove(): string {
    if (this.onReferenceLine()) return this.puzzle.line[this.state.played.length];
    const w = this.solver.winningMoves(this.fen(), this.movesLeft());
    return w[0] ?? this.puzzle.line[this.state.played.length];
  }

  /** Advance the hint level (instant style jumps straight to the move). */
  nextHint(instant: boolean): { level: 1 | 2 | 3; move: string } {
    const move = this.state.hintMove ?? this.solutionMove();
    this.state.hintMove = move;
    const level = (instant ? 3 : Math.min(3, this.state.hintLevel + 1)) as 1 | 2 | 3;
    this.state.hintLevel = level;
    this.state.maxHint = Math.max(this.state.maxHint ?? 0, level);
    return { level, move };
  }

  /** Give up: play out the rest of the solution on the board. */
  reveal(): string[] {
    const rest: string[] = [];
    while (this.state.status === 'playing') {
      const mv = this.solutionMove();
      const v = this.tryMove(mv);
      if (v.kind === 'good') rest.push(mv, v.reply);
      else if (v.kind === 'mate') rest.push(mv);
      else break;
    }
    this.state.status = 'revealed';
    this.state.mistakes = Math.max(1, this.state.mistakes);
    return rest;
  }

  /** Back to the start position, keeping the mistake count (first-try accuracy stays honest). */
  reset(): void {
    this.state.played = [];
    this.state.status = 'playing';
    this.state.hintLevel = 0;
    this.state.hintMove = undefined;
  }
}
