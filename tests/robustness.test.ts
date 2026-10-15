import { describe, expect, it } from 'vitest';
import { emptyProgress, normalizeProgress } from '../src/progress/progress';
import { isValidEntry, parseBackup } from '../src/storage/backup';
import { START_FEN } from '../src/game/gameSession';

const backup = (data: Record<string, unknown>) => JSON.stringify({ app: 'chess-break', version: 1, exportedAt: '', data });
const game = (over: Record<string, unknown> = {}) => ({ positionId: 'quick', startFen: START_FEN, moves: ['e2e4', 'e7e5'], userColor: 'w', level: 'beginner', startedAt: 1, ...over });

describe('normalizeProgress', () => {
  it('returns defaults for anything that is not an object', () => {
    for (const bad of [null, undefined, 5, 'x', [], true]) expect(normalizeProgress(bad)).toEqual(emptyProgress());
  });
  it('keeps good data and repairs bad fields', () => {
    const p = normalizeProgress({ attempts: 7, rushBest: 'lots', streak: { current: 3, best: 'x', frozenDays: [1, '2026-01-01'] }, days: { a: 5, b: { solved: 2 } }, mistakes: 'nope', solved: { x: 1, y: { firstTry: true } } });
    expect(p.attempts).toBe(7);
    expect(p.rushBest).toBe(0);
    expect(p.streak).toMatchObject({ current: 3, best: 0, frozenDays: ['2026-01-01'] });
    expect(Object.keys(p.days)).toEqual(['b']);
    expect(Object.keys(p.solved)).toEqual(['y']);
    expect(p.mistakes).toEqual([]);
  });
  it('fills fields that older versions did not have', () => {
    const old = { ...emptyProgress() } as Record<string, unknown>;
    delete old.quick;
    delete old.learn;
    delete old.streakBest;
    const p = normalizeProgress(old);
    expect(p.quick).toEqual({ w: 0, d: 0, l: 0 });
    expect(p.learn).toEqual({});
    expect(p.streakBest).toBe(0);
  });
});

describe('backup validation', () => {
  it('accepts a real-looking backup', () => {
    expect(() => parseBackup(backup({ 'cb.progress': emptyProgress(), 'cb.settings': {}, 'cb.session.game': game(), 'cb.session.screen': { name: 'home' } }))).not.toThrow();
  });
  it('rejects wrongly shaped values and says which key', () => {
    expect(() => parseBackup(backup({ 'cb.progress': 5 }))).toThrow(/cb\.progress/);
    expect(() => parseBackup(backup({ 'cb.session.screen': { x: 1 } }))).toThrow(/cb\.session\.screen/);
    expect(() => parseBackup(backup({ 'cb.session.rush': { ids: [1], index: 0, score: 0 } }))).toThrow(/rush/);
  });
  it('rejects a saved game with an invalid FEN or an illegal move', () => {
    expect(isValidEntry('cb.session.game', game())).toBe(true);
    expect(isValidEntry('cb.session.game', game({ startFen: 'not a fen' }))).toBe(false);
    expect(isValidEntry('cb.session.game', game({ moves: ['e2e5'] }))).toBe(false);
    expect(isValidEntry('cb.session.game', game({ moves: ['e7e5'] }))).toBe(false); // Black cannot move first
    expect(isValidEntry('cb.session.game', null)).toBe(true);
  });
  it('rejects non-JSON and foreign files, and keeps unknown cb. keys', () => {
    expect(() => parseBackup('not json')).toThrow(/not a Chess Break backup/);
    expect(() => parseBackup('[]')).toThrow();
    expect(() => parseBackup(backup({ evil: 1 }))).toThrow(/Unexpected key/);
    expect(() => parseBackup(backup({ 'cb.future.thing': { a: 1 } }))).not.toThrow();
  });
});
