import { Chess } from 'chess.js';
import { PIECE_NAMES, playUci, uciToMove } from './chessUtil';
import type { Puzzle } from './types';

/** Plain-language descriptions of mate patterns (Lichess theme names). */
export const THEME_TEXT: Record<string, string> = {
  backRankMate: "Back-rank mate: the king is trapped behind its own pawns, so a heavy piece on the back rank finishes it.",
  smotheredMate: 'Smothered mate: the king is boxed in by its own pieces and a knight delivers the check.',
  anastasiaMate: "Anastasia's mate: a knight cuts off the escape squares while a rook or queen mates on the edge file.",
  arabianMate: 'Arabian mate: rook and knight work together to trap the king in the corner.',
  hookMate: 'Hook mate: a rook protected by a knight, which is itself protected by a pawn.',
  bodenMate: "Boden's mate: two bishops on crossing diagonals trap a king that has castled long.",
  doubleBishopMate: 'Two bishops on neighbouring diagonals cover every escape square.',
  dovetailMate: 'Dovetail mate: the queen mates diagonally while the king’s own pieces block its retreat.',
  swallowstailMate: "Swallow's-tail mate: the queen mates head-on while the king's own pieces block the sides.",
  epauletteMate: "Epaulette mate: the king's own pieces sit on both sides of it like shoulder pads.",
  operaMate: 'Opera mate: a rook mates on the back rank, protected by a bishop.',
  pillsburysMate: "Pillsbury's mate: rook and bishop combine against the castled king.",
  morphysMate: "Morphy's mate: a bishop mates the cornered king, supported by a rook.",
  triangleMate: 'Triangle mate: queen and rook form a triangle that covers every escape.',
  vukovicMate: 'Vuković mate: rook and knight combine to mate the king on the edge.',
  killBoxMate: 'Kill-box mate: rook and queen together box the king in.',
  balestraMate: 'Balestra mate: bishop and queen combine from a distance.',
  blindSwineMate: 'Blind-swine mate: two rooks on the 7th rank.',
  cornerMate: 'Corner mate: the king is stuck in the corner.',
};

const TACTIC_TEXT: Record<string, string> = {
  sacrifice: 'It starts with a sacrifice — material doesn’t matter when the king falls.',
  quietMove: 'The key move is quiet: no check, it just takes away escape squares.',
  underPromotion: 'Promoting to a queen would not work here — the underpromotion is the point.',
  deflection: 'A deflection lures a defender away from its job.',
  attraction: 'An attraction pulls the king (or a defender) onto a fatal square.',
  clearance: 'A clearance move opens a line for another piece.',
  discoveredAttack: 'A discovered attack: moving one piece unleashes another.',
  doubleCheck: 'A double check — the king must move, because two checks can’t both be blocked.',
  interference: 'An interference cuts the line between a defender and the square it guards.',
  enPassant: 'Yes, en passant is legal — and it opens the decisive line.',
};

const side = (fen: string) => (fen.split(' ')[1] === 'w' ? 'White' : 'Black');

function kingSquare(chess: Chess, color: 'w' | 'b'): string {
  for (const row of chess.board()) for (const c of row) if (c && c.type === 'k' && c.color === color) return c.square;
  return '';
}

export interface Hint {
  level: 1 | 2 | 3;
  text: string;
  /** Squares to highlight (level 1: piece square; level 3: from/to arrow). */
  squares: string[];
  arrow?: [string, string];
}

