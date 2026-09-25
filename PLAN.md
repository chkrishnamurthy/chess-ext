# Chess Break — Master Plan
*(Working name — final name TBD)*

A self-contained chess trainer & game for short breaks, built as a Chrome extension.
Works with **no account, no Chess.com/Lichess, and no internet**.

**Core promise:** *Open the extension, solve a chess challenge or play a few moves against the computer, then return to your work.*

**Product direction:** Build "a chess game for a five-minute break," centred on Mate in 1 → 2 → 3, Finish the Position, and one daily-return hook. Its advantage is **instant play, clear teaching, and reliable progress** — not a long feature list.

---

## 1. Decisions locked in

| Topic | Decision |
|---|---|
| Delivery | Build the **entire application**. Phases are an internal build order, not staggered public releases. |
| Puzzles | **Curated verified set first**, then a Lichess CC0 preprocessing pipeline for a larger library. |
| Doc | Full master plan (this file) + shareable artifact. |
| Audience | Global users. |
| Libraries | **chess.js** (rules) · **chessground** (board) · **stockfish.js / WASM** (bot). |
| Name | "Chess Break" (tentative). |
| Account | None. All data local. Offline-first. |

---

## 2. Who it's for

- **Beginners** learning checkmate patterns.
- **Intermediate players** wanting short tactical practice.
- **Anyone** who wants a quick chess game during a work or study break.

---

## 3. Modes

### A. Checkmate Challenge *(core)*
- Choose **Mate in 1 / 2 / 3**.
- Move on a real interactive board; opponent responds automatically.
- Verify the chosen move preserves the forced mate.
- After solving, explain the key idea + the opponent's defense.
- Gradual hint reveal (see §7).
- **Daily challenge** + **unlimited practice**.

### B. Finish the Position *(differentiator)*
- Start from a favourable position; play the bot to checkmate / draw / resignation.
- Teaches converting an advantage into a finished game.
- Beginner + intermediate bot difficulty.
- Autosave after every move.

### C. Blitz Puzzle Rush *(the daily-return hook)*
- Solve as many puzzles as possible in **3 minutes**, 3 strikes and out.
- One personal best to beat each day. Reuses the puzzle DB — cheap to build, strong retention.

### Later (roadmap, not v1)
Guess the Move · One-Move Blunder Check · Endgame in 60s · Spot the Checkmate (timed) · Defend the Draw · Capture Chain · Piece Trainer · Normal game from the start. **No multiplayer in v1.**

---

## 4. Difficulty design (Easy → Tricky)

A single, consistent difficulty ladder across all modes. Every puzzle carries a tier so we can filter, curate, and pace the user.

| Tier | Who it's for | Puzzle characteristics | Bot (Finish the Position) |
|---|---|---|---|
| **Easy** | Absolute beginners | Mate in 1; only 1–2 legal-looking candidate moves; heavy material edge; obvious pattern (back-rank, queen next to king). Large hints available. | Very weak: shallow search, occasional deliberate slack moves, never traps. |
| **Medium** | Improving beginners | Mate in 2; a decoy move exists; common patterns (fork, pin leading to mate, smothered mate setup). | Weak-moderate: plays sound moves, punishes free hangs only. |
| **Hard** | Intermediate | Mate in 3; multiple plausible first moves, only one works; quiet/non-check first move sometimes required. | Moderate: real defense, converts your mistakes, resigns when clearly lost. |
| **Tricky** | Strong intermediate / "gotcha" set | Counter-intuitive first move (underpromotion, quiet move, king walk, stalemate-avoidance, sacrifice). Designed to *look* wrong. Curated separately as a highlight collection. | Same as Hard but chooses the most resilient defense. |

**Content principles for the tiers**
- **Easy must feel winnable** — if beginners lose here, they leave.
- **Tricky is the "wow" set** — a small, hand-picked collection ("Sneaky Mates," "It's Not What You Think"). Great for daily challenge and sharing.
- **Rate & verify every puzzle** — see §6. A wrong difficulty label erodes trust faster than a hard puzzle.
- **Adaptive pacing (later):** nudge users toward the tier where their accuracy sits ~70–80% — hard enough to grow, easy enough to enjoy.

---

## 5. Chrome UX & surfaces

**Popup (toolbar)** — quick puzzles & daily challenge.
- Opens straight to today's challenge or "Continue game."
- One readable board + only essential controls + streak 🔥 + sound toggle + ⚙️ gear.
- Best for puzzles and very short sessions.

**Side panel** — longer bot games.
- More room for game controls; stays open while switching tabs.

