# Chess Break

A chess trainer and game for five-minute breaks, built as a Chrome extension (Manifest V3).
Works with **no account, no chess site, and no internet**.

> Open the extension, solve a chess challenge or play a few moves against the computer, then get back to work.

## Features

The app has four tabs: **Today** (what to do now, by how long you have), **Puzzles**, **Play** and **Progress**. Every game wears a tag: *Puzzle*, *Timed*, *Vs computer* or *Learn*.

| Game | Tab | What it is |
|---|---|---|
| **Checkmate Challenge** | Puzzles | Mate in 1 / 2 / 3 on a real board. The opponent replies on its own. Hints come in steps (which piece, then the idea, then the move). After you solve it, you get a short explanation. |
| **Daily Puzzle** | Puzzles | One puzzle per calendar day, the same for everyone. Mon–Tue Mate in 1, Wed–Thu Mate in 2, Fri–Sat Mate in 3, Sun Tricky. |
| **Puzzle Rush** | Puzzles | Solve as many puzzles as you can in 3 minutes, with 3 strikes allowed. Tracks your best score for the day and all-time. The clock pauses when the popup closes. |
| **Ghost Race** | Puzzles | 90 seconds on the same puzzles. A ghost replays your best run, so you can see whether you are ahead. |
| **Streak** | Puzzles | No clock. Puzzles get harder one by one and your first wrong move ends the run. |
| **Coordinates** | Puzzles | A 30-second drill: tap the named square on an empty board. |
| **Themes** | Puzzles | Ten tactical patterns (fork, pin, back-rank mate…). Solve 10 puzzles of a pattern to master it. |
| **Quick Game** | Play | A full game from the starting position against Stockfish: pick White, Black or Random and one of 8 levels. |
| **Win the Endgame** | Play | Start from a winning position and beat Stockfish, set to Beginner or Intermediate. Includes undo, resign, and a move-by-move review. |
| **Endgame Lessons** | Play | Four guided mates (K+Q, K+R, two rooks, two bishops) with steps to follow and the computer defending. |
| **Learn the Pieces** | Play | Six drills: move one piece to capture every pawn. Stars for finishing in the fewest moves. |
| **Progress** | Progress | Streak (with an optional streak freeze), totals by category, first-try accuracy, a 7-day chart, weekly growth, badges and a list of mistakes to retry. You can export, import or reset your data. |
| **Options** | (gear icon) | Board and piece themes, light/dark/auto, legal-move dots, coordinates, auto-queen, click/drag input, orientation, hint style, coach verbosity, colorblind-safe palette, large print and reduced motion. A live board preview shows your changes. |

**Trust rules:** the checker accepts *every* move that keeps a forced mate, not just one stored line. Nothing leaves the device. The extension asks for `storage`, `sidePanel`, `activeTab` and `scripting`; site access is requested only if you turn on the optional corner button.

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
| `npm run verify-positions` | Confirm every Win-the-Endgame start is winning, using Stockfish depth 20 |
| `npm run lichess-import -- <csv> [--per-n 1200]` | Puzzle pipeline (see below) |
| `npm run build-curated` | Rebuild the curated starter set |
| `npm run icons` | Regenerate toolbar icons |
| `npm run engine` | Re-copy the Stockfish lite WASM build from `node_modules` |
| `npm run package` | Zip `dist/` into `chess-break.zip` (works on Windows, macOS and Linux) |
| `npm run release` | Verify puzzles, test, build, then package for the Web Store |

## Architecture

```
src/
  app/          shared app (in-page window, popup, side panel): router, screens (today, puzzles, play, puzzle, rush/ghost, streak, coords, themes, quick, game, lessons, learn, progress), plus catalog.ts (one place for game names, rules and times)
  background/   service worker: toolbar click / Alt+Shift+C → in-page window (popup, then side panel, as fallback)
  content/      in-page window shell (genie open/close, resizable) and the optional corner button
  shell/        pure helpers for the window: genie geometry, corner point, style pinning, focus trap
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

Themes use the tags already on each puzzle. Current library: 3,600 verified puzzles plus 35 curated ones (801 easy · 1,261 medium · 1,411 hard · 127 tricky).

## Licensing

This project is GPL-3.0-or-later, because it bundles GPL-3.0 components: chessground, chessops and Stockfish.
chess.js is BSD-2-Clause. Puzzles come from the Lichess puzzle database (CC0), and each imported puzzle keeps its Lichess id in `src`.
