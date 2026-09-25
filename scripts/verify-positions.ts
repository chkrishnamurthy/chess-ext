/**
 * Checks every Finish-the-Position start position with Stockfish (same engine the
 * extension bundles): legal, and clearly winning for the side to move.
 *   npm run verify-positions
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { Chess } from 'chess.js';
import type { FinishPosition } from '../src/game/types';

const require = createRequire(import.meta.url);

interface NodeEngine {
  listener?: (line: string) => void;
  sendCommand(cmd: string): void;
  terminate?: () => void;
}

async function main() {
  const init = require('stockfish') as (p: string) => Promise<NodeEngine>;
  const engine = await init('lite-single');
  const positions: FinishPosition[] = JSON.parse(readFileSync('src/data/positions.json', 'utf8'));
  let bad = 0;

  const evaluate = (fen: string) =>
    new Promise<string>((resolve) => {
      let last = '';
      engine.listener = (line) => {
        if (line.startsWith('info') && line.includes(' score ')) last = line.split(' score ')[1].split(' ').slice(0, 2).join(' ');
        if (line.startsWith('bestmove')) resolve(last);
      };
      engine.sendCommand(`position fen ${fen}`);
      engine.sendCommand('go depth 20');
    });

  engine.sendCommand('uci');
  for (const p of positions) {
    try {
      new Chess(p.fen);
    } catch (e) {
      console.error(`✗ ${p.id}: illegal FEN (${(e as Error).message})`);
      bad++;
      continue;
    }
    const score = await evaluate(p.fen);
    const [kind, v] = score.split(' ');
    const winning = kind === 'mate' ? Number(v) > 0 : Number(v) >= 300;
    console.log(`${winning ? '✓' : '✗'} ${p.id.padEnd(12)} ${score}`);
    if (!winning) bad++;
  }
  process.exit(bad ? 1 : 0);
}

main();
