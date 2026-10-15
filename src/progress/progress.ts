import type { MateN, Puzzle } from '../game/types';
import { KEYS, load, save } from '../storage/store';

/**
 * Local-only personal progress: "you vs you". Pure functions over a plain object so the
 * logic is unit-testable; load/save persist it in chrome.storage.local.
 */

export interface DayLog {
  solved: number;
  attempted: number;
  firstTry: number;
  rush?: number;
  streak?: number;
  coords?: number;
  ghost?: number;
}

export interface Progress {
  v: 1;
  solved: Record<string, { firstTry: boolean; at: string }>;
  byN: Record<MateN, number>;
  attempts: number;
  firstTry: number;
  days: Record<string, DayLog>;
  streak: { current: number; best: number; lastDay: string | null; freezes: number; frozenDays: string[] };
  rushBest: number;
  game: { w: number; d: number; l: number };
  /** Quick Game record (Win the Endgame is `game`). */
  quick: { w: number; d: number; l: number };
  streakBest: number;
  coordsBest: number;
  /** Best Ghost Race run: score and the seconds-into-the-race of each solve. */
  ghost?: { score: number; solves: number[] };
  /** Finished lessons and piece drills: id -> day. */
  learn: Record<string, string>;
  mistakes: string[];
  badges: Record<string, string>;
  rating: number;
  daily: Record<string, 'solved' | 'failed'>;
}

export function emptyProgress(): Progress {
  return {
    v: 1,
    solved: {},
    byN: { 1: 0, 2: 0, 3: 0 },
    attempts: 0,
    firstTry: 0,
    days: {},
    streak: { current: 0, best: 0, lastDay: null, freezes: 1, frozenDays: [] },
    rushBest: 0,
    game: { w: 0, d: 0, l: 0 },
    quick: { w: 0, d: 0, l: 0 },
    streakBest: 0,
    coordsBest: 0,
    learn: {},
    mistakes: [],
    badges: {},
    rating: 1000,
    daily: {},
  };
}

// ---- dates (local calendar days; users are global) ----------------------------------

export function dayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(day: string, delta: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d + delta));
}

// ---- streak ----------------------------------------------------------------------------

/** Mark `day` as active. A single missed day can be covered by a streak freeze. */
export function touchDay(p: Progress, day: string, allowFreeze: boolean): void {
  const s = p.streak;
  if (s.lastDay === day) return;
  if (s.lastDay && addDays(s.lastDay, 1) === day) {
    s.current += 1;
  } else if (s.lastDay && addDays(s.lastDay, 2) === day && allowFreeze && s.freezes > 0) {
    s.freezes -= 1;
    s.frozenDays.push(addDays(s.lastDay, 1));
    s.current += 1;
  } else {
    s.current = 1;
  }
  s.lastDay = day;
  s.best = Math.max(s.best, s.current);
  // A freeze is earned back every full week of play (max one banked — no hoarding, no nagging).
  if (s.current % 7 === 0) s.freezes = Math.max(s.freezes, 1);
}

/** Streak as it should be displayed today (0 if it has lapsed). */
export function liveStreak(p: Progress, today: string, allowFreeze: boolean): number {
  const s = p.streak;
  if (!s.lastDay) return 0;
  if (s.lastDay === today || addDays(s.lastDay, 1) === today) return s.current;
  if (allowFreeze && s.freezes > 0 && addDays(s.lastDay, 2) === today) return s.current;
  return 0;
}

// ---- badges ----------------------------------------------------------------------------

export interface BadgeDef {
  id: string;
  icon: string;
  name: string;
  desc: string;
  test: (p: Progress) => boolean;
}

const total = (p: Progress) => Object.keys(p.solved).length;

