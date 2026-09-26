import '../ui/styles.css';
import './options.css';
import { dayKey, liveStreak, loadProgress } from '../progress/progress';
import { exportData, importData, resetData } from '../storage/backup';
import { DEFAULT_SETTINGS, loadSettings, onSettingsChange, saveSettings, type BoardTheme, type PieceSet, type Settings } from '../storage/settings';
import { Board } from '../ui/board';
import { clear, h, toast } from '../ui/dom';
import { icon, type IconName } from '../ui/icons';
import { BOARD_THEMES, PIECE_SETS, applyTheme, boardSvg, watchSystemTheme } from '../ui/themes';

/**
 * Settings page, laid out like Holdpad's: a sticky header that confirms each change,
 * a section menu that follows the scroll, and one card per topic on a single page.
 * A live board preview stays in view beside the cards.
 */

const SECTIONS: { id: string; label: string; icon: IconName; desc: string }[] = [
  { id: 'appearance', label: 'Appearance', icon: 'palette', desc: 'Colours for the app and the board, and the piece style.' },
  { id: 'board', label: 'Board & moves', icon: 'board', desc: 'What the board shows and how you move pieces.' },
  { id: 'learning', label: 'Learning', icon: 'bulb', desc: 'How hints and the coach help you, and how streaks work.' },
  { id: 'accessibility', label: 'Accessibility', icon: 'access', desc: 'Colours, size, motion and sound.' },
  { id: 'window', label: 'Opening Chess Break', icon: 'pointer', desc: 'How the Chess Break window opens on the page you’re on.' },
  { id: 'data', label: 'Your data', icon: 'download', desc: 'Everything is stored only in this browser. Back it up or move it.' },
  { id: 'privacy', label: 'Privacy', icon: 'shield', desc: 'What Chess Break does and doesn’t do.' },
];

