export type Tier = 'easy' | 'medium' | 'hard' | 'tricky';
export type MateN = 1 | 2 | 3;

/**
 * A verified checkmate puzzle. `fen` is the position with the SOLVER to move.
 * `line` is the reference solution (solver, defender, solver, ...) — the checker accepts
 * any move that keeps a forced mate, `line` is only used to prefer natural replies/hints.
 */
export interface Puzzle {
  id: string;
  fen: string;
  /** Opponent's previous move (UCI), highlighted on the board. */
  last?: string;
  line: string[];
  n: MateN;
  tier: Tier;
  rating: number;
  themes: string[];
  /** Hand-written teaching note for curated puzzles. */
  note?: string;
  title?: string;
  /** Source attribution (Lichess puzzle id). */
  src?: string;
}

export interface FinishPosition {
  id: string;
  title: string;
  fen: string;
  tier: Tier;
  goal: string;
  tip: string;
}
