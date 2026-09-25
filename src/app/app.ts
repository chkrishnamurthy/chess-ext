import '@fontsource-variable/nunito';
import '../ui/styles.css';
import { Engine } from '../engine/engine';
import { dayKey, liveStreak, loadProgress, saveProgress, type Progress } from '../progress/progress';
import { loadSettings, onSettingsChange, patchSettings, type Settings } from '../storage/settings';
import { KEYS, load, onChange, save } from '../storage/store';
import { clear, h } from '../ui/dom';
import { icon, type IconName } from '../ui/icons';
import { setSoundEnabled } from '../ui/sound';
import { applyTheme, watchSystemTheme } from '../ui/themes';
import type { Ctx, Route, Screen, ScreenHandle } from './context';
import { openOptions } from './nav';
import { gameScreen } from './screens/game';
import { homeScreen } from './screens/home';
import { progressScreen } from './screens/progress';
import { puzzleScreen } from './screens/puzzle';
import { rushScreen } from './screens/rush';

const SCREENS: Record<Route['name'], Screen> = {
  home: homeScreen,
  puzzle: puzzleScreen,
  rush: rushScreen,
  game: gameScreen,
  progress: progressScreen,
};

/** Boots the shared app into the popup or the side panel. */
export async function startApp(surface: Ctx['surface']): Promise<void> {
  document.body.classList.add(surface);
  let settings: Settings = await loadSettings();
  let progress: Progress = await loadProgress();
  applyTheme(settings);
  watchSystemTheme(() => settings);
  setSoundEnabled(settings.sound);

  let engine: Engine | undefined;
  let current: ScreenHandle | undefined;

  const streakEl = h('button.streak-pill', { onclick: () => ctx.go({ name: 'progress' }) });
  const soundBtn = h('button.icon-btn', {
    onclick: async () => {
      settings = await patchSettings({ sound: !settings.sound });
      setSoundEnabled(settings.sound);
      refreshChrome();
    },
  });
  const kbdBtn = h(
    'button.icon-btn',
    {
      title: 'Type moves with the keyboard',
      'aria-label': 'Toggle keyboard move input',
      'aria-pressed': 'false',
      onclick: () => {
        const on = document.body.classList.toggle('show-kbd');
        kbdBtn.setAttribute('aria-pressed', String(on));
        if (on) (document.querySelector('.kbd-input') as HTMLInputElement | null)?.focus();
      },
    },
    icon('keyboard'),
  );
  const main = h('main.screen-host');
  const top = h(
    'header.topbar',
    null,
    h('button.brand', { onclick: () => ctx.go({ name: 'home' }), title: 'Home' }, h('img', { src: 'icons/icon-32.png', alt: '' }), h('span', null, 'Chess Break')),
    h('span.spacer'),
    streakEl,
    kbdBtn,
    soundBtn,
    h('button.icon-btn', { title: 'Settings', 'aria-label': 'Settings', onclick: () => openOptions() }, icon('settings')),
  );

  // Bottom tab bar: every mode is one tap away.
  const TABS: { name: Route['name']; label: string; icon: IconName; route: Route }[] = [
    { name: 'home', label: 'Home', icon: 'home', route: { name: 'home' } },
    { name: 'rush', label: 'Rush', icon: 'zap', route: { name: 'rush' } },
    { name: 'game', label: 'Play', icon: 'crown', route: { name: 'game' } },
    { name: 'progress', label: 'Stats', icon: 'chart', route: { name: 'progress' } },
  ];
  const tabButtons = new Map<Route['name'], HTMLButtonElement>();
  const nav = h('nav.tabbar', { 'aria-label': 'Main' });
  for (const t of TABS) {
    const b = h('button.tab-btn', { onclick: () => ctx.go(t.route) }, icon(t.icon, 20), h('span', null, t.label));
    tabButtons.set(t.name, b);
    nav.append(b);
  }
  function setActiveTab(name: Route['name']) {
    const active = name === 'puzzle' ? 'home' : name;
    for (const [n, b] of tabButtons) {
      b.classList.toggle('active', n === active);
      if (n === active) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    }
  }

  const app = h('div.app', null, top, main, nav);
  document.body.append(app);

  function refreshChrome() {
    const s = liveStreak(progress, dayKey(), settings.streakFreeze);
    streakEl.textContent = `🔥 ${s}`;
    streakEl.classList.toggle('cold', s === 0);
    streakEl.title = `Daily streak: ${s} day${s === 1 ? '' : 's'} (best ${progress.streak.best})`;
    streakEl.setAttribute('aria-label', streakEl.title);
    clear(soundBtn);
    soundBtn.append(icon(settings.sound ? 'volume' : 'mute'));
    soundBtn.title = settings.sound ? 'Sound on' : 'Sound off';
    soundBtn.setAttribute('aria-label', settings.sound ? 'Mute sounds' : 'Unmute sounds');
  }

  const ctx: Ctx = {
    surface,
    get settings() {
      return settings;
    },
    get progress() {
      return progress;
    },
    engine: () => (engine ??= new Engine()),
    go: (route) => void show(route),
    saveProgress: async () => {
      await saveProgress(progress);
      refreshChrome();
    },
    today: () => dayKey(),
    focus: (on) => app.classList.toggle('focus', on),
    refreshChrome,
  };

  async function show(route: Route) {
    current?.destroy?.();
    current = undefined;
    clear(main);
    const root = h('section.screen', { 'data-screen': route.name });
    main.append(root);
    main.scrollTo(0, 0);
    setActiveTab(route.name);
    ctx.focus(false);
    await save(KEYS.screen, route);
    current = await SCREENS[route.name](ctx, root, route);
  }

  // Keep surfaces in sync: settings from the Options page, progress from the other surface.
  onSettingsChange((s) => {
    settings = s;
    applyTheme(s);
    setSoundEnabled(s.sound);
    refreshChrome();
    current?.onSettings?.(s);
  });
  onChange(async (k) => {
    if (k === KEYS.progress) {
      progress = await loadProgress();
      refreshChrome();
    }
  });

  refreshChrome();
  // Reopening resumes exactly where the user left off.
  const last = await load<Route>(KEYS.screen, { name: 'home' });
  const resumable = last.name === 'puzzle' || last.name === 'rush' || last.name === 'game';
  await show(resumable ? last : { name: 'home' });
}
