/**
 * The in-page window: Chess Break floated over the current web page, the same way
 * Holdpad shows its notes panel.
 *
 * The app itself is not in here. It runs in an iframe of `overlay.html`, an extension
 * page, and this script only provides the window around it:
 *
 *  1. **Isolation.** The frame sits in a *closed* shadow root, so the page cannot find
 *     the iframe or style the shell, and it cannot see into the cross-origin frame.
 *  2. **Stacking.** The host goes in the top layer, above any z-index on the page.
 *  3. **Size.** The left edge is a drag handle; the chosen width is remembered.
 *  4. **Motion.** Opening and closing play the genie effect from/into the bottom-right
 *     corner, using empty copies of the window so the app never re-renders mid-flight.
 *
 * Closing only hides the window. The app is told (OVERLAY_CLOSED) so it can pause the
 * Rush clock and later resume exactly like a reopened popup.
 */

import { cornerPoint } from '../shell/corner';
import { DEFAULT_GENIE, animateSlices, buildSlices, prefersReducedMotion, sliceTransforms, type Point } from '../shell/genie';
import {
  DEFAULT_OVERLAY_WIDTH,
  MAX_OVERLAY_WIDTH,
  MIN_OVERLAY_WIDTH,
  OVERLAY_CLOSE,
  OVERLAY_CLOSED,
  OVERLAY_EVENT,
  OVERLAY_OPENED,
  OVERLAY_OPENING,
  OVERLAY_WIDTH_KEY,
  OVERLAY_WIDTH_STEP,
  clampOverlayWidth,
  parseOverlayWidth,
} from '../shell/overlay';
import { enterTopLayer, pinShell } from '../shell/pin';
// Inlined at build time: a content script cannot rely on fetching its own stylesheet.
import overlayCss from './overlay.css?inline';

const HOST_ID = 'chess-break-overlay-host';
const SETTINGS_KEY = 'cb.settings';

/** How long a first open waits for the frame to load before animating anyway. */
const FRAME_LOAD_TIMEOUT_MS = 1500;

interface OverlayState {
  host: HTMLElement;
  shadow: ShadowRoot;
  frame: HTMLElement;
  iframe: HTMLIFrameElement;
  handle: HTMLElement;
  /** The width the user chose, before the viewport cap is applied. */
  width: number;
  loaded: Promise<void>;
  returnFocus: Element | null;
  open: boolean;
  busy: boolean;
}

let state: OverlayState | null = null;

/**
 * `overlay.html` is web-accessible with `use_dynamic_url`, so it only answers on an id
 * that changes every browser session: a page cannot frame it itself or probe for it.
 */
function frameUrl(): string {
  const dynamicId = (chrome.runtime as typeof chrome.runtime & { dynamicId?: string }).dynamicId;
  return dynamicId ? `chrome-extension://${dynamicId}/overlay.html` : chrome.runtime.getURL('overlay.html');
}

const extensionOrigin = () => new URL(chrome.runtime.getURL('')).origin;

function tellFrame(current: OverlayState, type: string): void {
  current.iframe.contentWindow?.postMessage({ type }, extensionOrigin());
}

/** The point the window funnels into: the corner button's centre (or just the corner). */
function targetPoint(): Point {
  const root = document.documentElement;
  return cornerPoint(root.clientWidth || window.innerWidth, root.clientHeight || window.innerHeight);
}

/** Tell the corner button (a separate content script, same isolated world) to step aside. */
function announce(open: boolean): void {
  window.dispatchEvent(new CustomEvent(OVERLAY_EVENT, { detail: { open } }));
}

