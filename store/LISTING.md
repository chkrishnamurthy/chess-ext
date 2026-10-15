# Chrome Web Store listing (draft)

**Name:** Chess Break
**Category:** Games (or Education)
**Short description (≤132 chars):**
Five-minute chess breaks: checkmate puzzles, Streak, Rush, a full game vs the computer, and lessons. Offline, no account.

## Description

Take a real chess break without leaving your browser.

Pick how long you have (1, 3 or 10 minutes) and get a game that fits.

**Puzzles**
♟ **Mate in 1, 2 and 3**: from easy to tricky. Every correct move counts, not just the one in the answer key.
📅 **Daily Puzzle**: a new puzzle every day. Build your streak 🔥
⚡ **Puzzle Rush**: 3 minutes, 3 strikes. Beat your personal best.
👻 **Ghost Race**: 90 seconds against a ghost of your own best run.
🔁 **Streak**: no clock, keep going until your first miss.
🧭 **Coordinates**: a 30-second drill to learn the board.
🎯 **Themes**: practise forks, pins, back-rank mates and more.

**Play**
♞ **Quick Game**: a full game against the computer, 8 levels, play White or Black.
♔ **Win the Endgame**: start from a winning position and finish the job.
🎓 **Endgame Lessons** and **Learn the Pieces**: step-by-step practice.
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

## Screenshots (1280×800)

Captured from the built app (light theme, popup size) in `store/screenshots/`. Files: 01-today, 02-puzzles, 03-quick-game, 04-themes, 05-ghost-race, 06-learn-pieces.
