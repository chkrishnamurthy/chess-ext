/**
 * Re-verifies every bundled puzzle (curated + library) before a build:
 *   - FEN is legal; reference line is legal and ends in checkmate;
 *   - the solver side mates in exactly N (no shorter mate);
 *   - the reference first move is among the winning moves;
 *   - Mate in 2/3 have a single winning first move (Mate in 1 may have several — all accepted).
 * Exits non-zero on any failure.  npm run verify-puzzles
 */
import { readFileSync } from 'node:fs';
import { Chess } from 'chess.js';
import { MateSolver } from '../src/game/mateSolver';
import { playUci } from '../src/game/chessUtil';
import type { Puzzle } from '../src/game/types';

export function verifyPuzzle(p: Puzzle, solver = new MateSolver()): string | null {
  let chess: Chess;
  try {
    chess = new Chess(p.fen);
  } catch {
    return 'bad FEN';
  }
  if (p.line.length !== 2 * p.n - 1) return 'line length';
  for (const u of p.line) if (!playUci(chess, u)) return `illegal line move ${u}`;
  if (!chess.isCheckmate()) return 'line does not end in mate';
  const d = solver.mateDistance(p.fen, p.n);
  if (d !== p.n) return d ? `shorter mate in ${d}` : 'mate not forced';
  const winners = solver.winningMoves(p.fen, p.n);
  if (!winners.includes(p.line[0])) return 'reference move not winning';
  if (p.n > 1 && winners.length !== 1) return `ambiguous first move (${winners.join(',')})`;
  return null;
}

function main() {
  let bad = 0;
  const ids = new Set<string>();
  for (const file of ['src/data/curated.json', 'src/data/puzzles.json']) {
    const list: Puzzle[] = JSON.parse(readFileSync(file, 'utf8'));
    const t0 = Date.now();
    for (const p of list) {
      const err = verifyPuzzle(p);
      if (err) {
        bad++;
        console.error(`✗ ${p.id}: ${err}`);
      }
      ids.add(p.id);
    }
    console.log(`${file}: ${list.length} checked in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  }
  if (bad) {
    console.error(`${bad} puzzle(s) failed verification`);
    process.exit(1);
  }
  console.log('all puzzles verified ✓');
}

if (process.argv[1]?.endsWith('verify-puzzles.ts')) main();
