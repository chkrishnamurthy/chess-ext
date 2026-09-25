import { Chess as Pos, castlingSide, normalizeMove, type Position } from 'chessops/chess';
import { makeFen, parseFen } from 'chessops/fen';
import { kingCastlesTo, makeUci, parseUci, squareRank } from 'chessops/util';
import type { NormalMove } from 'chessops/types';

/**
 * Exact forced-mate search.
 *
 * "Mate in N" = the side to move can force checkmate on its Nth move whatever the
 * defender does. This lets the puzzle checker accept *every* correct move instead of
 * matching a single stored line (trust rule #1: never mark a correct move wrong).
 *
 * Game rules/UI use chess.js; the search uses chessops' bitboards because it needs to
 * generate hundreds of thousands of positions per puzzle and chess.js builds SAN/FEN for
 * every generated move. Moves cross the boundary as standard UCI strings (e1g1 castling).
 */

export type Uci = string;

const PROMOS = ['queen', 'knight', 'rook', 'bishop'] as const;

export function positionFromFen(fen: string): Position {
  return Pos.fromSetup(parseFen(fen).unwrap()).unwrap();
}

/** Standard UCI (e1g1) for a chessops move (which encodes castling as king→rook). */
function toUci(pos: Position, m: NormalMove): Uci {
  const side = castlingSide(pos, m);
  if (side) return makeUci({ from: m.from, to: kingCastlesTo(pos.turn, side) });
  return makeUci(m);
}

function legalMoves(pos: Position): NormalMove[] {
  const out: NormalMove[] = [];
  const ctx = pos.ctx();
  for (const [from, dests] of pos.allDests(ctx)) {
    const piece = pos.board.get(from)!;
    for (const to of dests) {
      const r = squareRank(to);
      if (piece.role === 'pawn' && (r === 0 || r === 7)) {
        for (const promotion of PROMOS) out.push({ from, to, promotion });
      } else out.push({ from, to });
    }
  }
  return out;
}

function key(pos: Position): string {
  return makeFen(pos.toSetup(), { epd: true });
}

interface Child {
  move: NormalMove;
  pos: Position;
  check: boolean;
}

function children(pos: Position): Child[] {
  return legalMoves(pos).map((move) => {
    const p = pos.clone();
    p.play(move);
    return { move, pos: p, check: p.isCheck() };
  });
}

/** Attacker ordering: checks first, then captures/promotions (cheap and very effective for mate search). */
function orderAttack(pos: Position, cs: Child[]): Child[] {
  const score = (c: Child) =>
    (c.check ? 100 : 0) + (pos.board.get(c.move.to) ? 10 : 0) + (c.move.promotion ? 5 : 0);
  return cs.sort((a, b) => score(b) - score(a));
}

export class MateSolver {
  private tt = new Map<string, boolean>();
  nodes = 0;
  /** Hard cap so a pathological position can never lock the UI. */
  constructor(private maxNodes = 3_000_000) {}

  private tick() {
    if (++this.nodes > this.maxNodes) throw new Error('mate search budget exceeded');
  }

  /** Side to move mates in one? Only checking moves can mate. */
  private mateInOne(pos: Position): boolean {
    for (const c of children(pos)) if (c.check && c.pos.isCheckmate()) return true;
    return false;
  }

  /** True if the side to move can force mate within `n` of its own moves. */
  attack(pos: Position, n: number): boolean {
    if (n <= 0) return false;
    this.tick();
    if (n === 1) return this.mateInOne(pos);
    const k = `A${n}${key(pos)}`;
    const hit = this.tt.get(k);
    if (hit !== undefined) return hit;
    let result = false;
    for (const c of orderAttack(pos, children(pos))) {
      if (this.defend(c.pos, n - 1)) {
        result = true;
        break;
      }
    }
    this.tt.set(k, result);
    return result;
  }

  /** Defender to move: true if every reply still loses to mate within `n` attacker moves. */
  defend(pos: Position, n: number): boolean {
    const ctx = pos.ctx();
    if (!pos.hasDests(ctx)) return pos.isCheck(); // checkmate = lost, stalemate = saved
    if (n <= 0) return false;
    this.tick();
    const k = `D${n}${key(pos)}`;
    const hit = this.tt.get(k);
    if (hit !== undefined) return hit;
    let result = true;
    for (const move of legalMoves(pos)) {
      const p = pos.clone();
      p.play(move);
      if (!this.attack(p, n)) {
        result = false;
        break;
      }
    }
    this.tt.set(k, result);
    return result;
  }

  // ---- FEN-level API -------------------------------------------------------------------

  canForceMate(fen: string, n: number): boolean {
    return this.attack(positionFromFen(fen), n);
  }

  /** Defender to move in `fen`: is it lost to mate within n attacker moves? */
  defenderIsLost(fen: string, n: number): boolean {
    return this.defend(positionFromFen(fen), n);
  }

  /** Smallest N ≤ maxN such that the side to move mates in N, or null. */
  mateDistance(fen: string, maxN: number): number | null {
    const pos = positionFromFen(fen);
    for (let n = 1; n <= maxN; n++) if (this.attack(pos, n)) return n;
    return null;
  }

  /** All attacker moves (UCI) that keep a forced mate within `n` attacker moves. */
  winningMoves(fen: string, n: number): Uci[] {
    const pos = positionFromFen(fen);
    const out: Uci[] = [];
    for (const c of orderAttack(pos, children(pos))) {
      const wins = c.check && c.pos.isCheckmate() ? true : n > 1 && this.defend(c.pos, n - 1);
      if (wins) out.push(toUci(pos, c.move));
    }
    return out;
  }

  /** Attacker moves that mate immediately. */
  matingMoves(fen: string): Uci[] {
    const pos = positionFromFen(fen);
    return children(pos)
      .filter((c) => c.check && c.pos.isCheckmate())
      .map((c) => toUci(pos, c.move));
  }

  /**
   * Defender to move, already lost within `n`. Returns the replies that delay mate the
   * longest ("most resilient defence") and how many attacker moves remain after each.
   */
  bestDefences(fen: string, n: number): { uci: Uci; mateIn: number }[] {
    const pos = positionFromFen(fen);
    let best: { uci: Uci; mateIn: number }[] = [];
    let bestN = 0;
    for (const move of legalMoves(pos)) {
      const p = pos.clone();
      p.play(move);
      let d = n + 1;
      for (let i = 1; i <= n; i++) {
        if (this.attack(p, i)) {
          d = i;
          break;
        }
      }
      if (d > bestN) {
        bestN = d;
        best = [];
      }
      if (d === bestN) best.push({ uci: toUci(pos, move), mateIn: d });
    }
    return best;
  }
}

/** Apply a standard-UCI move to a FEN with chessops; returns the new FEN or null if illegal. */
export function applyUci(fen: string, uci: Uci): string | null {
  const pos = positionFromFen(fen);
  const m = parseUci(uci);
  if (!m || !('from' in m)) return null;
  const move = normalizeMove(pos, m);
  if (!pos.isLegal(move)) return null;
  pos.play(move);
  return makeFen(pos.toSetup());
}
