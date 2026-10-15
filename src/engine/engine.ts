import { Chess } from 'chess.js';
import type { BotLevel } from '../game/gameSession';

/**
 * Stockfish (WASM, bundled in /engine — no runtime code download) running in a Web
 * Worker so the UI never freezes. If the worker can't start, a tiny JS fallback bot
 * keeps the mode playable.
 */

interface LevelConfig {
  skill: number;
  depth: number;
  movetime: number;
  /** Chance of a deliberate "slack" move among the engine's top choices (never a random blunder into mate). */
  slack: number;
  multipv: number;
}

export const LEVELS: Record<BotLevel, LevelConfig> = {
  beginner: { skill: 0, depth: 3, movetime: 150, slack: 0.3, multipv: 4 },
  intermediate: { skill: 6, depth: 8, movetime: 400, slack: 0, multipv: 1 },
};

export const LEVEL_LABEL: Record<BotLevel, string> = { beginner: 'Beginner', intermediate: 'Intermediate' };

/** Quick Game strength, level 1 (very gentle) to 8 (full strength for this build). */
export const QUICK_LEVELS: LevelConfig[] = [
  { skill: 0, depth: 1, movetime: 60, slack: 0.5, multipv: 4 },
  { skill: 0, depth: 2, movetime: 100, slack: 0.35, multipv: 4 },
  { skill: 2, depth: 3, movetime: 150, slack: 0.25, multipv: 3 },
  { skill: 5, depth: 5, movetime: 250, slack: 0.1, multipv: 2 },
  { skill: 8, depth: 7, movetime: 400, slack: 0, multipv: 1 },
  { skill: 12, depth: 10, movetime: 600, slack: 0, multipv: 1 },
  { skill: 16, depth: 13, movetime: 900, slack: 0, multipv: 1 },
  { skill: 20, depth: 16, movetime: 1500, slack: 0, multipv: 1 },
];

export const QUICK_LEVEL_NAME = ['Rookie', 'Beginner', 'Casual', 'Improving', 'Club', 'Strong club', 'Expert', 'Master'];

/** Config for a bot level: the two Win the Endgame names, or a Quick Game number 1-8. */
export function levelConfig(level: BotLevel | number): LevelConfig {
  if (typeof level === 'number') return QUICK_LEVELS[Math.max(1, Math.min(QUICK_LEVELS.length, Math.round(level))) - 1];
  return LEVELS[level];
}

/** How long past its time budget a search may run before it is treated as hung. */
const SEARCH_GRACE_MS = 5000;

type Pending = { resolve: (uci: string) => void; lines: Map<number, { uci: string; score: number }> };

export class Engine {
  private worker?: Worker;
  private ready?: Promise<void>;
  private pending?: Pending;
  failed = false;

  constructor(private url = 'engine/stockfish.js') {}

  private start(): Promise<void> {
    if (this.ready) return this.ready;
    this.ready = new Promise<void>((resolve, reject) => {
      try {
        const w = new Worker(this.url);
        this.worker = w;
        const timer = setTimeout(() => reject(new Error('engine start timeout')), 8000);
        w.onmessage = (e: MessageEvent<string>) => {
          const line = String(e.data);
          if (line === 'readyok') {
            clearTimeout(timer);
            resolve();
          } else this.onLine(line);
        };
        w.onerror = (e) => {
          clearTimeout(timer);
          reject(new Error(e.message || 'engine worker error'));
        };
        w.postMessage('uci');
        w.postMessage('isready');
      } catch (e) {
        reject(e as Error);
      }
    }).catch((e) => {
      console.warn('[chess-break] Stockfish unavailable, using fallback bot:', e);
      this.failed = true;
    });
    return this.ready;
  }

  private onLine(line: string) {
    const p = this.pending;
    if (!p) return;
    if (line.startsWith('info') && line.includes(' pv ')) {
      const t = line.split(' ');
      const mpv = Number(t[t.indexOf('multipv') + 1] || 1);
      const si = t.indexOf('score');
      const score = t[si + 1] === 'mate' ? Math.sign(Number(t[si + 2])) * 100000 : Number(t[si + 2]);
      p.lines.set(mpv, { uci: t[t.indexOf('pv') + 1], score });
    } else if (line.startsWith('bestmove')) {
      this.pending = undefined;
      p.resolve(line.split(' ')[1]);
      // Stash lines for slack-move selection on the resolved promise's consumer.
      this.lastLines = [...p.lines.values()];
    }
  }

