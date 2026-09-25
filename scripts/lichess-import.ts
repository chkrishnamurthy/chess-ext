/**
 * Lichess CC0 puzzle pipeline: filter → verify → tag difficulty → package as JSON.
 *
 *   npm run lichess-import -- <lichess_db_puzzle.csv> [--per-n 1200]
 *
 * The CSV is the (decompressed) https://database.lichess.org/lichess_db_puzzle.csv.zst.
 * A slice of it is enough; rows are in random order. Output: src/data/puzzles.json.
 *
 * Every emitted puzzle is re-verified with our exact mate solver:
 *   - the solver side mates in exactly N (no shorter mate — otherwise the label lies),
 *   - for Mate in 2/3 the first move is unique (a single clear solution),
 *   - the reference line is legal and ends in checkmate.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Chess } from 'chess.js';
import { MateSolver } from '../src/game/mateSolver';
import { playUci } from '../src/game/chessUtil';
import type { MateN, Puzzle, Tier } from '../src/game/types';

const args = process.argv.slice(2);
const csvPath = args.find((a) => !a.startsWith('--'));
if (!csvPath) {
  console.error('usage: npm run lichess-import -- <lichess_db_puzzle.csv> [--per-n 1200]');
  process.exit(1);
}
const perNIdx = args.indexOf('--per-n');
const PER_N = perNIdx >= 0 ? Number(args[perNIdx + 1]) : 1200;

/** Mate patterns worth naming in explanations; other themes are dropped to keep the JSON small. */
const KEEP_THEMES = new Set([
  'backRankMate', 'smotheredMate', 'anastasiaMate', 'arabianMate', 'hookMate', 'bodenMate',
  'doubleBishopMate', 'dovetailMate', 'swallowstailMate', 'epauletteMate', 'operaMate',
  'pillsburysMate', 'morphysMate', 'triangleMate', 'vukovicMate', 'killBoxMate', 'balestraMate',
  'blindSwineMate', 'cornerMate',
  'sacrifice', 'quietMove', 'underPromotion', 'promotion', 'enPassant', 'castling', 'deflection',
  'attraction', 'clearance', 'discoveredAttack', 'doubleCheck', 'interference', 'xRayAttack',
  'pin', 'fork', 'queensideAttack', 'kingsideAttack', 'endgame', 'middlegame', 'opening',
]);

/** Features that make a mate "look wrong" — candidates for the Tricky collection. */
export interface TrickFlags {
  quietFirst: boolean;
  queenSac: boolean;
  underPromotion: boolean;
}

export function trickFlags(fen: string, line: string[]): TrickFlags {
  const c = new Chess(fen);
  const first = playUci(c, line[0])!;
  const queenSac = first.piece === 'q' && c.moves({ verbose: true }).some((r) => r.to === first.to);
  const replay = new Chess(fen);
  let underPromotion = false;
  line.forEach((u, i) => {
    const m = playUci(replay, u)!;
    if (i % 2 === 0 && m.promotion && m.promotion !== 'q') underPromotion = true;
  });
  return { quietFirst: !first.san.includes('+'), queenSac, underPromotion };
}

export function tierFor(n: MateN, rating: number, f: TrickFlags): Tier {
  if (f.underPromotion || (n > 1 && f.quietFirst && rating >= 1300) || (f.queenSac && rating >= 1750)) return 'tricky';
  if (n === 1) return rating < 1400 ? 'easy' : 'medium';
  if (n === 2) return rating < 1600 ? 'medium' : 'hard';
  return 'hard';
}

interface Row {
  id: string; fen: string; moves: string[]; rating: number; rd: number; pop: number; plays: number; themes: string[];
}

function parse(line: string): Row | null {
  const c = line.split(',');
  if (c.length < 8 || c[0] === 'PuzzleId') return null;
  return {
    id: c[0], fen: c[1], moves: c[2].split(' '), rating: +c[3], rd: +c[4], pop: +c[5], plays: +c[6],
    themes: c[7].split(' '),
  };
}

/** Returns a verified Puzzle or a rejection reason. */
export function verifyRow(r: Row, solver = new MateSolver(2_000_000)): Puzzle | string {
  const n = (r.themes.includes('mateIn1') ? 1 : r.themes.includes('mateIn2') ? 2 : r.themes.includes('mateIn3') ? 3 : 0) as MateN | 0;
  if (!n) return 'not mate-in-1..3';
  const chess = new Chess(r.fen);
  const last = r.moves[0];
  if (!playUci(chess, last)) return 'illegal setup move';
  const fen = chess.fen();
  const line = r.moves.slice(1);
  if (line.length !== 2 * n - 1) return 'line length mismatch';

  // Reference line must be legal and end in mate.
  const replay = new Chess(fen);
  for (const u of line) if (!playUci(replay, u)) return 'illegal line';
  if (!replay.isCheckmate()) return 'line does not mate';

  try {
    const dist = solver.mateDistance(fen, n);
    if (dist !== n) return dist ? `shorter mate (${dist})` : 'mate not forced';
    const winners = solver.winningMoves(fen, n);
    if (!winners.includes(line[0])) return 'reference move not winning';
    if (n > 1 && winners.length !== 1) return 'multiple first moves';
  } catch {
    return 'search budget';
  }

  const themes = r.themes.filter((t) => KEEP_THEMES.has(t));
  return {
    id: `l${r.id}`, fen, last, line, n, tier: tierFor(n, r.rating, trickFlags(fen, line)), rating: r.rating, themes, src: r.id,
  };
}

function main() {
  const lines = readFileSync(resolve(csvPath!), 'utf8').split('\n');
  const buckets: Record<MateN, Row[]> = { 1: [], 2: [], 3: [] };
  for (const l of lines) {
    const r = parse(l);
    // Quality gate: well-rated, stable rating, liked by players, played enough to be trusted.
    if (!r || r.pop < 88 || r.plays < 800 || r.rd > 90 || r.rating < 500 || r.rating > 2300) continue;
    const n = r.themes.includes('mateIn1') ? 1 : r.themes.includes('mateIn2') ? 2 : r.themes.includes('mateIn3') ? 3 : 0;
    if (n) buckets[n as MateN].push(r);
  }

  const out: Puzzle[] = [];
  const reasons: Record<string, number> = {};
  for (const n of [1, 2, 3] as MateN[]) {
    // Spread across the rating range so every tier is populated.
    const rows = buckets[n].sort((a, b) => b.pop * Math.log(b.plays) - a.pop * Math.log(a.plays));
    let kept = 0;
    const t0 = Date.now();
    for (const r of rows) {
      if (kept >= PER_N) break;
      const res = verifyRow(r);
      if (typeof res === 'string') {
        reasons[res] = (reasons[res] ?? 0) + 1;
        continue;
      }
      out.push(res);
      kept++;
    }
    console.log(`mate in ${n}: ${kept} kept of ${rows.length} candidates (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  }
  console.log('rejections:', reasons);
  const tiers = out.reduce<Record<string, number>>((a, p) => ((a[p.tier] = (a[p.tier] ?? 0) + 1), a), {});
  console.log('tiers:', tiers);
  writeFileSync(resolve('src/data/puzzles.json'), JSON.stringify(out));
  console.log(`wrote ${out.length} puzzles to src/data/puzzles.json`);
}

if (process.argv[1]?.endsWith('lichess-import.ts')) main();
