import '../ui/styles.css';
import './options.css';
import { exportData, importData, resetData } from '../storage/backup';
import { DEFAULT_SETTINGS, loadSettings, onSettingsChange, saveSettings, type BoardTheme, type PieceSet, type Settings } from '../storage/settings';
import { Board } from '../ui/board';
import { clear, h, toast } from '../ui/dom';
import { BOARD_THEMES, PIECE_SETS, applyTheme, boardSvg, watchSystemTheme } from '../ui/themes';

type Tab = 'appearance' | 'board' | 'learning' | 'accessibility' | 'data';
const TABS: [Tab, string][] = [
  ['appearance', '🎨 Appearance'],
  ['board', '♟ Board'],
  ['learning', '💡 Learning'],
  ['accessibility', '♿ Accessibility'],
  ['data', '🔒 Data'],
];

// A position that shows off last-move highlight, coordinates, check and legal-move dots.
const PREVIEW = { fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4', lastMove: 'g8f6' };

async function main() {
  let s = await loadSettings();
  applyTheme(s);
  watchSystemTheme(() => s);

  const previewHost = h('div.preview');
  const panel = h('div.panel');
  const tabBar = h('nav.tabs', { role: 'tablist' });
  document.body.append(
    h(
      'div.options',
      null,
      h('header.opt-head', null, h('img', { src: 'icons/icon-48.png', alt: '' }), h('div', null, h('h1', null, 'Chess Break settings'), h('p', null, 'Changes save instantly and apply everywhere.'))),
      h('div.opt-body', null, h('aside.preview-col', null, h('div.section-title', null, 'Live preview — try a move'), previewHost), h('div.settings-col', null, tabBar, panel)),
    ),
  );

  const board = new Board(previewHost, s);
  const resetPreview = () =>
    board.set({ fen: PREVIEW.fen, orientation: 'white', movable: 'white', lastMove: PREVIEW.lastMove });
  board.onMove = () => setTimeout(resetPreview, 900);
  resetPreview();

  async function update(p: Partial<Settings>) {
    s = { ...s, ...p };
    await saveSettings(s);
    applyTheme(s);
    board.applySettings(s);
    resetPreview();
    renderTab(current);
  }

  // ---- controls ----
  const row = (label: string, desc: string | null, control: HTMLElement) =>
    h('div.opt-row', null, h('div', null, h('div.opt-label', null, label), desc ? h('div.opt-desc', null, desc) : null), control);

  const toggle = (key: keyof Settings, label: string, desc: string | null = null) =>
    row(
      label,
      desc,
      h('input.switch', {
        type: 'checkbox',
        role: 'switch',
        'aria-label': label,
        checked: Boolean(s[key]),
        onchange: (e: Event) => void update({ [key]: (e.target as HTMLInputElement).checked } as Partial<Settings>),
      }),
    );

  function seg<K extends keyof Settings>(key: K, label: string, options: [Settings[K], string][], desc: string | null = null) {
    const g = h('div.seg', { role: 'group', 'aria-label': label });
    for (const [v, text] of options) g.append(h('button', { 'aria-pressed': String(s[key] === v), onclick: () => void update({ [key]: v } as Partial<Settings>) }, text));
    return row(label, desc, g);
  }

  function swatches(key: 'boardTheme' | 'boardThemeDark', label: string) {
    const g = h('div.swatches', { role: 'group', 'aria-label': label });
    for (const [id, t] of Object.entries(BOARD_THEMES) as [BoardTheme, (typeof BOARD_THEMES)[BoardTheme]][]) {
      g.append(
        h(
          'button.swatch',
          { 'aria-pressed': String(s[key] === id), title: t.name, 'aria-label': t.name, onclick: () => void update({ [key]: id }) },
          h('span.sw', { style: `background-image:${boardSvg(t.light, t.dark)};background-size:50%` }),
          h('span.sw-name', null, t.name),
        ),
      );
    }
    return h('div.opt-block', null, h('div.opt-label', null, label), g);
  }

  let current: Tab = (location.hash.slice(1) as Tab) || 'appearance';
  if (!TABS.some(([t]) => t === current)) current = 'appearance';

  function renderTabs() {
    clear(tabBar);
    for (const [id, label] of TABS) {
      tabBar.append(h('button.tab', { role: 'tab', 'aria-selected': String(id === current), onclick: () => { current = id; location.hash = id; renderTabs(); renderTab(id); } }, label));
    }
  }

  function renderTab(tab: Tab) {
    clear(panel);
    switch (tab) {
      case 'appearance':
        panel.append(
          swatches('boardTheme', 'Board theme (light mode)'),
          swatches('boardThemeDark', 'Board theme (dark mode)'),
          seg('pieceSet', 'Piece set', (Object.entries(PIECE_SETS) as [PieceSet, string][]).map(([k, v]) => [k, v])),
          seg('appTheme', 'App theme', [['light', '☀️ Light'], ['dark', '🌙 Dark'], ['auto', '🖥 Auto']]),
        );
        break;
      case 'board':
        panel.append(
          toggle('legalDots', 'Show legal-move dots'),
          toggle('lastMove', 'Highlight last move'),
          toggle('coords', 'Show coordinates'),
          toggle('autoQueen', 'Auto-promote to queen', 'Off: you choose the piece (needed for underpromotion puzzles).'),
          seg('moveInput', 'Move input', [['click', 'Click'], ['drag', 'Drag'], ['both', 'Both']]),
          seg('orientation', 'Board orientation', [['mine', 'My side at bottom'], ['white', 'Always White at bottom']], 'You can always flip mid-game with ⇅.'),
        );
        break;
      case 'learning':
        panel.append(
          seg('hintStyle', 'Hint style', [['gradual', 'Gradual (piece → idea → move)'], ['instant', 'Instant (show the move)']]),
          seg('coach', 'Coach explanations', [['verbose', 'Detailed'], ['minimal', 'Short']]),
          toggle('streakFreeze', 'Streak freeze', 'Miss a single day without losing your streak. Earned back after a week of play.'),
          toggle('showRating', 'Show my puzzle rating', 'A private estimate on the Progress screen. Hidden by default.'),
        );
        break;
      case 'accessibility':
        panel.append(
          toggle('colorblind', 'Colorblind-safe colors', 'Blue/orange feedback and highlights instead of green/red.'),
          toggle('large', 'Larger pieces and text'),
          seg('reduceMotion', 'Reduce motion', [['auto', 'Follow system'], ['on', 'On'], ['off', 'Off']]),
          toggle('sound', 'Sounds'),
          h('p.opt-desc', null, 'Keyboard: press ⌨️ in the popup to type moves (e.g. Qh5 or e2e4). All controls are reachable with Tab.'),
        );
        break;
      case 'data':
        panel.append(
          h('p', null, '🔒 Chess Break has no account and sends nothing anywhere. Your progress lives only in this browser.'),
          h(
            'div.btn-row',
            null,
            h('button.btn', { onclick: () => void exportData() }, '⬇ Export progress'),
            h(
              'button.btn',
              {
                onclick: async () => {
                  try {
                    if (await importData()) {
                      s = await loadSettings();
                      update({});
                      toast('Progress imported ✓', 'good');
                    }
                  } catch (e) {
                    toast((e as Error).message, 'warn', 3500);
                  }
                },
              },
              '⬆ Import',
            ),
            h(
              'button.btn',
              {
                onclick: async () => {
                  if (await resetData()) {
                    s = { ...DEFAULT_SETTINGS };
                    update({});
                    toast('Everything has been reset.');
                  }
                },
              },
              '🗑 Reset everything',
            ),
          ),
          h('div.section-title', null, 'About'),
          h(
            'p.opt-desc',
            null,
            'Puzzles: Lichess puzzle database (CC0). Engine: Stockfish (GPLv3). Board: chessground (GPLv3). Rules: chess.js. Permissions used: storage (save your progress) and side panel (longer games).',
          ),
        );
        break;
    }
  }

  // Changes made from another surface (e.g. the popup's sound toggle).
  onSettingsChange((ns) => {
    if (JSON.stringify(ns) === JSON.stringify(s)) return;
    s = ns;
    applyTheme(s);
    board.applySettings(s);
    resetPreview();
    renderTab(current);
  });

  renderTabs();
  renderTab(current);
}

void main();