  private lastLines: { uci: string; score: number }[] = [];

  /** Searches run one at a time: the engine answers with a bare `bestmove`, so overlapping searches would swap results. */
  private chain: Promise<unknown> = Promise.resolve();

  /** Best move for the side to move in `fen` at the given bot level. */
  bestMove(fen: string, level: BotLevel | number): Promise<string> {
    // A search still running was superseded (undo, new game): hurry it along so this one starts sooner.
    if (this.pending) this.worker?.postMessage('stop');
    const run = this.chain.then(() => this.search(fen, level));
    this.chain = run.catch(() => undefined);
    return run;
  }

  private async search(fen: string, level: BotLevel | number): Promise<string> {
    await this.start();
    if (this.failed || !this.worker) return fallbackMove(fen);
    const cfg = levelConfig(level);
    const w = this.worker;
    this.lastLines = []; // never let a previous position's lines leak into this move's slack pick
    const best = await new Promise<string>((resolve) => {
      // A worker that never answers must not freeze the game: give up, restart it next time, use the fallback bot.
      const timer = setTimeout(() => {
        if (this.pending !== entry) return;
        console.warn('[chess-break] Stockfish did not answer in time, using the fallback bot.');
        this.pending = undefined;
        this.dispose();
        resolve('');
      }, cfg.movetime + SEARCH_GRACE_MS);
      const entry: Pending = {
        resolve: (uci) => {
          clearTimeout(timer);
          resolve(uci);
        },
        lines: new Map(),
      };
      this.pending = entry;
      w.postMessage('ucinewgame');
      w.postMessage(`setoption name Skill Level value ${cfg.skill}`);
      w.postMessage(`setoption name MultiPV value ${cfg.multipv}`);
      w.postMessage(`position fen ${fen}`);
      w.postMessage(`go depth ${cfg.depth} movetime ${cfg.movetime}`);
    });
    if (cfg.slack > 0 && Math.random() < cfg.slack) {
      // Beginner bot: sometimes play a weaker-but-reasonable alternative (within 3 pawns of best, never allowing mate).
      const top = this.lastLines.reduce((a, b) => Math.max(a, b.score), -Infinity);
      const alts = this.lastLines.filter((l) => l.uci !== best && l.score > -50000 && top - l.score < 300);
      if (alts.length) return alts[Math.floor(Math.random() * alts.length)].uci;
    }
    return best && best !== '(none)' ? best : fallbackMove(fen);
  }

  stop() {
    this.worker?.postMessage('stop');
  }

  dispose() {
    this.worker?.terminate();
    this.worker = undefined;
    this.ready = undefined;
  }
}

const VALUE: Record<string, number> = { p: 100, n: 300, b: 310, r: 500, q: 900, k: 0 };

function material(c: Chess): number {
  let s = 0;
  for (const row of c.board()) for (const p of row) if (p) s += (p.color === c.turn() ? 1 : -1) * VALUE[p.type];
  return s;
}

/** 2-ply material search: never the main path, just keeps the game playable if WASM fails. */
export function fallbackMove(fen: string): string {
  const c = new Chess(fen);
  let best = '';
  let bestScore = -Infinity;
  for (const m of c.moves({ verbose: true })) {
    c.move(m);
    let score: number;
    if (c.isCheckmate()) score = 1e6;
    else if (c.isDraw()) score = 0;
    else {
      let worst = Infinity;
      for (const r of c.moves({ verbose: true })) {
        c.move(r);
        const s = c.isCheckmate() ? -1e6 : material(c);
        c.undo();
        worst = Math.min(worst, s);
      }
      score = worst + Math.random() * 10;
    }
    c.undo();
    if (score > bestScore) {
      bestScore = score;
      best = m.from + m.to + (m.promotion ?? '');
    }
  }
  return best;
}
