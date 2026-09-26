/**
 * Shared between the in-page window (content script), the app framed inside it,
 * and the service worker. Kept free of DOM and chrome.* use so every side can import it.
 */

/** Framed app → shell: please close (✕ button or Escape). */
export const OVERLAY_CLOSE = 'cb:close';
/** Shell → framed app: about to show again (sent while still hidden, before the genie). */
export const OVERLAY_OPENING = 'cb:opening';
/** Shell → framed app: finished opening, take focus. */
export const OVERLAY_OPENED = 'cb:opened';
/** Shell → framed app: now hidden. Behave as if the popup had closed. */
export const OVERLAY_CLOSED = 'cb:closed';

/** Window event between the two content scripts: the corner button steps aside while the window is up. */
export const OVERLAY_EVENT = 'cb:overlay';

/** Storage key for the width the user dragged the window to. Not a setting, just a remembered size. */
export const OVERLAY_WIDTH_KEY = 'cb.overlayWidth';

/** Same first-open width as Holdpad. */
export const DEFAULT_OVERLAY_WIDTH = 600;
/** Narrower than Holdpad's floor: a board and its toolbar still fit comfortably here. */
export const MIN_OVERLAY_WIDTH = 400;
export const MAX_OVERLAY_WIDTH = 1200;
export const OVERLAY_WIDTH_STEP = 16;

export function clampOverlayWidth(width: number): number {
  if (!Number.isFinite(width)) return DEFAULT_OVERLAY_WIDTH;
  return Math.round(Math.min(MAX_OVERLAY_WIDTH, Math.max(MIN_OVERLAY_WIDTH, width)));
}

export function parseOverlayWidth(value: unknown): number {
  return typeof value === 'number' ? clampOverlayWidth(value) : DEFAULT_OVERLAY_WIDTH;
}
