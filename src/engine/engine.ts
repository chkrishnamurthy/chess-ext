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

  /** Best move for the side to move in `fen` at the given bot level. */
  async bestMove(fen: string, level: BotLevel): Promise<string> {
    await this.start();
    if (this.failed || !this.worker) return fallbackMove(fen);
    const cfg = LEVELS[level];
    const w = this.worker;
    const best = await new Promise<string>((resolve) => {
      this.pending = { resolve, lines: new Map() };
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
