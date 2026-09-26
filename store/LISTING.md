# Chrome Web Store listing (draft)

**Name:** Chess Break — Checkmate Trainer
**Category:** Games (or Education)
**Short description (≤132 chars):**
Five-minute chess breaks: Mate in 1-2-3 puzzles, a daily challenge, Puzzle Rush and a local bot. Offline, no account.

## Description

Take a real chess break without leaving your browser.

♟ **Checkmate Challenge**: Mate in 1, 2 and 3, from easy to tricky. Every correct move counts, not just the one in the answer key.
📅 **Daily Challenge**: a new puzzle every day. Build your streak 🔥
⚡ **Puzzle Rush**: 3 minutes, 3 strikes. Try to beat your personal best.
♔ **Finish the Position**: start from a winning position and convert it against the computer (Beginner or Intermediate).
💡 **Hints and coaching**: hints come in steps (piece → idea → move), and you get a short explanation after every solve.
📈 **Your progress**: streaks, badges, weekly growth, and your mistakes saved for a retry.
🎨 **Make it yours**: 6 board themes, 4 piece styles, light and dark mode, colorblind-safe colours, large print, reduced motion and keyboard move input.

🔒 **Private by design**: no account and no internet needed. Nothing leaves your device.
It never reads or interferes with games on chess websites.

Puzzles come from the Lichess puzzle database (CC0). Engine: Stockfish.

## Permission justifications

- **storage**: saves progress, settings and the current puzzle or game locally, so closing the popup never loses your place.
- **activeTab + scripting**: clicking the icon shows Chess Break as a floating window over the current tab. The script is injected only into the tab the user clicked, and the app itself runs in an isolated extension frame.
- **sidePanel**: fallback surface on browser pages where the floating window can't be injected.
- **Optional host access (<all_urls>)**: requested only if the user turns on the quick-open corner button in Settings. The button script reads nothing from pages.

## Single purpose

A self-contained chess puzzle trainer and practice game.

## Screenshots to capture (1280×800)

1. Popup home (streak, daily challenge)
2. A Mate in 2 mid-solve with a hint arrow
3. Solved screen with explanation
4. Puzzle Rush with the timer and strikes
5. Finish the Position in the side panel
6. Options page with the live preview
