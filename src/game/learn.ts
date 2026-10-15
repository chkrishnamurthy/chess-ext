import { FILES } from './coords';

/** "Learn the pieces": move a lone piece to capture every black pawn. */
export type PieceRole = 'rook' | 'bishop' | 'knight' | 'queen' | 'king' | 'pawn';

export interface Drill {
  role: PieceRole;
  name: string;
  /** One line on how the piece moves. */
  how: string;
  start: string;
  targets: string[];
}

export const DRILLS: Drill[] = [
  { role: 'rook', name: 'Rook', how: 'Moves any number of squares in a straight line.', start: 'a1', targets: ['a6', 'f6', 'f2'] },
  { role: 'bishop', name: 'Bishop', how: 'Moves any number of squares diagonally. Stays on one colour.', start: 'c1', targets: ['e3', 'g5', 'd8'] },
  { role: 'knight', name: 'Knight', how: 'Jumps in an L: two squares one way, one square across. Can jump over pieces.', start: 'b1', targets: ['c3', 'e4', 'f6'] },
  { role: 'queen', name: 'Queen', how: 'Moves like a rook and a bishop combined.', start: 'd1', targets: ['d5', 'g8', 'a8'] },
  { role: 'king', name: 'King', how: 'Moves one square in any direction.', start: 'e1', targets: ['d2', 'd3', 'e4'] },
  { role: 'pawn', name: 'Pawn', how: 'Moves forward one square (two from its start). Captures one square diagonally forward.', start: 'e2', targets: ['d3', 'c4', 'b5'] },
];

const SLIDE: Record<'rook' | 'bishop' | 'queen', [number, number][]> = {
  rook: [[1, 0], [-1, 0], [0, 1], [0, -1]],
  bishop: [[1, 1], [1, -1], [-1, 1], [-1, -1]],
  queen: [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]],
};
const STEP: Record<'knight' | 'king', [number, number][]> = {
  knight: [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]],
  king: [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]],
};

const sq = (f: number, r: number) => `${FILES[f]}${r + 1}`;
const parse = (s: string): [number, number] => [FILES.indexOf(s[0]), Number(s[1]) - 1];
const onBoard = (f: number, r: number) => f >= 0 && f < 8 && r >= 0 && r < 8;

/**
 * Legal destinations for a white piece on a board that holds only black pawns (`enemies`).
 * Sliders stop at the first enemy, which they may capture.
 */
export function pieceMoves(role: PieceRole, from: string, enemies: ReadonlySet<string>): string[] {
  const [f, r] = parse(from);
  const out: string[] = [];
  if (role === 'rook' || role === 'bishop' || role === 'queen') {
    for (const [df, dr] of SLIDE[role]) {
      for (let k = 1; ; k++) {
        const nf = f + df * k;
        const nr = r + dr * k;
        if (!onBoard(nf, nr)) break;
        out.push(sq(nf, nr));
        if (enemies.has(sq(nf, nr))) break;
      }
    }
  } else if (role === 'knight' || role === 'king') {
    for (const [df, dr] of STEP[role]) if (onBoard(f + df, r + dr)) out.push(sq(f + df, r + dr));
  } else {
    if (r < 7 && !enemies.has(sq(f, r + 1))) {
      out.push(sq(f, r + 1));
      if (r === 1 && !enemies.has(sq(f, r + 2))) out.push(sq(f, r + 2));
    }
    for (const df of [-1, 1]) if (onBoard(f + df, r + 1) && enemies.has(sq(f + df, r + 1))) out.push(sq(f + df, r + 1));
  }
  return out;
}

/** Fewest moves that capture every target (breadth-first search), or null if impossible. */
export function parMoves(d: Drill): number | null {
  type Node = { at: string; left: string[]; n: number };
  const seen = new Set<string>();
  let queue: Node[] = [{ at: d.start, left: [...d.targets].sort(), n: 0 }];
  for (let depth = 0; depth <= 12 && queue.length; depth++) {
    const next: Node[] = [];
    for (const node of queue) {
      if (!node.left.length) return node.n;
      const key = `${node.at}|${node.left.join(',')}`;
      if (seen.has(key)) continue;
      seen.add(key);
      for (const to of pieceMoves(d.role, node.at, new Set(node.left))) next.push({ at: to, left: node.left.filter((t) => t !== to), n: node.n + 1 });
    }
    queue = next;
  }
  return null;
}

/** Stars for a finished drill: 3 for par or better, 2 within two extra moves, otherwise 1. */
export function stars(moves: number, par: number): 1 | 2 | 3 {
  return moves <= par ? 3 : moves <= par + 2 ? 2 : 1;
}

/** FEN piece-placement for a drill position (white piece + black pawns, no kings, display only). */
export function drillFen(role: PieceRole, at: string, targets: string[]): string {
  const grid: string[][] = Array.from({ length: 8 }, () => Array(8).fill(''));
  const put = (s: string, p: string) => {
    const [f, r] = parse(s);
    grid[7 - r][f] = p;
  };
  const letter: Record<PieceRole, string> = { rook: 'R', bishop: 'B', knight: 'N', queen: 'Q', king: 'K', pawn: 'P' };
  put(at, letter[role]);
  for (const t of targets) put(t, 'p');
  return grid
    .map((row) => {
      let s = '';
      let empty = 0;
      for (const c of row) {
        if (!c) empty++;
        else {
          if (empty) s += empty;
          empty = 0;
          s += c;
        }
      }
      return s + (empty || '');
    })
    .join('/');
}
