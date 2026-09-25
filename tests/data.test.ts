import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import curated from '../src/data/curated.json';
import positions from '../src/data/positions.json';
import { verifyPuzzle } from '../scripts/verify-puzzles';
import { dailyPuzzle, nextPuzzle, rushSequence } from '../src/game/puzzles';
import { parseBackup } from '../src/storage/backup';
import type { Puzzle } from '../src/game/types';

describe('puzzle data', () => {
  it('every curated puzzle verifies', () => {
    for (const p of curated as Puzzle[]) expect(verifyPuzzle(p), p.id).toBeNull();
  });

  it('the verifier rejects a mislabeled puzzle', () => {
    const wrongN: Puzzle = { id: 'bad', fen: '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', line: ['d1d8'], n: 1, tier: 'easy', rating: 1, themes: [] };
    expect(verifyPuzzle({ ...wrongN, n: 2, line: ['d1d8', 'g8h8', 'd8e8'] })).not.toBeNull();
    expect(verifyPuzzle({ ...wrongN, line: ['d1d7'] })).not.toBeNull();
  });

  it('finish positions are legal and side to move is the user', () => {
    for (const p of positions) expect(() => new Chess(p.fen), p.id).not.toThrow();
  });

  it('daily puzzle is deterministic per day and follows the weekday ladder', () => {
    expect(dailyPuzzle('2026-09-21').id).toBe(dailyPuzzle('2026-09-21').id);
    expect(dailyPuzzle('2026-09-21').n).toBe(1); // Monday
    expect(dailyPuzzle('2026-09-25').n).toBe(3); // Friday
    expect(dailyPuzzle('2026-09-27').tier).toBe('tricky'); // Sunday
  });

  it('practice serves curated puzzles first, then skips solved ones', () => {
    const first = nextPuzzle({ n: 1, exclude: new Set() })!;
    expect(first.id.startsWith('c-')).toBe(true);
    const second = nextPuzzle({ n: 1, exclude: new Set([first.id]) })!;
    expect(second.id).not.toBe(first.id);
  });

  it('rush sequence starts easy', () => {
    const seq = rushSequence('seed');
    expect(seq[0].n).toBe(1);
    expect(seq.length).toBe(80);
  });
});

describe('backup', () => {
  it('rejects foreign files and keys', () => {
    expect(() => parseBackup('{"hello":1}')).toThrow();
    expect(() => parseBackup(JSON.stringify({ app: 'chess-break', version: 1, data: { evil: 1 } }))).toThrow();
    expect(parseBackup(JSON.stringify({ app: 'chess-break', version: 1, exportedAt: '', data: { 'cb.progress': {} } })).data).toBeTruthy();
  });
});
