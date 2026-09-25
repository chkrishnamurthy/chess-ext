import { describe, expect, it } from 'vitest';
import { applyUci, MateSolver } from '../src/game/mateSolver';

describe('MateSolver', () => {
  it('finds a back-rank mate in 1', () => {
    const s = new MateSolver();
    const fen = '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1';
    expect(s.mateDistance(fen, 3)).toBe(1);
    expect(s.winningMoves(fen, 1)).toEqual(['d1d8']);
  });

  it('accepts every mating move (queen and rook promotion both mate)', () => {
    const s = new MateSolver();
    const moves = s.winningMoves('k7/2P5/1K6/8/8/8/8/8 w - - 0 1', 1).sort();
    expect(moves).toEqual(['c7c8q', 'c7c8r']);
  });

  it("finds Philidor's smothered mate in 2 with a unique first move", () => {
    const s = new MateSolver();
    const fen = '5r1k/6pp/7N/3Q4/8/8/8/6K1 w - - 0 1';
    expect(s.mateDistance(fen, 3)).toBe(2);
    expect(s.winningMoves(fen, 2)).toEqual(['d5g8']);
  });

  it('finds a quiet (non-checking) first move', () => {
    const s = new MateSolver();
    expect(s.winningMoves('k7/8/2K5/8/8/8/8/1R6 w - - 0 1', 2)).toEqual(['c6c7']);
  });

  it('treats stalemate as a failed mate attempt', () => {
    const s = new MateSolver();
    // Black to move and stalemated: not a win, even though White is a queen up.
    expect(s.defenderIsLost('k7/8/1QK5/8/8/8/8/8 b - - 0 1', 1)).toBe(false);
  });

  it('reports the most resilient defence', () => {
    const s = new MateSolver();
    const after = applyUci('5r1k/6pp/7N/3Q4/8/8/8/6K1 w - - 0 1', 'd5g8')!;
    const best = s.bestDefences(after, 1);
    expect(best.map((b) => b.uci)).toEqual(['f8g8']);
  });

  it('handles castling in standard UCI form', () => {
    const s = new MateSolver();
    const fen = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1';
    expect(() => s.mateDistance(fen, 1)).not.toThrow();
    expect(applyUci(fen, 'e1g1')).toContain('R4RK1');
  });

  it('handles en passant', () => {
    const fen = '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2';
    expect(applyUci(fen, 'e5d6')?.split(' ')[0]).toBe('4k3/8/3P4/8/8/8/8/4K3');
  });
});