// A position that shows off last-move highlight, coordinates, check and legal-move dots.
const PREVIEW = { fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4', lastMove: 'g8f6' };

const SHORTCUTS: [string, string][] = [
  ['Alt+Shift+C', 'Open or close Chess Break'],
  ['Esc', 'Close the Chess Break window'],
  ['Tab', 'Move between controls (stays inside the window)'],
];

const PRIVACY = [
  'No account, no sign-in, no ads.',
  'Nothing is sent anywhere — puzzles and the chess engine run on your device.',
  'It never reads the pages you visit or your games on other chess sites.',
  'The window only appears on a tab when you click the icon, the shortcut or the corner button.',
  'Site access is asked for only if you turn on the corner button, and removed when you turn it off.',
];

const hasChrome = typeof chrome !== 'undefined' && !!chrome.runtime?.id;

async function main() {
  let s = await loadSettings();
  applyTheme(s);
  watchSystemTheme(() => s);

  /** Every control re-reads the settings through these after a change, so nothing re-renders. */
  const syncers: (() => void)[] = [];
  const syncAll = () => syncers.forEach((f) => f());

  // ---- header ----
  const status = h('div.opt-status', { role: 'status', 'aria-live': 'polite' });
  let statusTimer = 0;
  function say(text: string, kind: 'good' | 'warn' = 'good') {
    status.textContent = text;
    status.className = `opt-status show ${kind}`;
    clearTimeout(statusTimer);
    statusTimer = window.setTimeout(() => status.classList.remove('show'), 2400);
  }
  const header = h(
    'header.opt-top',
    null,
    h(
      'div.opt-top-inner',
      null,
      h('img.opt-logo', { src: 'icons/icon-48.png', alt: '' }),
      h('div.opt-title', null, h('h1', null, 'Chess Break settings'), h('p', null, 'Changes save instantly and apply everywhere.')),
      h('span.spacer'),
      status,
    ),
  );

  // ---- side menu (follows the scroll) ----
  const navLinks = new Map<string, HTMLAnchorElement>();
  const nav = h('nav.opt-nav', { 'aria-label': 'Settings sections' });
  for (const sec of SECTIONS) {
    const a = h('a.opt-nav-link', { href: `#${sec.id}` }, icon(sec.icon, 17), h('span', null, sec.label)) as HTMLAnchorElement;
    navLinks.set(sec.id, a);
    nav.append(a);
  }
  function setCurrent(id: string) {
    for (const [k, a] of navLinks) {
      if (k === id) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    }
  }

  // ---- live preview ----
  const previewHost = h('div.opt-preview-board');
  const preview = h(
    'aside.opt-preview',
    { 'aria-label': 'Live preview' },
    h('div.opt-preview-head', null, h('span', null, 'Live preview'), h('button.link', { onclick: () => resetPreview() }, 'Reset')),
    previewHost,
    h('p.opt-hint', null, 'Try a move — every change shows up here straight away.'),
  );

  const main = h('main.opt-main');
  document.body.append(header, h('div.opt-shell', null, nav, preview, main));

  const board = new Board(previewHost, s);
  const resetPreview = () => board.set({ fen: PREVIEW.fen, orientation: 'white', movable: 'white', lastMove: PREVIEW.lastMove });
  board.onMove = () => setTimeout(resetPreview, 900);
  resetPreview();

  async function update(p: Partial<Settings>, message = 'Saved ✓') {
    s = { ...s, ...p };
    await saveSettings(s);
    applyTheme(s);
    board.applySettings(s);
    resetPreview();
    syncAll();
    say(message);
  }

  // ---- building blocks ----
  function card(id: string, ...children: (Node | string | null)[]) {
    const sec = SECTIONS.find((x) => x.id === id)!;
    return h(
      'section.opt-card',
      { id, 'aria-labelledby': `${id}-title` },
      h('header.opt-card-head', null, h('span.opt-card-icon', null, icon(sec.icon, 18)), h('div', null, h('h2', { id: `${id}-title` }, sec.label), h('p', null, sec.desc))),
      ...children,
    );
  }

  const rowText = (label: string, desc: string | null) => h('span.set-text', null, h('span.set-label', null, label), desc ? h('span.set-desc', null, desc) : null);

  /** A whole-row switch: clicking the text toggles it too. */
  function toggle(key: keyof Settings, label: string, desc: string | null = null) {
    const input = h('input.switch', {
      type: 'checkbox',
      role: 'switch',
      onchange: (e: Event) => void update({ [key]: (e.target as HTMLInputElement).checked } as Partial<Settings>),
    }) as HTMLInputElement;
    syncers.push(() => (input.checked = Boolean(s[key])));
    return h('label.set-row', null, rowText(label, desc), input);
  }

  function seg<K extends keyof Settings>(key: K, label: string, options: [Settings[K], string, IconName?][], desc: string | null = null) {
    const g = h('div.seg', { role: 'radiogroup', 'aria-label': label });
    const buttons = options.map(([v, text, ic]) => {
      const b = h('button', { role: 'radio', onclick: () => void update({ [key]: v } as Partial<Settings>) }, ic ? icon(ic, 15) : null, text);
      g.append(b);
      return [v, b] as const;
    });
    syncers.push(() => {
      for (const [v, b] of buttons) {
        b.setAttribute('aria-pressed', String(s[key] === v));
        b.setAttribute('aria-checked', String(s[key] === v));
      }
    });
    return h('div.set-row.stack', null, rowText(label, desc), g);
  }

  function swatches(key: 'boardTheme' | 'boardThemeDark', label: string, desc: string) {
    const g = h('div.swatches', { role: 'radiogroup', 'aria-label': label });
    const items = (Object.entries(BOARD_THEMES) as [BoardTheme, (typeof BOARD_THEMES)[BoardTheme]][]).map(([id, t]) => {
      const b = h(
        'button.swatch',
        { role: 'radio', title: t.name, onclick: () => void update({ [key]: id }) },
        h('span.sw', { style: `background-image:${boardSvg(t.light, t.dark)}` }, h('span.sw-check', null, icon('check', 13))),
        h('span.sw-name', null, t.name),
      );
      g.append(b);
      return [id, b] as const;
    });
    syncers.push(() => {
      for (const [id, b] of items) {
        b.setAttribute('aria-pressed', String(s[key] === id));
        b.setAttribute('aria-checked', String(s[key] === id));
      }
    });
    return h('div.set-row.stack', null, rowText(label, desc), g);
  }

  const group = (...rows: HTMLElement[]) => h('div.set-group', null, ...rows);

  // ---- corner button (needs site access, asked for only when switched on) ----
  function launcherRow() {
    const origins = { origins: ['<all_urls>'] };
    const input = h('input.switch', { type: 'checkbox', role: 'switch' }) as HTMLInputElement;
    const warn = h('span.set-warn', { hidden: true }, 'Site access was removed in Chrome, so the button is off.');
    input.addEventListener('change', () => {
      if (!hasChrome) {
        input.checked = false;
        say('Available once Chess Break is installed', 'warn');
        return;
      }
      // The permission prompt must be the first thing the click does, or Chrome refuses it.
      const ask = input.checked ? chrome.permissions.request(origins) : chrome.permissions.remove(origins).then(() => false);
      void ask
        .catch(() => false)
        .then(async (on) => {
          await update({ showLauncher: on }, on ? 'Corner button added to your open pages ✓' : input.checked ? 'Site access not granted — button stays off' : 'Corner button removed ✓');
          await chrome.runtime.sendMessage({ type: 'launcher-changed' }).catch(() => undefined);
        });
    });
    syncers.push(() => {
      input.checked = s.showLauncher;
      if (hasChrome && s.showLauncher)
        void chrome.permissions.contains(origins).then((ok) => {
          warn.hidden = ok;
          if (!ok) input.checked = false;
        });
      else warn.hidden = true;
    });
    return h(
      'label.set-row',
      null,
      h('span.set-text', null, h('span.set-label', null, 'Quick-open button on web pages'), h('span.set-desc', null, 'A small Chess Break button in the bottom-right corner of pages; the window genies out of it. Chrome will ask to allow access to websites — nothing is read from them.'), warn),
      input,
    );
  }

  function shortcuts() {
    const dl = h('dl.kbd-list');
    for (const [keys, what] of SHORTCUTS) dl.append(h('div', null, h('dt', null, what), h('dd', null, h('kbd', null, keys))));
    return h(
      'div.set-row.stack',
      null,
      rowText('Keyboard shortcuts', 'If Alt+Shift+C clashes with another extension, pick a different one in Chrome.'),
      dl,
      hasChrome ? h('button.btn.small.fit', { onclick: () => void chrome.tabs.create({ url: 'chrome://extensions/shortcuts' }) }, icon('keyboard', 15), 'Change shortcut in Chrome') : null,
    );
  }

  // ---- your data ----
  const stats = h('dl.opt-stats');
  async function renderStats() {
    const p = await loadProgress();
    let bytes = 0;
    try {
      if (hasChrome) bytes = await chrome.storage.local.getBytesInUse(null);
    } catch {
      bytes = 0;
    }
    const tiles: [string, string][] = [
      ['Puzzles solved', String(Object.keys(p.solved).length)],
      ['Day streak', `🔥 ${liveStreak(p, dayKey(), s.streakFreeze)} (best ${p.streak.best})`],
      ['Rush best', String(p.rushBest)],
      ['Stored', bytes ? `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB` : 'on this device'],
    ];
    clear(stats);
    for (const [k, v] of tiles) stats.append(h('div', null, h('dt', null, k), h('dd', null, v)));
  }

  function dataCard() {
    return card(
      'data',
      stats,
      h(
        'div.btn-row.opt-actions',
        null,
        h('button.btn.primary', { onclick: () => void exportData().then(() => say('Backup downloaded ✓')) }, icon('download', 16), 'Export backup'),
        h(
          'button.btn',
          {
            onclick: async () => {
              try {
                if (await importData()) {
                  s = await loadSettings();
                  await update({}, 'Progress imported ✓');
                  void renderStats();
                }
              } catch (e) {
                say((e as Error).message, 'warn');
                toast((e as Error).message, 'warn', 3500);
              }
            },
          },
          icon('upload', 16),
          'Import backup',
        ),
      ),
      h(
        'div.danger-zone',
        null,
        h('span.set-text', null, h('span.set-label', null, 'Reset everything'), h('span.set-desc', null, 'Deletes your progress, streak, badges and settings from this browser. Export a backup first if you might want them back.')),
        h(
          'button.btn.danger',
          {
            onclick: async () => {
              if (await resetData()) {
                s = { ...DEFAULT_SETTINGS };
                await update({}, 'Everything has been reset');
                void renderStats();
              }
            },
          },
          icon('trash', 16),
          'Reset…',
        ),
      ),
    );
  }

  // ---- page ----
  main.append(
    card(
      'appearance',
      group(
        seg('appTheme', 'App theme', [['light', 'Light', 'sun'], ['dark', 'Dark', 'moon'], ['auto', 'Auto', 'monitor']], 'Auto follows your computer’s light/dark setting.'),
        swatches('boardTheme', 'Board in light mode', 'Pick the squares you find easiest to read.'),
        swatches('boardThemeDark', 'Board in dark mode', 'Used whenever the app is dark.'),
        seg('pieceSet', 'Piece set', (Object.entries(PIECE_SETS) as [PieceSet, string][]).map(([k, v]) => [k, v])),
      ),
    ),
    card(
      'board',
      group(
        toggle('lastMove', 'Highlight last move', 'Yellow squares with a ring on the square the piece landed on.'),
        toggle('legalDots', 'Show legal-move dots', 'Dots on the squares the selected piece can move to.'),
        toggle('coords', 'Show coordinates', 'Files a–h and ranks 1–8 along the board edges.'),
        toggle('autoQueen', 'Auto-promote to queen', 'Off: you choose the piece (needed for underpromotion puzzles).'),
        seg('moveInput', 'Move input', [['click', 'Click'], ['drag', 'Drag'], ['both', 'Both']]),
        seg('orientation', 'Board orientation', [['mine', 'My side at bottom'], ['white', 'White at bottom']], 'You can always flip mid-game with ⇅.'),
      ),
    ),
    card(
      'learning',
      group(
        seg('hintStyle', 'Hint style', [['gradual', 'Gradual'], ['instant', 'Instant']], 'Gradual: first the piece, then the idea, then the move. Instant: show the move.'),
        seg('coach', 'Coach explanations', [['verbose', 'Detailed'], ['minimal', 'Short']]),
        toggle('streakFreeze', 'Streak freeze', 'Miss a single day without losing your streak. Earned back after a week of play.'),
        toggle('showRating', 'Show my puzzle rating', 'A private estimate on the Stats screen. Hidden by default.'),
      ),
    ),
    card(
      'accessibility',
      group(
        toggle('colorblind', 'Colourblind-safe colours', 'Blue/orange feedback instead of green/red.'),
        toggle('large', 'Larger pieces and text'),
        seg('reduceMotion', 'Reduce motion', [['auto', 'Follow system'], ['on', 'On'], ['off', 'Off']], 'On: no sliding pieces, and the window fades instead of the genie effect.'),
        toggle('sound', 'Sounds'),
      ),
    ),
    card(
      'window',
      h(
        'p.opt-note',
        null,
        'Click the Chess Break icon (or press the shortcut) and it opens as a floating window on the right of the page you’re on. The page stays usable beside it; drag the window’s left edge to resize. On browser pages like the New Tab page it opens as a popup instead.',
      ),
      group(launcherRow(), shortcuts()),
    ),
    dataCard(),
    card('privacy', h('ul.check-list', null, ...PRIVACY.map((line) => h('li', null, icon('check', 16), h('span', null, line))))),
    h('p.opt-foot', null, 'Puzzles: Lichess puzzle database (CC0). Engine: Stockfish (GPLv3). Board: chessground (GPLv3). Rules: chess.js.'),
  );
  syncAll();
  void renderStats();

  // The menu follows the scroll: the card just under the sticky header is "here".
  const io = new IntersectionObserver(
    (entries) => {
      const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setCurrent(visible[0].target.id);
    },
    { rootMargin: '-90px 0px -55% 0px' },
  );
  for (const sec of SECTIONS) io.observe(document.getElementById(sec.id)!);
  setCurrent(SECTIONS[0].id);

  // Deep links such as options.html#data (from the popup's Stats screen).
  const target = location.hash.slice(1);
  if (target && document.getElementById(target)) {
    setCurrent(target);
    requestAnimationFrame(() => document.getElementById(target)!.scrollIntoView());
  }

  // Changes made from another surface (e.g. the popup's sound toggle).
  onSettingsChange((ns) => {
    if (JSON.stringify(ns) === JSON.stringify(s)) return;
    s = ns;
    applyTheme(s);
    board.applySettings(s);
    resetPreview();
    syncAll();
  });
}

void main();
