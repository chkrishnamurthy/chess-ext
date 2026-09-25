import { describe, expect, it } from 'vitest';
import { GameSession, newGameState } from '../src/game/gameSession';

/** chess.js edge cases the plan calls out (§6, §14), exercised through GameSession. */
const game = (fen: string) => new GameSession(newGameState('t', fen, 'beginner'));

describe('game rules via GameSession', () => {
  it('castling', () => {
    const g = game('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
    expect(g.play('e1g1')).toBe('O-O');
    expect(g.play('e8c8')).toBe('O-O-O');
  });

  it('en passant', () => {
    const g = game('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2');
    expect(g.play('e5d6')).toBe('exd6');
  });

  it('underpromotion', () => {
    const g = game('8/4P3/8/8/8/k7/8/K7 w - - 0 1');
    expect(g.play('e7e8n')).toBe('e8=N');
  });

  it('checkmate = win for the user', () => {
    const g = game('6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1');
    g.play('d1d8');
    expect(g.state.result).toEqual({ outcome: 'win', reason: 'checkmate' });
  });

  it('stalemate = draw', () => {
    const g = game('k7/8/2Q5/8/8/8/8/K7 w - - 0 1');
    g.play('c6b6');
    expect(g.state.result).toEqual({ outcome: 'draw', reason: 'stalemate' });
  });

  it('insufficient material = draw', () => {
    const g = game('k7/8/8/8/8/8/1r6/K7 w - - 0 1');
    g.play('a1b2');
    expect(g.state.result?.reason).toBe('insufficient');
  });

  it('threefold repetition = draw', () => {
    const g = game('k7/8/8/8/8/8/8/K6R w - - 0 1');
    for (let i = 0; i < 2; i++) {
      g.play('h1h2');
      g.play('a8b8');
      g.play('h2h1');
      g.play('b8a8');
    }
    expect(g.state.result?.reason).toBe('repetition');
  });

  it('50-move rule = draw', () => {
    const g = game('k7/8/8/8/8/8/8/K6R w - - 99 80');
    g.play('h1h2');
    expect(g.state.result?.reason).toBe('fifty-move');
  });

  it('undo takes back the user move and the bot reply', () => {
    const g = game('k7/8/8/8/8/8/8/K6R w - - 0 1');
    g.play('h1h2');
    g.play('a8b8');
    expect(g.undo()).toBe(true);
    expect(g.state.moves).toEqual([]);
    expect(g.isUserTurn()).toBe(true);
  });

  it('resigning cannot be undone', () => {
    const g = game('k7/8/8/8/8/8/8/K6R w - - 0 1');
    g.play('h1h2');
    g.resign();
    expect(g.undo()).toBe(false);
    expect(g.state.result?.outcome).toBe('loss');
  });
});
