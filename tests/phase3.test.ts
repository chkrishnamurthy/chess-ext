import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { DRILLS, drillFen, parMoves, pieceMoves, stars } from '../src/game/learn';
import { LESSONS } from '../src/game/lessons';
import { allPuzzles, nextPuzzle } from '../src/game/puzzles';
import { MASTER_AT, THEMES, themeSolved, themesMastered } from '../src/game/themes';
import { emptyProgress, recordGhost } from '../src/progress/progress';

describe('themes', () => {
  it('every theme has enough puzzles to master', () => {
    for (const t of THEMES) {
      const n = allPuzzles().filter((p) => p.themes.includes(t.id)).length;
      expect(n, t.id).toBeGreaterThanOrEqual(MASTER_AT * 2);
    }
  });
  it('nextPuzzle can filter by theme and skips solved ones', () => {
    const a = nextPuzzle({ theme: 'fork', exclude: new Set() })!;
    expect(a.themes).toContain('fork');
    const b = nextPuzzle({ theme: 'fork', exclude: new Set([a.id]) })!;
    expect(b.themes).toContain('fork');
    expect(b.id).not.toBe(a.id);
  });
  it('counts solved puzzles per theme and mastery', () => {
    const ids = allPuzzles().filter((p) => p.themes.includes('pin')).slice(0, MASTER_AT);
    const solved = Object.fromEntries(ids.map((p) => [p.id, true]));
    expect(themeSolved(solved, 'pin')).toBe(MASTER_AT);
    expect(themesMastered(solved)).toBeGreaterThanOrEqual(1);
    expect(themeSolved({}, 'pin')).toBe(0);
  });
});

describe('endgame lessons', () => {
  it('start from legal, unfinished positions with White to move', () => {
    for (const l of LESSONS) {
      const c = new Chess(l.fen);
      expect(c.turn(), l.id).toBe('w');
      expect(c.isGameOver(), l.id).toBe(false);
      expect(l.steps.length).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('learn the pieces', () => {
  it('generates the right moves', () => {
    const none = new Set<string>();
    expect(pieceMoves('knight', 'b1', none).sort()).toEqual(['a3', 'c3', 'd2']);
    expect(pieceMoves('king', 'e1', none)).toHaveLength(5);
    expect(pieceMoves('rook', 'a1', none)).toHaveLength(14);
    expect(pieceMoves('bishop', 'c1', none)).toHaveLength(7);
    expect(pieceMoves('queen', 'd1', none)).toHaveLength(21);
  });
  it('sliders stop at, and may capture, the first enemy', () => {
    const m = pieceMoves('rook', 'a1', new Set(['a4']));
    expect(m).toContain('a4');
    expect(m).not.toContain('a5');
  });
  it('pawns move forward, capture diagonally, and cannot capture straight ahead', () => {
    expect(pieceMoves('pawn', 'e2', new Set()).sort()).toEqual(['e3', 'e4']);
    expect(pieceMoves('pawn', 'e2', new Set(['e3']))).toEqual([]);
    expect(pieceMoves('pawn', 'e2', new Set(['d3', 'f3'])).sort()).toEqual(['d3', 'e3', 'e4', 'f3']);
  });
  it('every drill can be completed, and par is a sane number', () => {
    for (const d of DRILLS) {
      const par = parMoves(d);
      expect(par, d.role).not.toBeNull();
      expect(par!).toBeGreaterThanOrEqual(d.targets.length);
      expect(par!).toBeLessThanOrEqual(d.targets.length + 2);
    }
  });
  it('builds a valid display FEN', () => {
    expect(drillFen('rook', 'a1', ['a6'])).toBe('8/8/p7/8/8/8/8/R7');
  });
  it('awards stars by par', () => {
    expect(stars(3, 3)).toBe(3);
    expect(stars(5, 3)).toBe(2);
    expect(stars(9, 3)).toBe(1);
  });
});

describe('ghost race record', () => {
  it('saves the timeline only when the score is a new best', () => {
    const p = emptyProgress();
    expect(recordGhost(p, 4, [1, 2, 3, 4], '2026-10-15', true).best).toBe(true);
    expect(p.ghost).toEqual({ score: 4, solves: [1, 2, 3, 4] });
    expect(recordGhost(p, 2, [9, 10], '2026-10-15', true).best).toBe(false);
    expect(p.ghost?.score).toBe(4);
    expect(p.days['2026-10-15'].ghost).toBe(4);
  });
});
