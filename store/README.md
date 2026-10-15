# Chrome Web Store: what to upload and where

Everything the store asks for is in this folder, already at the right size.
Open the **Developer Dashboard → your item → Store listing**, and use this table.

## Pictures

| Dashboard field | File | Size | Required? |
|---|---|---|---|
| Store icon | `assets/store-icon-128x128.png` | 128 × 128 (artwork 96 × 96 + 16 px clear border) | Yes |
| Screenshots (add in this order, up to 5) | `screenshots/01-today.png` … `05-learn.png` | 1280 × 800 | Yes, at least 1 |
| Small promo tile | `assets/promo-small-440x280.png` | 440 × 280 | Yes |
| Marquee promo tile | `assets/promo-marquee-1400x560.png` | 1400 × 560 | Optional (needed to be featured) |
| Promo video | a YouTube link | 30–60 seconds | Optional |

The extension's own icons (16, 32, 48, 128) are inside the build (`public/icons/`) and need no upload.

### What each screenshot shows

| # | File | Message |
|---|---|---|
| 1 | `01-today.png` | Pick how long you have (1, 3 or 10 minutes) |
| 2 | `02-puzzles.png` | Puzzles, your way |
| 3 | `03-in-page-window.png` | Opens on top of any page (the real way people use it) |
| 4 | `04-quick-game.png` | A full game against the computer |
| 5 | `05-learn.png` | Learn as you play |

Suggested alt text or caption for each is the headline above.

## Text

Copy these from [LISTING.md](LISTING.md):
- **Name:** Chess Break
- **Summary** (the manifest description, 121 characters, limit 132)
- **Description**
- **Category:** Games (or Education)
- **Single purpose** and the **permission justifications** (the Privacy tab)

## Links and contact (you must fill these in)

- **Support email:** _not set yet_. Needed in the dashboard and in `PRIVACY.md`.
- **Privacy policy URL:** host the text of `PRIVACY.md` at a public web address and paste the link.
- **Homepage / source:** https://github.com/chkrishnamurthy/chess-ext

## Upload

1. Run `npm run release` and take `chess-break.zip` from the project folder.
2. Dashboard → **Package** → upload the zip (version 0.2.0).
3. Fill in the Store listing, Privacy and Distribution tabs.
4. Suggested first release: **Unlisted**, test it, then change to **Public**.

## Re-making the pictures

The screenshots and tiles were produced from the real, built app, so rebuild first
(`npm run build`) if the design changes. The extension icons come from `npm run icons`.