/** Match the frame's border/background (and the genie's slices) to the app's light/dark theme. */
async function syncTheme(host: HTMLElement): Promise<void> {
  let appTheme: unknown = 'auto';
  try {
    const record = await chrome.storage.local.get(SETTINGS_KEY);
    appTheme = (record[SETTINGS_KEY] as { appTheme?: unknown } | undefined)?.appTheme ?? 'auto';
  } catch {
    // The system theme is a fine fallback for a border colour.
  }
  const dark = appTheme === 'dark' || (appTheme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  host.setAttribute('data-theme', dark ? 'dark' : 'light');
}

function create(): OverlayState {
  const host = document.createElement('div');
  host.id = HOST_ID;
  // The host lives in the page's DOM; every declaration is `!important` so page CSS can't win.
  pinShell(host, { position: 'fixed', inset: '0', 'z-index': '2147483647', 'pointer-events': 'none' });

  const shadow = host.attachShadow({ mode: 'closed' });
  const style = document.createElement('style');
  style.textContent = overlayCss;
  shadow.append(style);

  const stage = document.createElement('div');
  stage.className = 'cb-stage';
  const frame = document.createElement('div');
  frame.className = 'cb-frame';

  const iframe = document.createElement('iframe');
  iframe.className = 'cb-iframe';
  iframe.title = 'Chess Break';
  // Stockfish runs in a worker inside the frame and sound needs autoplay after a click.
  iframe.allow = 'autoplay';
  const frameLoaded = new Promise<void>((resolve) => {
    iframe.addEventListener('load', () => resolve(), { once: true });
    setTimeout(resolve, FRAME_LOAD_TIMEOUT_MS);
  });
  iframe.src = frameUrl();

  // The left edge, since the window is anchored to the right.
  const handle = document.createElement('div');
  handle.className = 'cb-resize';
  handle.tabIndex = 0;
  handle.setAttribute('role', 'separator');
  handle.setAttribute('aria-orientation', 'vertical');
  handle.setAttribute('aria-label', 'Resize Chess Break');
  handle.setAttribute('aria-valuemin', String(MIN_OVERLAY_WIDTH));
  handle.setAttribute('aria-valuemax', String(MAX_OVERLAY_WIDTH));
  handle.title = 'Drag to resize · double-click to reset';

  frame.append(iframe, handle);
  stage.append(frame);
  shadow.append(stage);
  document.documentElement.append(host);
  enterTopLayer(host);
  void syncTheme(host);

  const created: OverlayState = {
    host,
    shadow,
    frame,
    iframe,
    handle,
    width: DEFAULT_OVERLAY_WIDTH,
    // The saved width must be in place before the genie measures the frame.
    loaded: Promise.all([frameLoaded, loadWidth(frame)]).then((results) => {
      created.width = results[1];
    }),
    returnFocus: null,
    open: false,
    busy: false,
  };
  applyWidth(created, DEFAULT_OVERLAY_WIDTH);
  wireResize(created);
  return created;
}

async function loadWidth(frame: HTMLElement): Promise<number> {
  try {
    const record = await chrome.storage.local.get(OVERLAY_WIDTH_KEY);
    const width = parseOverlayWidth(record[OVERLAY_WIDTH_KEY]);
    setFrameWidth(frame, width);
    return width;
  } catch {
    return DEFAULT_OVERLAY_WIDTH;
  }
}

/** The stored width is what the user asked for; CSS caps it to the viewport on top. */
function setFrameWidth(frame: HTMLElement, width: number): void {
  frame.style.width = `min(${width}px, calc(100% - 40px))`;
}

function applyWidth(current: OverlayState, width: number): void {
  current.width = clampOverlayWidth(width);
  setFrameWidth(current.frame, current.width);
  current.handle.setAttribute('aria-valuenow', String(current.width));
}

function saveWidth(width: number): void {
  chrome.storage.local.set({ [OVERLAY_WIDTH_KEY]: width }).catch(() => undefined);
}

function wireResize(current: OverlayState): void {
  const { handle, frame, iframe } = current;
  let startX = 0;
  let startWidth = 0;
  let dragging = false;

  handle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    dragging = true;
    startX = event.clientX;
    startWidth = frame.getBoundingClientRect().width;
    handle.setPointerCapture(event.pointerId);
    // The iframe would otherwise swallow moves that pass over it.
    iframe.style.pointerEvents = 'none';
    frame.classList.add('cb-resizing');
  });

  handle.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    // Anchored on the right, so moving left makes it wider.
    const maxOnScreen = (document.documentElement.clientWidth || window.innerWidth) - 40;
    applyWidth(current, Math.min(startWidth + (startX - event.clientX), maxOnScreen));
  });

  const end = (event: PointerEvent): void => {
    if (!dragging) return;
    dragging = false;
    if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
    iframe.style.pointerEvents = '';
    frame.classList.remove('cb-resizing');
    saveWidth(current.width);
  };
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);

  handle.addEventListener('dblclick', () => {
    applyWidth(current, DEFAULT_OVERLAY_WIDTH);
    saveWidth(current.width);
  });

  handle.addEventListener('keydown', (event) => {
    const step = event.shiftKey ? OVERLAY_WIDTH_STEP * 4 : OVERLAY_WIDTH_STEP;
    let next: number | null = null;
    if (event.key === 'ArrowLeft') next = current.width + step;
    else if (event.key === 'ArrowRight') next = current.width - step;
    else if (event.key === 'Home') next = DEFAULT_OVERLAY_WIDTH;
    if (next === null) return;
    event.preventDefault();
    applyWidth(current, next);
    saveWidth(current.width);
  });
}

