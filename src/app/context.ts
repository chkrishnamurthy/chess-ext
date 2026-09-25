import type { Engine } from '../engine/engine';
import type { MateN, Tier } from '../game/types';
import type { Progress } from '../progress/progress';
import type { Settings } from '../storage/settings';

export type Route =
  | { name: 'home' }
  | { name: 'puzzle'; mode: 'practice'; n: MateN; tier?: Tier | 'all' }
  | { name: 'puzzle'; mode: 'daily' }
  | { name: 'puzzle'; mode: 'retry' }
  | { name: 'rush' }
  | { name: 'game'; positionId?: string; fresh?: boolean }
  | { name: 'progress' };

export interface Ctx {
  surface: 'popup' | 'sidepanel';
  settings: Settings;
  progress: Progress;
  engine(): Engine;
  go(route: Route): void;
  saveProgress(): Promise<void>;
  today(): string;
  /** Refresh the top bar (streak, sound icon). */
  refreshChrome(): void;
}

export interface ScreenHandle {
  destroy?(): void;
  /** Called when settings change on another surface (e.g. the Options page). */
  onSettings?(s: Settings): void;
}

export type Screen = (ctx: Ctx, root: HTMLElement, route: Route) => ScreenHandle | Promise<ScreenHandle>;