export const BADGES: BadgeDef[] = [
  { id: 'first', icon: '🌱', name: 'First mate', desc: 'Solve your first puzzle', test: (p) => total(p) >= 1 },
  { id: 's10', icon: '🎯', name: 'Ten down', desc: 'Solve 10 puzzles', test: (p) => total(p) >= 10 },
  { id: 's50', icon: '🏅', name: 'Half century', desc: 'Solve 50 puzzles', test: (p) => total(p) >= 50 },
  { id: 's100', icon: '🏆', name: 'Centurion', desc: 'Solve 100 puzzles', test: (p) => total(p) >= 100 },
  { id: 's250', icon: '👑', name: 'Mate machine', desc: 'Solve 250 puzzles', test: (p) => total(p) >= 250 },
  { id: 'm3', icon: '🧠', name: 'Deep thinker', desc: 'Solve a Mate in 3', test: (p) => p.byN[3] >= 1 },
  { id: 'streak3', icon: '🔥', name: 'Warming up', desc: '3-day streak', test: (p) => p.streak.best >= 3 },
  { id: 'streak7', icon: '📅', name: 'Full week', desc: '7-day streak', test: (p) => p.streak.best >= 7 },
  { id: 'streak30', icon: '💎', name: 'Habit formed', desc: '30-day streak', test: (p) => p.streak.best >= 30 },
  { id: 'rush10', icon: '⚡', name: 'Quick hands', desc: 'Score 10 in Puzzle Rush', test: (p) => p.rushBest >= 10 },
  { id: 'rush20', icon: '🌩️', name: 'Lightning', desc: 'Score 20 in Puzzle Rush', test: (p) => p.rushBest >= 20 },
  { id: 'streak10', icon: '🔥', name: 'On a roll', desc: 'Reach a Streak of 10', test: (p) => p.streakBest >= 10 },
  { id: 'coords20', icon: '🧭', name: 'Navigator', desc: 'Score 20 in Coordinates', test: (p) => p.coordsBest >= 20 },
  { id: 'quick', icon: '♞', name: 'Full game', desc: 'Win a Quick Game', test: (p) => p.quick.w >= 1 },
  { id: 'pieces', icon: '♘', name: 'Piece pro', desc: 'Finish all six piece drills', test: (p) => Object.keys(p.learn).filter((k) => k.startsWith('piece-')).length >= 6 },
  { id: 'lesson', icon: '🎓', name: 'Student', desc: 'Win an endgame lesson', test: (p) => Object.keys(p.learn).some((k) => k.startsWith('lesson-')) },
  { id: 'finish', icon: '♔', name: 'Closer', desc: 'Win a Win the Endgame position', test: (p) => p.game.w >= 1 },
];

/** Award any newly earned badges; returns them. */
export function awardBadges(p: Progress, day: string): BadgeDef[] {
  const out: BadgeDef[] = [];
  for (const b of BADGES) {
    if (!p.badges[b.id] && b.test(p)) {
      p.badges[b.id] = day;
      out.push(b);
    }
  }
  return out;
}

// ---- recording -------------------------------------------------------------------------

function dayLog(p: Progress, day: string): DayLog {
  return (p.days[day] ??= { solved: 0, attempted: 0, firstTry: 0 });
}

export interface PuzzleResult {
  puzzle: Pick<Puzzle, 'id' | 'n' | 'rating'>;
  solved: boolean;
  firstTry: boolean;
  daily?: boolean;
  /** Rush results count toward totals but not the hidden rating. */
  rush?: boolean;
}

export function recordPuzzle(p: Progress, r: PuzzleResult, day: string, allowFreeze: boolean): BadgeDef[] {
  const log = dayLog(p, day);
  const already = !!p.solved[r.puzzle.id];
  p.attempts += 1;
  log.attempted += 1;

  if (r.solved) {
    if (!already) {
      p.byN[r.puzzle.n] += 1;
      p.solved[r.puzzle.id] = { firstTry: r.firstTry, at: day };
    }
    log.solved += 1;
    if (r.firstTry) {
      p.firstTry += 1;
      log.firstTry += 1;
      p.mistakes = p.mistakes.filter((id) => id !== r.puzzle.id);
    }
    touchDay(p, day, allowFreeze);
  }
  if (!r.firstTry && !p.mistakes.includes(r.puzzle.id)) {
    p.mistakes.unshift(r.puzzle.id);
    p.mistakes = p.mistakes.slice(0, 50);
  }
  if (r.daily) p.daily[day] = r.solved ? 'solved' : 'failed';
  if (!r.rush && !already) {
    // Hidden Elo-style rating vs the puzzle's rating; first attempts only.
    const expected = 1 / (1 + 10 ** ((r.puzzle.rating - p.rating) / 400));
    p.rating = Math.round(p.rating + 24 * ((r.firstTry && r.solved ? 1 : 0) - expected));
  }
  return awardBadges(p, day);
}

export function recordRush(p: Progress, score: number, day: string, allowFreeze: boolean): { best: boolean; badges: BadgeDef[] } {
  const log = dayLog(p, day);
  const best = score > p.rushBest;
  p.rushBest = Math.max(p.rushBest, score);
  log.rush = Math.max(log.rush ?? 0, score);
  if (score > 0) touchDay(p, day, allowFreeze);
  return { best, badges: awardBadges(p, day) };
}

export function recordStreak(p: Progress, score: number, day: string, allowFreeze: boolean): { best: boolean; badges: BadgeDef[] } {
  const log = dayLog(p, day);
  const best = score > p.streakBest;
  p.streakBest = Math.max(p.streakBest, score);
  log.streak = Math.max(log.streak ?? 0, score);
  if (score > 0) touchDay(p, day, allowFreeze);
  return { best, badges: awardBadges(p, day) };
}

export function recordCoords(p: Progress, score: number, day: string, allowFreeze: boolean): { best: boolean; badges: BadgeDef[] } {
  const log = dayLog(p, day);
  const best = score > p.coordsBest;
  p.coordsBest = Math.max(p.coordsBest, score);
  log.coords = Math.max(log.coords ?? 0, score);
  if (score > 0) touchDay(p, day, allowFreeze);
  return { best, badges: awardBadges(p, day) };
}

