import type { Engine } from '../engine/engine';
import type { MateN, Tier } from '../game/types';
import type { Progress } from '../progress/progress';
import type { Settings } from '../storage/settings';

export type Route =
  | { name: 'home' }
  | { name: 'puzzles' }
  | { name: 'play' }
  | { name: 'puzzle'; mode: 'practice'; n: MateN; tier?: Tier | 'all' }
  | { name: 'puzzle'; mode: 'daily' }
  | { name: 'puzzle'; mode: 'retry' }
  | { name: 'puzzle'; mode: 'theme'; theme: string }
  | { name: 'rush' }
  | { name: 'ghost' }
  | { name: 'streak' }
  | { name: 'themes' }
  | { name: 'lessons' }
  | { name: 'learn'; piece?: string }
  | { name: 'coords' }
  | { name: 'quick' }
  | { name: 'game'; positionId?: string; fresh?: boolean; quick?: { color: 'w' | 'b'; level: number } }
  | { name: 'progress' };

export interface Ctx {
  /** 'overlay' = the floating window on a web page (Holdpad-style), framed by a content script. */
  surface: 'popup' | 'sidepanel' | 'overlay';
  /** True only for the first screen shown after the popup / side panel opens. */
  reopened: boolean;
  settings: Settings;
  progress: Progress;
  engine(): Engine;
  go(route: Route): void;
  /**
   * Change progress safely: under a cross-window lock, reads the latest saved progress, applies `fn`
   * to it and saves. Two open windows (popup, side panel, in-page) can't overwrite each other.
   */
  updateProgress<T>(fn: (p: Progress) => T): Promise<T>;
  today(): string;
  /** Focus mode: hide the tab bar so the board + controls fit without scrolling. */
  focus(on: boolean): void;
  /** Refresh the top bar (streak, sound icon). */
  refreshChrome(): void;
}

export interface ScreenHandle {
  destroy?(): void;
  /** Called when settings change on another surface (e.g. the Options page). */
  onSettings?(s: Settings): void;
}

export type Screen = (ctx: Ctx, root: HTMLElement, route: Route) => ScreenHandle | Promise<ScreenHandle>;
