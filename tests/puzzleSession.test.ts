import { describe, expect, it } from 'vitest';
import { explain, hintFor } from '../src/game/explain';
import { newPuzzleState, PuzzleSession } from '../src/game/puzzleSession';
import type { Puzzle } from '../src/game/types';

const promo: Puzzle = {
  id: 't-promo', fen: 'k7/2P5/1K6/8/8/8/8/8 w - - 0 1', line: ['c7c8q'], n: 1, tier: 'easy', rating: 700, themes: [],
};
const philidor: Puzzle = {
  id: 't-phil', fen: '5r1k/6pp/7N/3Q4/8/8/8/6K1 w - - 0 1', line: ['d5g8', 'f8g8', 'h6f7'], n: 2, tier: 'medium', rating: 1100,
  themes: ['smotheredMate'],
};

const session = (p: Puzzle) => new PuzzleSession(p, newPuzzleState(p, 'practice'));

describe('PuzzleSession', () => {
  it('accepts an alternative correct mate (rook promotion) — never marks a correct move wrong', () => {
    const s = session(promo);
    const v = s.tryMove('c7c8r');
    expect(v.kind).toBe('mate');
    expect(s.state.status).toBe('solved');
    expect(s.firstTry()).toBe(true);
  });

  it('rejects a non-mating move gently and keeps the position', () => {
    const s = session(promo);
    expect(s.tryMove('b6a6').kind).toBe('wrong');
    expect(s.state.played).toEqual([]);
    expect(s.state.mistakes).toBe(1);
    expect(s.tryMove('c7c8q').kind).toBe('mate');
    expect(s.firstTry()).toBe(false);
  });

  it('plays the defender reply automatically in a mate in 2', () => {
    const s = session(philidor);
    const v = s.tryMove('d5g8');
    expect(v.kind).toBe('good');
    if (v.kind === 'good') expect(v.reply).toBe('f8g8');
    expect(s.movesLeft()).toBe(1);
    expect(s.tryMove('h6f7').kind).toBe('mate');
  });

  it('rejects a first move that allows escape', () => {
    const s = session(philidor);
    expect(s.tryMove('h6f7').kind).toBe('wrong'); // Nf7+ Rxf7 — no mate in time
  });

  it('gives gradual hints: piece, idea, then the move', () => {
    const s = session(philidor);
    expect(s.nextHint(false).level).toBe(1);
    expect(s.nextHint(false).level).toBe(2);
    const last = s.nextHint(false);
    expect(last.level).toBe(3);
    expect(hintFor(philidor.fen, last.move, 3).text).toBe('Play Qg8+.');
    expect(hintFor(philidor.fen, last.move, 1).text).toContain('queen on d5');
  });

  it('showing the move (hint 3) means it no longer counts as first try', () => {
    const s = session(promo);
    s.nextHint(true);
    s.tryMove('c7c8q');
    expect(s.firstTry()).toBe(false);
  });

  it('reveal plays out the full solution', () => {
    const s = session(philidor);
    s.reveal();
    expect(s.state.played).toEqual(['d5g8', 'f8g8', 'h6f7']);
    expect(s.state.status).toBe('revealed');
  });

  it('resumes from serialized state', () => {
    const a = session(philidor);
    a.tryMove('d5g8');
    const b = new PuzzleSession(philidor, JSON.parse(JSON.stringify(a.state)));
    expect(b.fen()).toBe(a.fen());
    expect(b.tryMove('h6f7').kind).toBe('mate');
  });

  it('explains a forced defence honestly', () => {
    const ex = explain(philidor, philidor.line, true);
    expect(ex.line).toBe('1. Qg8+ Rxg8 2. Nf7#');
    expect(ex.defence).toContain('forced');
  });
});