/** `solves` holds the elapsed milliseconds of each solved puzzle; the best run becomes the ghost. */
export function recordGhost(p: Progress, score: number, solves: number[], day: string, allowFreeze: boolean): { best: boolean; badges: BadgeDef[] } {
  const log = dayLog(p, day);
  const best = score > (p.ghost?.score ?? 0);
  if (best) p.ghost = { score, solves };
  log.ghost = Math.max(log.ghost ?? 0, score);
  if (score > 0) touchDay(p, day, allowFreeze);
  return { best, badges: awardBadges(p, day) };
}

export function recordLearn(p: Progress, id: string, day: string): BadgeDef[] {
  p.learn[id] ??= day;
  return awardBadges(p, day);
}

/** `lesson` games count toward the day and badges but not toward either win/draw/loss record. */
export function recordGame(p: Progress, outcome: 'win' | 'draw' | 'loss', day: string, allowFreeze: boolean, kind: 'endgame' | 'quick' | 'lesson' = 'endgame'): BadgeDef[] {
  const rec = kind === 'quick' ? p.quick : kind === 'endgame' ? p.game : undefined;
  if (rec) {
    if (outcome === 'win') rec.w++;
    else if (outcome === 'draw') rec.d++;
    else rec.l++;
  }
  if (outcome !== 'loss') touchDay(p, day, allowFreeze);
  return awardBadges(p, day);
}

// ---- summaries -------------------------------------------------------------------------

export function solvedBetween(p: Progress, fromDay: string, toDay: string): number {
  let n = 0;
  for (const [d, log] of Object.entries(p.days)) if (d >= fromDay && d <= toDay) n += log.solved;
  return n;
}

export function weeklyGrowth(p: Progress, today: string): { thisWeek: number; lastWeek: number } {
  return {
    thisWeek: solvedBetween(p, addDays(today, -6), today),
    lastWeek: solvedBetween(p, addDays(today, -13), addDays(today, -7)),
  };
}

export function accuracy(p: Progress): number {
  return p.attempts ? Math.round((100 * p.firstTry) / p.attempts) : 0;
}

// ---- persistence -----------------------------------------------------------------------

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

/**
 * Turns whatever is in storage into a safe Progress: every field is checked, and anything
 * missing or of the wrong type falls back to its default. Old saves (before a field existed)
 * and damaged or hand-edited imports can therefore never crash the app.
 */
export function normalizeProgress(raw: unknown): Progress {
  const d = emptyProgress();
  if (!isObj(raw)) return d;
  const rec = (v: unknown, fallback: Record<string, unknown>) => (isObj(v) ? v : fallback);
  /** A record whose values must themselves be objects (days, solved): bad entries are dropped. */
  const objMap = (v: unknown) => (isObj(v) ? Object.fromEntries(Object.entries(v).filter(([, x]) => isObj(x))) : {});
  const triple = (v: unknown, fallback: { w: number; d: number; l: number }) =>
    isObj(v) ? { w: num(v.w, 0), d: num(v.d, 0), l: num(v.l, 0) } : fallback;
  const streak = isObj(raw.streak) ? raw.streak : {};
  const byN = isObj(raw.byN) ? raw.byN : {};
  const ghost = isObj(raw.ghost) && Array.isArray(raw.ghost.solves) ? { score: num(raw.ghost.score, 0), solves: raw.ghost.solves.filter((n): n is number => typeof n === 'number') } : undefined;
  return {
    v: 1,
    solved: objMap(raw.solved) as Progress['solved'],
    byN: { 1: num(byN[1], 0), 2: num(byN[2], 0), 3: num(byN[3], 0) },
    attempts: num(raw.attempts, 0),
    firstTry: num(raw.firstTry, 0),
    days: objMap(raw.days) as Progress['days'],
    streak: {
      current: num(streak.current, 0),
      best: num(streak.best, 0),
      lastDay: typeof streak.lastDay === 'string' ? streak.lastDay : null,
      freezes: num(streak.freezes, 1),
      frozenDays: Array.isArray(streak.frozenDays) ? streak.frozenDays.filter((x): x is string => typeof x === 'string') : [],
    },
    rushBest: num(raw.rushBest, 0),
    game: triple(raw.game, d.game),
    quick: triple(raw.quick, d.quick),
    streakBest: num(raw.streakBest, 0),
    coordsBest: num(raw.coordsBest, 0),
    ...(ghost ? { ghost } : {}),
    learn: rec(raw.learn, d.learn) as Progress['learn'],
    mistakes: Array.isArray(raw.mistakes) ? raw.mistakes.filter((x): x is string => typeof x === 'string') : [],
    badges: rec(raw.badges, d.badges) as Progress['badges'],
    rating: num(raw.rating, 1000),
    daily: rec(raw.daily, d.daily) as Progress['daily'],
  };
}

export async function loadProgress(): Promise<Progress> {
  return normalizeProgress(await load<unknown>(KEYS.progress, null));
}

export async function saveProgress(p: Progress): Promise<void> {
  await save(KEYS.progress, p);
}
