import { describe, expect, it } from 'vitest';
import { addDays, emptyProgress, liveStreak, recordPuzzle, recordRush, touchDay, weeklyGrowth } from '../src/progress/progress';

const pz = { id: 'p1', n: 1 as const, rating: 800 };

describe('streaks', () => {
  it('counts consecutive days and resets after a gap', () => {
    const p = emptyProgress();
    touchDay(p, '2026-01-01', false);
    touchDay(p, '2026-01-02', false);
    touchDay(p, '2026-01-02', false);
    expect(p.streak.current).toBe(2);
    touchDay(p, '2026-01-05', false);
    expect(p.streak.current).toBe(1);
    expect(p.streak.best).toBe(2);
  });

  it('a streak freeze covers exactly one missed day', () => {
    const p = emptyProgress();
    touchDay(p, '2026-01-01', true);
    touchDay(p, '2026-01-03', true); // missed the 2nd
    expect(p.streak.current).toBe(2);
    expect(p.streak.freezes).toBe(0);
    touchDay(p, '2026-01-05', true); // no freeze left
    expect(p.streak.current).toBe(1);
  });

  it('live streak lapses when a day is skipped', () => {
    const p = emptyProgress();
    touchDay(p, '2026-01-01', false);
    expect(liveStreak(p, '2026-01-02', false)).toBe(1);
    expect(liveStreak(p, '2026-01-03', false)).toBe(0);
  });

  it('handles month/year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('recording', () => {
  it('tracks solves, first-try accuracy, mistakes and badges', () => {
    const p = emptyProgress();
    const badges = recordPuzzle(p, { puzzle: pz, solved: true, firstTry: true }, '2026-01-01', true);
    expect(badges.map((b) => b.id)).toContain('first');
    expect(p.byN[1]).toBe(1);
    recordPuzzle(p, { puzzle: { ...pz, id: 'p2' }, solved: true, firstTry: false }, '2026-01-01', true);
    expect(p.mistakes).toEqual(['p2']);
    // Solving the retry first time clears it from the queue.
    recordPuzzle(p, { puzzle: { ...pz, id: 'p2' }, solved: true, firstTry: true }, '2026-01-02', true);
    expect(p.mistakes).toEqual([]);
    expect(p.byN[1]).toBe(2); // not double-counted
  });

  it('rush best and weekly growth', () => {
    const p = emptyProgress();
    expect(recordRush(p, 12, '2026-01-10', true).best).toBe(true);
    expect(recordRush(p, 8, '2026-01-10', true).best).toBe(false);
    expect(p.rushBest).toBe(12);
    recordPuzzle(p, { puzzle: pz, solved: true, firstTry: true }, '2026-01-02', true);
    recordPuzzle(p, { puzzle: { ...pz, id: 'x' }, solved: true, firstTry: true }, '2026-01-09', true);
    expect(weeklyGrowth(p, '2026-01-10')).toEqual({ thisWeek: 1, lastWeek: 1 });
  });
});
