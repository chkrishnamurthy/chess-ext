import { allPuzzles } from './puzzles';

export interface Theme {
  id: string;
  name: string;
  blurb: string;
}

/** Tactical patterns that appear often enough in the puzzle library to practise one at a time. */
export const THEMES: Theme[] = [
  { id: 'backRankMate', name: 'Back-rank mate', blurb: 'The king is trapped behind its own pawns.' },
  { id: 'smotheredMate', name: 'Smothered mate', blurb: 'A knight mates a king boxed in by its own pieces.' },
  { id: 'fork', name: 'Fork', blurb: 'One piece attacks two targets at once.' },
  { id: 'pin', name: 'Pin', blurb: 'A piece cannot move without exposing something behind it.' },
  { id: 'discoveredAttack', name: 'Discovered attack', blurb: 'Move one piece to unleash another.' },
  { id: 'doubleCheck', name: 'Double check', blurb: 'Two pieces give check at the same time.' },
  { id: 'deflection', name: 'Deflection', blurb: 'Lure a defender away from its job.' },
  { id: 'attraction', name: 'Attraction', blurb: 'Drag the king onto a fatal square.' },
  { id: 'sacrifice', name: 'Sacrifice', blurb: 'Give up material to win the game.' },
  { id: 'promotion', name: 'Promotion', blurb: 'A pawn becomes a new piece, often with mate.' },
];

/** Solve this many puzzles of one pattern to master it. */
export const MASTER_AT = 10;

export const themeName = (id: string): string => THEMES.find((t) => t.id === id)?.name ?? id;

/** How many puzzles of a theme the player has solved. */
export function themeSolved(solved: Record<string, unknown>, id: string): number {
  const ids = new Set(Object.keys(solved));
  let n = 0;
  for (const p of allPuzzles()) if (ids.has(p.id) && p.themes.includes(id)) n++;
  return n;
}

export const themesMastered = (solved: Record<string, unknown>): number =>
  THEMES.filter((t) => themeSolved(solved, t.id) >= MASTER_AT).length;
