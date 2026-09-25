import { Chess, type Move } from 'chess.js';

export type Uci = string;

export function moveToUci(m: Pick<Move, 'from' | 'to' | 'promotion'>): Uci {
  return m.from + m.to + (m.promotion ?? '');
}

export function uciToMove(uci: Uci): { from: string; to: string; promotion?: string } {
  return { from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.length > 4 ? uci[4] : undefined };
}

/** Apply a UCI move to a chess.js game; returns the Move, or null if illegal. */
export function playUci(chess: Chess, uci: Uci): Move | null {
  try {
    return chess.move(uciToMove(uci));
  } catch {
    return null;
  }
}

/** SAN for a UCI move in `fen` (without mutating anything). */
export function uciToSan(fen: string, uci: Uci): string {
  const c = new Chess(fen);
  return playUci(c, uci)?.san ?? uci;
}

export const PIECE_NAMES: Record<string, string> = {
  p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king',
};