/**
 * Play the genie between the window's resting place and the corner. The live frame is
 * hidden for the duration and a stack of empty windows does the travelling.
 */
async function genie(current: OverlayState, direction: 'in' | 'out'): Promise<void> {
  const rect = current.frame.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;

  if (prefersReducedMotion()) {
    current.frame.style.visibility = 'visible';
    current.frame.style.transition = 'opacity 120ms linear';
    current.frame.style.opacity = direction === 'in' ? '0' : '1';
    void current.frame.offsetWidth;
    current.frame.style.opacity = direction === 'in' ? '1' : '0';
    await new Promise((resolve) => setTimeout(resolve, 130));
    current.frame.style.visibility = direction === 'in' ? 'visible' : 'hidden';
    current.frame.style.transition = '';
    current.frame.style.opacity = '';
    return;
  }

  const plans = sliceTransforms({ left: rect.left, top: rect.top, width: rect.width, height: rect.height }, targetPoint(), DEFAULT_GENIE);
  const stage = current.shadow.querySelector('.cb-stage') as HTMLElement;

  // A shallow copy: the window's own box (border, background, corners, shadow) without the iframe.
  const ghost = current.frame.cloneNode(false) as HTMLElement;
  ghost.classList.add('cb-ghost');
  const slices = buildSlices(ghost, rect, plans);
  const layer = document.createElement('div');
  layer.className = 'cb-genie-layer';
  layer.append(...slices);
  stage.append(layer);

  current.frame.style.visibility = 'hidden';
  await animateSlices(slices, plans, direction, DEFAULT_GENIE);
  layer.remove();
  current.frame.style.visibility = direction === 'in' ? 'visible' : 'hidden';
}

export async function open(): Promise<void> {
  const first = !state;
  if (!state) state = create();
  const current = state;
  if (current.busy || current.open) return;
  current.busy = true;
  current.returnFocus = document.activeElement;

  current.frame.style.visibility = 'hidden';
  announce(true);
  await current.loaded;
  // While still hidden, so the app can swap a finished puzzle for a fresh one before it shows.
  if (!first) tellFrame(current, OVERLAY_OPENING);

  await genie(current, 'in');
  current.frame.style.visibility = 'visible';
  current.open = true;
  current.busy = false;

  current.iframe.focus();
  tellFrame(current, OVERLAY_OPENED);
}

export async function close(): Promise<void> {
  const current = state;
  if (!current || current.busy || !current.open) return;
  current.busy = true;

  await genie(current, 'out');
  current.open = false;
  current.busy = false;
  tellFrame(current, OVERLAY_CLOSED);
  restoreFocus(current);
  announce(false);
}

/** Give the keyboard back to the page, so keys don't go into a window nobody can see. */
function restoreFocus(current: OverlayState): void {
  const previous = current.returnFocus;
  current.returnFocus = null;
  window.focus();
  if (previous instanceof HTMLElement && previous.isConnected && previous !== current.host) {
    previous.focus({ preventScroll: true });
  } else {
    (document.activeElement as HTMLElement | null)?.blur?.();
  }
}

export async function toggle(): Promise<void> {
  if (state?.open) await close();
  else await open();
}

export function destroy(): void {
  if (!state) return;
  const { host } = state;
  state = null;
  announce(false);
  host.remove();
}

// Clicking the page does not close the window: it stays beside the page while you use
// it. It closes from its ✕, Escape, the toolbar icon, the shortcut or the corner button.

// Only messages from our own frame are believed; the page can post here too.
window.addEventListener('message', (event) => {
  if (!state || event.source !== state.iframe.contentWindow) return;
  if ((event.data as { type?: unknown } | null)?.type === OVERLAY_CLOSE) void close();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !state) return;
  if (SETTINGS_KEY in changes) void syncTheme(state.host);
  // A resize in another tab carries over.
  if (OVERLAY_WIDTH_KEY in changes) {
    const width = parseOverlayWidth(changes[OVERLAY_WIDTH_KEY].newValue);
    if (width !== state.width) applyWidth(state, width);
  }
});

window.addEventListener('pagehide', destroy);

chrome.runtime.onMessage.addListener((message: { type?: string }) => {
  if (message?.type === 'toggle-overlay') void toggle();
  if (message?.type === 'open-overlay') void open();
  return undefined;
});

// Injection is the open gesture: the worker injects on the first click and sends
// `toggle-overlay` on every click after that.
void open();
