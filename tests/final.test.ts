import { describe, expect, it } from 'vitest';
import { emptyProgress, recordGame } from '../src/progress/progress';

describe('recordGame kinds', () => {
  it('counts Win the Endgame and Quick Game separately', () => {
    const p = emptyProgress();
    recordGame(p, 'win', '2026-10-15', true, 'endgame');
    recordGame(p, 'loss', '2026-10-15', true, 'quick');
    expect(p.game).toEqual({ w: 1, d: 0, l: 0 });
    expect(p.quick).toEqual({ w: 0, d: 0, l: 1 });
  });
  it('lesson games keep the day alive and earn badges but change neither record', () => {
    const p = emptyProgress();
    recordGame(p, 'win', '2026-10-15', true, 'lesson');
    expect(p.game).toEqual({ w: 0, d: 0, l: 0 });
    expect(p.quick).toEqual({ w: 0, d: 0, l: 0 });
    expect(p.streak.current).toBe(1);
    expect(p.badges.finish).toBeUndefined(); // "Closer" is for Win the Endgame
  });
});
