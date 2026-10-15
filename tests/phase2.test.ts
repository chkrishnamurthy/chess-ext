import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { randomSquare, squareAt } from '../src/game/coords';
import { START_FEN, GameSession, newQuickState } from '../src/game/gameSession';
import { getPuzzle, streakSequence } from '../src/game/puzzles';
import { QUICK_LEVELS, levelConfig } from '../src/engine/engine';
import { emptyProgress, recordCoords, recordGame, recordStreak } from '../src/progress/progress';

describe('squareAt', () => {
  it('maps points to squares for White at the bottom', () => {
    expect(squareAt(1, 1, 80, 'white')).toBe('a8');
    expect(squareAt(79, 79, 80, 'white')).toBe('h1');
    expect(squareAt(45, 45, 80, 'white')).toBe('e4');
  });
  it('mirrors for Black at the bottom', () => {
    expect(squareAt(1, 1, 80, 'black')).toBe('h1');
    expect(squareAt(79, 79, 80, 'black')).toBe('a8');
  });
  it('returns null outside the board', () => {
    expect(squareAt(-1, 5, 80, 'white')).toBeNull();
    expect(squareAt(80, 5, 80, 'white')).toBeNull();
  });
});

describe('randomSquare', () => {
  it('never repeats the previous square and stays on the board', () => {
    let prev: string | undefined;
    for (let i = 0; i < 300; i++) {
      const sq = randomSquare(prev);
      expect(sq).toMatch(/^[a-h][1-8]$/);
      expect(sq).not.toBe(prev);
      prev = sq;
    }
  });
  it('skips the previous square even when the rng keeps proposing it', () => {
    const seq = [0, 0, 0, 0, 0.5, 0.5];
    let i = 0;
    expect(randomSquare('a1', () => seq[i++])).toBe('e5');
  });
});

describe('streakSequence', () => {
  const seq = streakSequence('t1');
  it('has 100 unique, real puzzles from Mate in 1-3', () => {
    expect(seq).toHaveLength(100);
    expect(new Set(seq.map((p) => p.id)).size).toBe(100);
    for (const p of seq) {
      expect(getPuzzle(p.id)).toBeDefined();
      expect([1, 2, 3]).toContain(p.n);
    }
  });
  it('climbs in difficulty', () => {
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(avg(seq.slice(80).map((p) => p.rating))).toBeGreaterThan(avg(seq.slice(0, 20).map((p) => p.rating)) + 300);
  });
  it('is deterministic per seed and differs between seeds', () => {
    expect(streakSequence('t1').map((p) => p.id)).toEqual(seq.map((p) => p.id));
    expect(streakSequence('t2').map((p) => p.id)).not.toEqual(seq.map((p) => p.id));
  });
});

describe('Quick Game', () => {
  it('starts from the standard position with the chosen colour and level', () => {
    const s = newQuickState('b', 5);
    expect(s.startFen).toBe(START_FEN);
    expect(s.userColor).toBe('b');
    expect(s.quickLevel).toBe(5);
    const g = new GameSession(s);
    expect(g.isUserTurn()).toBe(false); // White (the bot) moves first
    expect(g.play('e2e4')).toBe('e4');
    expect(g.isUserTurn()).toBe(true);
  });
  it('detects checkmate as a loss/win for the user', () => {
    const g = new GameSession(newQuickState('w', 3));
    for (const m of ['f2f3', 'e7e5', 'g2g4', 'd8h4']) g.play(m);
    expect(g.state.result).toEqual({ outcome: 'loss', reason: 'checkmate' });
  });
  it('has 8 increasing levels and clamps out-of-range numbers', () => {
    expect(QUICK_LEVELS).toHaveLength(8);
    for (let i = 1; i < 8; i++) expect(QUICK_LEVELS[i].depth).toBeGreaterThanOrEqual(QUICK_LEVELS[i - 1].depth);
    expect(levelConfig(0)).toBe(QUICK_LEVELS[0]);
    expect(levelConfig(99)).toBe(QUICK_LEVELS[7]);
    expect(levelConfig('beginner').skill).toBe(0);
    expect(new Chess(START_FEN).moves().length).toBe(20);
  });
});

describe('Phase 2 progress records', () => {
  it('records a quick game separately from Win the Endgame', () => {
    const p = emptyProgress();
    const badges = recordGame(p, 'win', '2026-10-15', true, 'quick');
    expect(p.quick.w).toBe(1);
    expect(p.game.w).toBe(0);
    expect(badges.map((b) => b.id)).toContain('quick');
  });
  it('tracks streak and coordinates bests and the daily streak', () => {
    const p = emptyProgress();
    expect(recordStreak(p, 12, '2026-10-15', true).best).toBe(true);
    expect(recordStreak(p, 5, '2026-10-15', true).best).toBe(false);
    expect(p.streakBest).toBe(12);
    expect(p.badges.streak10).toBeDefined();
    expect(recordCoords(p, 21, '2026-10-15', true).best).toBe(true);
    expect(p.badges.coords20).toBeDefined();
    expect(p.streak.current).toBe(1);
    expect(p.days['2026-10-15'].streak).toBe(12);
  });
});