**Options page** — full customization (see §8) with a **live board preview**.

**Persistence**
- Save exact board position, move history, puzzle attempt, and settings **after every move**.
- Reopening always resumes at the same position.
- Storage: `chrome.storage.local`.

### First-release screens
```
Home     [Today's Challenge] [Mate in 1] [Mate in 2] [Mate in 3]
         [Finish the Position] [Puzzle Rush] [Continue Game]
         🔥 streak · X solved today

Puzzle   Board · Side to move + objective · Hint | Reset | Next
         Explanation only after solving or requesting the solution

Game     Board · Bot difficulty | New Game | Undo | Resign
         Clear result screen + review moves

Rush     Board · timer · score · strikes ✕✕✕ · end recap

Progress Puzzles solved by category · Rush best · streak · badges
         Recent mistakes to retry · weekly growth · Export/Import/Reset
```

---

## 6. Content & game rules

- Start with a **curated, locally packaged** selection of verified puzzles (~20–40 across tiers for the prototype).
- Then build a **Lichess CC0 puzzle-DB pipeline**: filter → verify → tag difficulty → package as JSON.
- **Mate in N = forced checkmate on the player's Nth move.**
- Accept **every** valid mating move for Mate in 1 (multiple solutions allowed).
- Correctly handle: legal moves, castling, en passant, promotion, checkmate, stalemate, threefold repetition, 50-move, insufficient material.
- Exclude confusing / poorly-rated puzzles from the initial set.
- Keep solutions hidden until solved or given up.

**Puzzle verification pipeline (build as a script)**
1. Ingest Lichess CC0 rows (FEN, moves, rating, themes).
2. Filter to `mate` themes, sane rating bands, single clear solution where required.
3. Replay each with chess.js + Stockfish to **confirm the mate is forced** in N.
4. Auto-tag tier (Easy/Medium/Hard) from rating + branching factor; hand-pick "Tricky."
5. Emit a compact `puzzles.json` bundled with the extension.

---

## 7. Hints, feedback & teaching

- **Gradual hints:** ① which piece to move → ② the target area/idea → ③ the exact move. Never dump the full line first.
- **Encouraging feedback:** "Almost — try again," never a harsh "Wrong." Celebrate solves with a small ✅ + one-line praise (respect reduce-motion).
- **Explanations after solving:** the key idea + why the defense fails.
- **Never mark a correct move wrong** — accept all valid solutions. This is the #1 trust rule.

---

## 8. UI customization (Options page)

Grouped into tabs, with a **live board preview** at top.

**Appearance:** board theme (Classic wood / Green / Blue / Grey-minimal / High-contrast / Dark slate; separate light+dark) · piece set (Standard / Flat / Minimalist-outline / Large-print) · app theme (Light / Dark / Auto).

**Board:** legal-move dots · highlight last move · show coordinates · auto-promote to queen vs ask · move input (click / drag / both) · orientation (my color / auto-flip).

**Learning:** hint style (gradual vs instant) · coach verbosity (verbose vs minimal).

**Accessibility:** colorblind-safe palette · larger pieces/text · reduce-motion.

**Data:** Export progress · Import · Reset.

### Where each control lives (convenience rule: frequent tweaks are one tap away; setup lives in Options)
| Setting | Home |
|---|---|
| Board/piece/app theme, coordinates, hint style, accessibility | Options page |
| Sound on/off | Quick toggle in popup/panel |
| Board flip / orientation | In-board button (needed mid-game) |
| Bot difficulty | On the Game screen |
| Quick theme swatches | Popup footer (optional) |

---

## 9. Scoreboard & motivation *(personal progress, not a global leaderboard)*

**Tracked locally:** daily streak · puzzles solved (total + by Mate in 1/2/3) · Puzzle Rush best · first-try accuracy · optional hidden rating · Finish-the-Position record (W/D/L) · mistakes-to-retry queue.

**Encouraging design**
- Celebrate small wins instantly; never punish harshly.
- Streak is visible (🔥) and gently protectable (one optional "streak freeze").
- Show growth ("12 more than last week") + badges/milestones + filling progress bars.
- Frame as **you vs you** ("New personal best!").
- End every session on a recap high: "Today: 5 solved, 90% accuracy, streak 6 🔥."

**Where it lives:** Home shows streak + today's count; Progress screen shows the full board + Export/Import/Reset; a mini recap card after each session.

---

## 10. Trust principles (critical for global installs)

