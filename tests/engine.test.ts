import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Chess } from 'chess.js';
import { Engine } from '../src/engine/engine';
import { START_FEN } from '../src/game/gameSession';

/** A stand-in for the Stockfish worker: answers each `go` after a delay, with a move tagged by its position. */
class FakeWorker {
  static delays: number[] = [];
  static silent = false;
  static instances = 0;
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  private fen = '';
  private timer?: ReturnType<typeof setTimeout>;
  constructor() {
    FakeWorker.instances++;
  }
  private say(data: string) {
    queueMicrotask(() => this.onmessage?.({ data }));
  }
  postMessage(msg: string) {
    if (msg === 'isready') this.say('readyok');
    else if (msg.startsWith('position fen ')) this.fen = msg.slice('position fen '.length);
    else if (msg === 'stop') {
      if (this.timer) {
        clearTimeout(this.timer);
        this.timer = undefined;
        this.say(`bestmove ${this.moveFor(this.fen)}`);
      }
    } else if (msg.startsWith('go') && !FakeWorker.silent) {
      const fen = this.fen;
      this.timer = setTimeout(() => {
        this.timer = undefined;
        this.say(`bestmove ${this.moveFor(fen)}`);
      }, FakeWorker.delays.shift() ?? 10);
    }
  }
  /** First legal move: different positions give different answers. */
  private moveFor(fen: string) {
    const m = new Chess(fen).moves({ verbose: true })[0];
    return m.from + m.to;
  }
  terminate() {
    clearTimeout(this.timer);
  }
}

const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
const first = (fen: string) => {
  const m = new Chess(fen).moves({ verbose: true })[0];
  return m.from + m.to;
};

beforeEach(() => {
  FakeWorker.delays = [];
  FakeWorker.silent = false;
  FakeWorker.instances = 0;
  vi.stubGlobal('Worker', FakeWorker);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('Engine', () => {
  it('answers overlapping searches each with their own position', async () => {
    FakeWorker.delays = [80, 10]; // the first (stale) search is slow, the second fast
    const engine = new Engine();
    const stale = engine.bestMove(START_FEN, 1);
    await new Promise((r) => setTimeout(r, 20)); // the first search is now running
    const fresh = engine.bestMove(AFTER_E4, 1);
    const [a, b] = await Promise.all([stale, fresh]);
    expect(a).toBe(first(START_FEN));
    expect(b).toBe(first(AFTER_E4));
    expect(b).not.toBe(a);
  });

  it('falls back to a legal move when the engine never answers', async () => {
    vi.useFakeTimers();
    FakeWorker.silent = true;
    const engine = new Engine();
    const p = engine.bestMove(START_FEN, 'beginner');
    await vi.advanceTimersByTimeAsync(10_000);
    const move = await p;
    const legal = new Chess(START_FEN).moves({ verbose: true }).map((m) => m.from + m.to);
    expect(legal).toContain(move);
  });

  it('restarts the worker after a hang and keeps working', async () => {
    vi.useFakeTimers();
    FakeWorker.silent = true;
    const engine = new Engine();
    const hung = engine.bestMove(START_FEN, 1);
    await vi.advanceTimersByTimeAsync(10_000);
    await hung;
    FakeWorker.silent = false;
    const ok = engine.bestMove(AFTER_E4, 1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(await ok).toBe(first(AFTER_E4));
    expect(FakeWorker.instances).toBe(2);
  });
});
