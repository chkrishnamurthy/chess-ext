import curated from '../data/curated.json';
import library from '../data/puzzles.json';
import type { MateN, Puzzle, Tier } from './types';

/** Curated first, then the verified Lichess library (deduplicated). */
const ALL: Puzzle[] = (() => {
  const seen = new Set<string>();
  const out: Puzzle[] = [];
  for (const p of [...(curated as Puzzle[]), ...(library as Puzzle[])]) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(p);
  }
  return out;
})();

const BY_ID = new Map(ALL.map((p) => [p.id, p]));
const CURATED_IDS = new Set((curated as Puzzle[]).map((p) => p.id));

export const TIERS: Tier[] = ['easy', 'medium', 'hard', 'tricky'];
export const TIER_LABEL: Record<Tier, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard', tricky: 'Tricky' };

export function allPuzzles(): Puzzle[] {
  return ALL;
}

export function getPuzzle(id: string): Puzzle | undefined {
  return BY_ID.get(id);
}

export function isCurated(id: string): boolean {
  return CURATED_IDS.has(id);
}

/** Stable 32-bit hash (FNV-1a) — used for the daily pick and deterministic shuffles. */
export function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Today's challenge. Same puzzle for everyone on a given calendar day; the difficulty
 * follows the week: Mon–Tue Mate in 1, Wed–Thu Mate in 2, Fri–Sat Mate in 3, Sun Tricky.
 */
export function dailyPuzzle(day: string): Puzzle {
  const [y, m, d] = day.split('-').map(Number);
  const dow = new Date(y, m - 1, d).getDay(); // 0 = Sunday
  const pool =
    dow === 0
      ? ALL.filter((p) => p.tier === 'tricky')
      : ALL.filter((p) => p.n === ([0, 1, 1, 2, 2, 3, 3][dow] as MateN) && p.tier !== 'tricky' && p.themes.length > 0);
  return pool[hash(`daily:${day}`) % pool.length];
}

export interface PickOptions {
  n?: MateN;
  tier?: Tier | 'all';
  exclude: Set<string>;
  /** Target rating for adaptive-ish ordering; puzzles closest to it come first. */
  rating?: number;
  seed?: string;
}

/**
 * Next practice puzzle: curated ones first (in order), then library puzzles around the
 * player's level with a deterministic shuffle so it doesn't feel like a fixed list.
 */
export function nextPuzzle(o: PickOptions): Puzzle | undefined {
  const match = (p: Puzzle) =>
    (!o.n || p.n === o.n) && (!o.tier || o.tier === 'all' || p.tier === o.tier) && !o.exclude.has(p.id);
  const cur = (curated as Puzzle[]).find(match);
  if (cur) return cur;
  const pool = ALL.filter(match);
  if (!pool.length) return undefined;
  const target = o.rating ?? 1000;
  const seed = o.seed ?? '';
  return pool
    .map((p) => ({ p, score: Math.abs(p.rating - target) + (hash(seed + p.id) % 300) }))
    .reduce((a, b) => (b.score < a.score ? b : a)).p;
}

/** Puzzle Rush sequence: rising difficulty, mostly short mates so the clock matters. */
export function rushSequence(seed: string, count = 80): Puzzle[] {
  const pick = (filter: (p: Puzzle) => boolean) =>
    ALL.filter(filter).sort((a, b) => hash(seed + a.id) - hash(seed + b.id));
  const m1e = pick((p) => p.n === 1 && p.rating < 1100);
  const m1 = pick((p) => p.n === 1 && p.rating >= 1100);
  const m2 = pick((p) => p.n === 2 && p.rating < 1700);
  const m2h = pick((p) => p.n === 2 && p.rating >= 1700);
  const out: Puzzle[] = [];
  for (let i = 0; i < count; i++) {
    const src = i < 8 ? m1e : i < 16 ? m1 : i < 30 ? m2 : m2h;
    out.push(src[i % src.length]);
  }
  return out;
}