- **No account, no data leaves the device** — stated on Home + store listing.
- **Users own their data** — Export / Import / Reset in Options.
- **Honest feedback** — accept all correct moves; never a false "wrong."
- **No dark patterns** — no fake urgency, no nagging, no "pay to keep your streak."
- **Minimal permissions** — only `storage` + `sidePanel`, with a plain-language reason.
- **No competitive-integrity risk** — never read Chess.com/Lichess live games or inject move suggestions into any real game.

---

## 11. Technical approach

- **Chrome Manifest V3** extension.
- **TypeScript** UI + build with **Vite**.
- **chess.js** for rules (don't reinvent chess).
- **chessground** for a compact, responsive, touch-friendly board.
- **stockfish.js (WASM)** bundled locally for bot play — **no runtime code download**.
- Local storage via `chrome.storage.local`; fully **offline**.
- Permissions: only `storage`, `sidePanel`.
- Do **not** read live games on chess sites or inject suggestions into competitive play.

### Proposed folder layout
```
chess-ext/
├── manifest.json
├── src/
│   ├── popup/        Home + Puzzle + Rush screens
│   ├── sidepanel/    Game screen
│   ├── options/      Settings + live preview
│   ├── engine/       Stockfish worker wrapper
│   ├── game/         chess.js logic, puzzle checker, difficulty
│   ├── progress/     scoreboard, streak, badges
│   ├── storage/      autosave / resume / export-import
│   ├── ui/           shared components, themes, board config
│   └── data/         puzzles.json
├── scripts/          puzzle preprocessing & verification pipeline
└── public/           stockfish.wasm, icons, sounds
```

---

## 12. Build order (internal phases — one final release)

**Phase 1 — Foundation & puzzles**
- MV3 scaffold (Vite + TS), popup shell, chessground board + chess.js legal moves.
- Mate in 1/2/3 with opponent replies, gradual hints, explanations, autosave.
- Curated verified puzzle set + tier tagging.
- Test board at real popup size.

**Phase 2 — Game & Rush**
- Finish the Position vs local Stockfish (Beginner/Intermediate).
- Blitz Puzzle Rush (timer, strikes, personal best).
- Side panel + resume behavior.

**Phase 3 — Progress, settings & polish**
- Progress screen (streak, badges, by-category, retry mistakes, weekly growth).
- Options page (all §8 settings + live preview) + Export/Import/Reset.
- Sounds, animations, reduce-motion, colorblind palette.
- Lichess CC0 pipeline → larger verified library.

**Phase 4 — Store prep**
- Real-gameplay screenshots, icons, description as "short chess game + checkmate trainer."
- Privacy policy + support contact, minimal-permission justification.
- QA against Success Criteria (§13); publish free.

---

## 13. Success criteria (first release)

- New user starts a puzzle in **one click**, no signup.
- **Every puzzle completable** through legal board moves.
- Closing/reopening **never** loses the current puzzle or game.
- Popup board usable **without horizontal scrolling**.
- Works **offline**.
- A meaningful share of beta users **returns the following week**.

---

## 14. Research checklist (before/while building)

**Chess correctness**
- chess.js coverage of en passant, promotion (incl. underpromotion), threefold, 50-move, insufficient material — confirm edge cases with tests.
- Confirm "Mate in N is forced" verification approach with Stockfish (depth/mate-search settings).

**Engine in a browser**
- Stockfish WASM build size, load time, and running it in a **Web Worker** so the UI never freezes.
- How to cap strength for Beginner/Intermediate (Skill Level, depth/nodes limits, or move-time).
- MV3 constraints: WASM + workers under strict CSP, no remote code.

**Puzzles**
- Lichess CC0 puzzle DB schema (FEN, moves, rating, themes, popularity), license attribution requirements.
- Difficulty auto-tagging heuristics (rating bands + branching factor); curating a "Tricky" set.

**Chrome platform**
- MV3 popup vs side panel APIs; `sidePanel` permission and open behavior.
- `chrome.storage.local` quotas and shape for board/history/progress.
- Web Store review rules for games, privacy policy requirements.

**UX**
- Minimum comfortable board size in a popup; drag vs click-to-move on small boards.
- Accessibility: colorblind-safe board palettes, keyboard move input, reduce-motion.

**Retention (validation, not vanity)**
- Track return-rate and completed puzzles (locally / privacy-safe) to prove demand before any monetization.

---

## 15. Monetization — only after repeat use is proven

**Always free:** daily challenge · Mate in 1/2/3 · basic bot · local progress.
**Possible paid later:** structured checkmate courses · advanced progress/mistake review · optional cross-device sync · specialised "finish the position" packs.
**Not in the initial build.** Installs alone don't prove demand — repeat use does.
