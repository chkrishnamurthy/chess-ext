/**
 * Builds src/data/curated.json — the small, hand-picked starter set shown first.
 *   - Hand-composed classic patterns (with teaching notes), reference lines computed by the solver.
 *   - The most popular verified Lichess puzzles per (Mate in N, tier) from src/data/puzzles.json.
 *
 *   npm run build-curated
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { MateSolver, applyUci } from '../src/game/mateSolver';
import type { MateN, Puzzle, Tier } from '../src/game/types';

interface Hand {
  id: string;
  title: string;
  fen: string;
  first: string;
  tier: Tier;
  rating: number;
  themes: string[];
  note: string;
}

const HAND: Hand[] = [
  {
    id: 'c-backrank', title: 'Back-rank mate', fen: '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', first: 'd1d8',
    tier: 'easy', rating: 500, themes: ['backRankMate'],
    note: "Black's own pawns on f7, g7 and h7 wall the king in. A rook on the 8th rank checks along the row and there is no escape square.",
  },
  {
    id: 'c-queen-row', title: 'Queen and king team up', fen: 'k7/8/1K6/8/8/8/8/5Q2 w - - 0 1', first: 'f1f8',
    tier: 'easy', rating: 550, themes: ['endgame'],
    note: 'Your king takes away a7 and b7; the queen checks along the 8th rank and also covers b8. Every escape square is covered.',
  },
  {
    id: 'c-scholar', title: "Scholar's mate", fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
    first: 'h5f7', tier: 'easy', rating: 600, themes: ['opening'],
    note: "f7 is Black's weakest square early on — only the king defends it. Queen takes on f7, protected by the bishop on c4, so the king cannot capture.",
  },
  {
    id: 'c-smothered', title: 'Smothered mate', fen: '6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1', first: 'g5f7',
    tier: 'easy', rating: 650, themes: ['smotheredMate'],
    note: "The black king is surrounded by its own rook and pawns. A knight check can't be blocked, and the king has nowhere to go.",
  },
  {
    id: 'c-arabian', title: 'Arabian mate', fen: '7k/R7/5N2/8/8/8/8/6K1 w - - 0 1', first: 'a7h7',
    tier: 'easy', rating: 700, themes: ['arabianMate'],
    note: 'Rook and knight in the corner: the knight on f6 guards both h7 (so the king cannot take the rook) and g8.',
  },
  {
    id: 'c-fool', title: "Fool's mate", fen: 'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2',
    first: 'd8h4', tier: 'easy', rating: 600, themes: ['opening'],
    note: "White weakened the e1–h4 diagonal by moving the f- and g-pawns. The queen checks from h4 and nothing can block or capture it.",
  },
  {
    id: 'c-black-backrank', title: 'Back rank, Black to play', fen: '3r2k1/5ppp/8/8/8/8/5PPP/6K1 b - - 0 1', first: 'd8d1',
    tier: 'easy', rating: 550, themes: ['backRankMate'],
    note: "Same pattern from the other side: White's king is stuck behind its pawns, so the rook drops to the 1st rank.",
  },
  {
    id: 'c-promote', title: 'Promote with mate', fen: 'k7/2P5/1K6/8/8/8/8/8 w - - 0 1', first: 'c7c8q',
    tier: 'easy', rating: 700, themes: ['promotion', 'endgame'],
    note: 'Promoting on c8 checks along the 8th rank. A queen or a rook both mate here — either answer is correct.',
  },
  {
    id: 'c-philidor', title: "Philidor's smothered mate", fen: '5r1k/6pp/7N/3Q4/8/8/8/6K1 w - - 0 1', first: 'd5g8',
    tier: 'medium', rating: 1100, themes: ['smotheredMate', 'sacrifice', 'attraction'],
    note: 'Give the queen on g8! The rook is forced to take (the knight covers g8 from the king), which smothers its own king — then Nf7 is mate.',
  },
  {
    id: 'c-king-walk', title: 'The quiet king step', fen: 'k7/8/2K5/8/8/8/8/1R6 w - - 0 1', first: 'c6c7',
    tier: 'tricky', rating: 1300, themes: ['quietMove', 'endgame'],
    note: "No check! Kc7 just takes b7 and b8 away. Black's only move is Ka7, and then the rook mates on a1.",
  },
];

/** Most-resilient reference line for a hand puzzle: first move, then solver play. */
function buildLine(solver: MateSolver, fen: string, first: string, n: number): string[] {
  const line = [first];
  let pos = applyUci(fen, first)!;
  for (let left = n - 1; left > 0; left--) {
    const def = solver.bestDefences(pos, left)[0].uci;
    line.push(def);
    pos = applyUci(pos, def)!;
    const att = solver.winningMoves(pos, left)[0];
    line.push(att);
    pos = applyUci(pos, att)!;
  }
  return line;
}

const TITLE: Record<string, string> = {
  backRankMate: 'Back-rank mate', smotheredMate: 'Smothered mate', anastasiaMate: "Anastasia's mate",
  arabianMate: 'Arabian mate', hookMate: 'Hook mate', bodenMate: "Boden's mate", doubleBishopMate: 'Two-bishop mate',
  dovetailMate: 'Dovetail mate', operaMate: 'Opera mate', pillsburysMate: "Pillsbury's mate", killBoxMate: 'Kill-box mate',
  underPromotion: 'Underpromotion!', quietMove: 'A quiet move', sacrifice: 'Sacrifice to mate',
};

function main() {
  const solver = new MateSolver();
  const out: Puzzle[] = [];
  for (const h of HAND) {
    const n = solver.mateDistance(h.fen, 3) as MateN | null;
    if (!n) throw new Error(`${h.id}: no forced mate`);
    out.push({
      id: h.id, fen: h.fen, line: buildLine(solver, h.fen, h.first, n), n, tier: h.tier, rating: h.rating,
      themes: h.themes, title: h.title, note: h.note,
    });
  }

  const lib: Puzzle[] = JSON.parse(readFileSync('src/data/puzzles.json', 'utf8'));
  const quota: [MateN, Tier, number][] = [
    [1, 'easy', 4], [1, 'medium', 3], [2, 'medium', 5], [2, 'hard', 3], [2, 'tricky', 3], [3, 'hard', 4], [3, 'tricky', 3],
  ];
  for (const [n, tier, k] of quota) {
    // puzzles.json is ordered by popularity within each N; prefer puzzles with a named pattern.
    const picks = lib
      .filter((p) => p.n === n && p.tier === tier)
      .sort((a, b) => Number(b.themes.some((t) => TITLE[t])) - Number(a.themes.some((t) => TITLE[t])))
      .slice(0, k);
    for (const p of picks) {
      const named = p.themes.find((t) => TITLE[t]);
      out.push({ ...p, title: named ? TITLE[named] : `Mate in ${n}` });
    }
  }
  writeFileSync('src/data/curated.json', JSON.stringify(out, null, 1));
  console.log(`wrote ${out.length} curated puzzles`);
}

main();