/** Gradual hints for the move `uci` in `fen`: ① which piece → ② the idea/area → ③ the move. */
export function hintFor(fen: string, uci: string, level: 1 | 2 | 3): Hint {
  const chess = new Chess(fen);
  const { from, to } = uciToMove(uci);
  const piece = chess.get(from as never);
  const name = PIECE_NAMES[piece?.type ?? 'p'];
  const enemy = chess.turn() === 'w' ? 'b' : 'w';
  const ksq = kingSquare(chess, enemy);
  const move = playUci(chess, uci)!;

  if (level === 1) return { level, text: `Look at your ${name} on ${from}.`, squares: [from] };
  if (level === 2) {
    let text: string;
    if (move.san.endsWith('#')) text = `There's a check from your ${name} that the king on ${ksq} can't escape.`;
    else if (move.san.includes('+') && move.captured) text = `Capture with check — the king on ${ksq} is weaker than it looks.`;
    else if (move.san.includes('+')) text = `Start with a check near the king on ${ksq}.`;
    else if (move.promotion) text = `Promote your pawn — but think about which piece.`;
    else if (move.captured) text = `Start with a capture on ${to}.`;
    else text = `No check needed first: take escape squares away from the king on ${ksq}.`;
    const sacrifice = chess.moves({ verbose: true }).some((r) => r.to === to) && move.piece !== 'p';
    if (sacrifice && !move.san.endsWith('#')) text += ' Don’t be afraid to give up material.';
    return { level, text, squares: [from, ksq] };
  }
  return { level, text: `Play ${move.san}.`, squares: [from, to], arrow: [from, to] };
}

export interface Explanation {
  title: string;
  idea: string;
  line: string;
  defence?: string;
}

/** SAN move list with numbering, e.g. "1. Qg8+ Rxg8 2. Nf7#". */
export function formatLine(fen: string, ucis: string[]): string {
  const chess = new Chess(fen);
  const parts: string[] = [];
  let num = Number(fen.split(' ')[5] ?? 1);
  ucis.forEach((u, i) => {
    const white = chess.turn() === 'w';
    const m = playUci(chess, u);
    if (!m) return;
    if (white) parts.push(`${num}. ${m.san}`);
    else parts.push(i === 0 ? `${num}… ${m.san}` : m.san);
    if (!white) num++;
  });
  return parts.join(' ');
}

/**
 * Teaching text shown only after solving (or after "show solution").
 * `played` is the actual line on the board (solver, defender, …, mate).
 */
export function explain(p: Puzzle, played: string[], verbose: boolean): Explanation {
  const chess = new Chess(p.fen);
  const first = playUci(chess, played[0]);
  const pattern = p.themes.map((t) => THEME_TEXT[t]).find(Boolean);
  const tactic = p.themes.map((t) => TACTIC_TEXT[t]).find(Boolean);
  const title = p.title ?? (pattern ? pattern.split(':')[0] : `Mate in ${p.n}`);

  let idea: string;
  if (p.note) idea = p.note;
  else if (p.n === 1) idea = pattern ?? `${first?.san} leaves the king in check with no escape, no block and no capture.`;
  else {
    const kind = first?.san.includes('+') ? 'forcing check' : first?.captured ? 'capture' : 'quiet move';
    idea = `${first?.san} is a ${kind} that leaves ${side(chess.fen())} no good answer.`;
    if (pattern) idea += ' ' + pattern;
  }
  if (verbose && tactic && !p.note) idea += ' ' + tactic;

  const line = formatLine(p.fen, played);
  let defence: string | undefined;
  if (p.n > 1 && played.length > 1) {
    const defender = side(chess.fen());
    const replay = new Chess(p.fen);
    const defSans: string[] = [];
    let allForced = true;
    played.forEach((u, i) => {
      if (i % 2 === 1 && replay.moves().length > 1) allForced = false;
      const san = playUci(replay, u)?.san ?? '';
      if (i % 2 === 1) defSans.push(san);
    });
    if (allForced) defence = `${defSans.join(', then ')} was forced — ${defender} had no other legal move.`;
    else
      defence = verbose
        ? `${defender}'s most stubborn defence was ${defSans.join(', then ')} — every other reply allows mate even sooner.`
        : `Best defence: ${defSans.join(', ')}.`;
  }
  return { title, idea: verbose ? idea : idea.split('. ')[0].replace(/\.?$/, '.'), line, defence };
}
