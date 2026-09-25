# Chess Break

A chess trainer and game for five-minute breaks, built as a Chrome extension (Manifest V3).
Works with **no account, no chess site, and no internet**.

> Open the extension, solve a chess challenge or play a few moves against the computer, then get back to work.

## Features

| Mode | What it is |
|---|---|
| **Checkmate Challenge** | Mate in 1 / 2 / 3 on a real board. The opponent replies on its own. Hints come in steps (which piece, then the idea, then the move). After you solve it, you get a short explanation. |
| **Daily Challenge** | One puzzle per calendar day, the same for everyone. Mon–Tue Mate in 1, Wed–Thu Mate in 2, Fri–Sat Mate in 3, Sun Tricky. |
| **Finish the Position** | Start from a winning position and beat Stockfish, set to Beginner or Intermediate. Includes undo, resign, and a move-by-move review. |
| **Puzzle Rush** | Solve as many puzzles as you can in 3 minutes, with 3 strikes allowed. Tracks your best score for the day and all-time. The clock pauses when the popup closes. |
| **Progress** | Streak (with an optional streak freeze), totals by category, first-try accuracy, a 7-day chart, weekly growth, badges and a list of mistakes to retry. You can export, import or reset your data. |
| **Options** | Board and piece themes, light/dark/auto, legal-move dots, coordinates, auto-queen, click/drag input, orientation, hint style, coach verbosity, colorblind-safe palette, large print and reduced motion. A live board preview shows your changes. |

**Trust rules:** the checker accepts *every* move that keeps a forced mate, not just one stored line. Nothing leaves the device. The extension only asks for the `storage` and `sidePanel` permissions.

## Getting started

```bash
npm install
npm run build        # → dist/
```

Load it in Chrome: `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select `dist/`.

`npm run preview` serves `dist/` at <http://localhost:4173/popup.html> for quick UI work outside the extension. Storage falls back to `localStorage` there.

| Script | Purpose |
|---|---|
| `npm run build` | Typecheck and build `dist/` |
| `npm run dev` | Rebuild on change (reload the extension to pick it up) |
| `npm test` | Unit tests: solver, puzzle checker, rules edge cases, streaks, data |
| `npm run verify-puzzles` | Re-verify every bundled puzzle with the exact mate solver (~35 s) |
| `npm run verify-positions` | Confirm every Finish-the-Position start is winning, using Stockfish depth 20 |
| `npm run lichess-import -- <csv> [--per-n 1200]` | Puzzle pipeline (see below) |
| `npm run build-curated` | Rebuild the curated starter set |
| `npm run icons` | Regenerate toolbar icons |
| `npm run engine` | Re-copy the Stockfish lite WASM build from `node_modules` |
| `npm run release` | Verify, test, build, and write `chess-break.zip` for the Web Store |

## Architecture

```
src/
  app/          shared popup + side-panel app: router, screens (home, puzzle, rush, game, progress)
  game/         mateSolver (chessops bitboards), puzzleSession, gameSession, explain/hints, puzzles
  engine/       Stockfish Web-Worker wrapper + strength caps + JS fallback bot
  progress/     streaks, badges, stats (pure functions, unit-tested)
  storage/      chrome.storage.local wrapper, settings, export/import
  ui/           board (chessground + chess.js), themes, sounds (WebAudio), styles
  options/      Options page with live preview
  data/         curated.json, puzzles.json (library), positions.json
scripts/        Lichess pipeline, verifiers, curated builder, icon generator
public/         manifest.json, engine/ (Stockfish JS+WASM), icons/
```

- **Rules and UI** use chess.js. **Mate search** uses chessops, because chess.js builds SAN and FEN for every generated move, which made mate-in-3 checks about 130× slower.
- **Puzzle checking** works like this: a move is correct if the defender is still lost within the remaining moves. The reply is the defence that holds out longest, preferring the reference line.
- **Every move is autosaved**: puzzle, game and rush state, plus the last screen. Reopening the popup resumes exactly where you left off.
- **Stockfish 19 lite (single-threaded WASM, 1.8 MB)** is bundled locally. It needs `'wasm-unsafe-eval'` in the extension CSP and loads no code at runtime.

## Puzzle pipeline

1. Download `lichess_db_puzzle.csv.zst` from <https://database.lichess.org/#puzzles> (CC0). A slice is enough, because rows come in random order.
2. Decompress it (`zstd -d`, or Node's `zlib.createZstdDecompress` after skipping the 12-byte skippable frame).
3. `npm run lichess-import -- lichess_db_puzzle.csv --per-n 1200` does the following:
   - filters to mate-in-1/2/3 with popularity ≥ 88, ≥ 800 plays, and a stable rating;
   - replays each line and re-verifies it with the solver: mate in *exactly* N, and a unique first move for Mate in 2/3;
   - tags the tier: Easy/Medium/Hard from mate length and rating, and Tricky for quiet first moves, underpromotion or a queen sacrifice.
4. Run `npm run build-curated`, then `npm run verify-puzzles`.

Current library: 3,600 verified puzzles plus 35 curated ones (801 easy · 1,261 medium · 1,411 hard · 127 tricky).

## Licensing

This project is GPL-3.0-or-later, because it bundles GPL-3.0 components: chessground, chessops and Stockfish.
chess.js is BSD-2-Clause. Puzzles come from the Lichess puzzle database (CC0), and each imported puzzle keeps its Lichess id in `src`.
