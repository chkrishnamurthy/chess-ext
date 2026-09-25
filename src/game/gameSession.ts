import { Chess } from 'chess.js';
import { playUci } from './chessUtil';

export type BotLevel = 'beginner' | 'intermediate';
export type Outcome = 'win' | 'draw' | 'loss';

export interface GameResult {
  outcome: Outcome;
  reason: 'checkmate' | 'stalemate' | 'repetition' | 'fifty-move' | 'insufficient' | 'resigned';
}

/** Serializable game state — autosaved after every move. */
export interface GameState {
  positionId: string;
  startFen: string;
  moves: string[];
  userColor: 'w' | 'b';
  level: BotLevel;
  result?: GameResult;
  startedAt: number;
  recorded?: boolean;
}

export function newGameState(positionId: string, fen: string, level: BotLevel): GameState {
  return { positionId, startFen: fen, moves: [], userColor: fen.split(' ')[1] as 'w' | 'b', level, startedAt: Date.now() };
}

export class GameSession {
  readonly chess: Chess;

  constructor(public state: GameState) {
    this.chess = new Chess(state.startFen);
    for (const u of state.moves) playUci(this.chess, u);
  }

  fen(): string {
    return this.chess.fen();
  }

  isUserTurn(): boolean {
    return !this.state.result && this.chess.turn() === this.state.userColor;
  }

  lastMove(): string | undefined {
    return this.state.moves[this.state.moves.length - 1];
  }

  /** Plays a move for whoever is to move; returns SAN or null if illegal. */
  play(uci: string): string | null {
    if (this.state.result) return null;
    const m = playUci(this.chess, uci);
    if (!m) return null;
    this.state.moves.push(m.from + m.to + (m.promotion ?? ''));
    this.detectEnd();
    return m.san;
  }

  /** Detects checkmate and every draw rule chess.js knows about. */
  detectEnd(): GameResult | undefined {
    const c = this.chess;
    const userToMove = c.turn() === this.state.userColor;
    let r: GameResult | undefined;
    if (c.isCheckmate()) r = { outcome: userToMove ? 'loss' : 'win', reason: 'checkmate' };
    else if (c.isStalemate()) r = { outcome: 'draw', reason: 'stalemate' };
    else if (c.isInsufficientMaterial()) r = { outcome: 'draw', reason: 'insufficient' };
    else if (c.isThreefoldRepetition()) r = { outcome: 'draw', reason: 'repetition' };
    else if (c.isDrawByFiftyMoves()) r = { outcome: 'draw', reason: 'fifty-move' };
    if (r) this.state.result = r;
    return r;
  }

  resign(): GameResult {
    this.state.result = { outcome: 'loss', reason: 'resigned' };
    return this.state.result;
  }

  /** Undo back to the user's previous turn (their move + the bot's reply). */
  undo(): boolean {
    if (this.state.result?.reason === 'resigned' || !this.state.moves.length) return false;
    this.state.result = undefined;
    const n = this.chess.turn() === this.state.userColor ? 2 : 1;
    for (let i = 0; i < n && this.state.moves.length; i++) {
      this.chess.undo();
      this.state.moves.pop();
    }
    return true;
  }

  sanHistory(): string[] {
    return this.chess.history();
  }

  /** FEN after the first `ply` moves (for the post-game review stepper). */
  fenAt(ply: number): string {
    const c = new Chess(this.state.startFen);
    for (const u of this.state.moves.slice(0, ply)) playUci(c, u);
    return c.fen();
  }
}

export const RESULT_TEXT: Record<GameResult['reason'], string> = {
  checkmate: 'Checkmate',
  stalemate: 'Stalemate — careful, the king had no moves but wasn’t in check',
  repetition: 'Draw by threefold repetition',
  'fifty-move': 'Draw by the 50-move rule',
  insufficient: 'Draw — not enough material to mate',
  resigned: 'You resigned',
};
