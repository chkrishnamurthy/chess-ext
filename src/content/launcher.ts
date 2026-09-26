/**
 * The corner button (opt-in, off by default), as in Holdpad.
 *
 * A pinned toolbar icon is easy to miss, so this puts a small button on the page at
 * the corner the window genies out of. It is its own tiny script with no framework or
 * stylesheet, because it runs on every page once the user turns it on in Settings and
 * grants site access. Until then the extension asks for no host permissions at all.
 */

import { LAUNCHER_INSET, LAUNCHER_SIZE } from '../shell/corner';
import { OVERLAY_EVENT } from '../shell/overlay';
import { enterTopLayer, pin, pinShell } from '../shell/pin';

const HOST_ID = 'chess-break-launcher-host';

/** One below the window, so the window always covers the button. */
const Z_INDEX = 2147483646;

const ICON_SIZE = Math.round(LAUNCHER_SIZE * 0.62);

const CSS = `
  :host { all: initial; }

  button {
    display: flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    border: 1px solid rgba(0, 0, 0, 0.1);
    border-radius: 999px;
    background-color: #ffffff;
    /* Resting low so it reads as part of the furniture, not as an ad. */
    opacity: 0.62;
    cursor: pointer;
    transition: opacity 140ms ease, transform 140ms ease, box-shadow 140ms ease;
    box-shadow:
      0 1px 2px rgba(0, 0, 0, 0.12),
      0 6px 16px -4px rgba(0, 0, 0, 0.22);
    -webkit-appearance: none;
    appearance: none;
  }

  button:hover,
  button:focus-visible {
    opacity: 1;
    transform: scale(1.08);
    box-shadow:
      0 1px 2px rgba(0, 0, 0, 0.14),
      0 10px 22px -4px rgba(0, 0, 0, 0.3);
  }

  button:focus-visible {
    outline: 2px solid #22a560;
    outline-offset: 2px;
  }

  button:active { transform: scale(0.94); }

  img {
    width: ${ICON_SIZE}px;
    height: ${ICON_SIZE}px;
    border-radius: 6px;
    display: block;
    pointer-events: none;
  }

  @media (prefers-color-scheme: dark) {
    button {
      border-color: rgba(255, 255, 255, 0.16);
      background-color: #1a221e;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    button { transition: opacity 140ms ease; }
    button:hover, button:focus-visible, button:active { transform: none; }
  }
`;

function mount(): void {
  if (window.top !== window) return;
  if (!document.body) return;
  if (document.getElementById(HOST_ID)) return;

  const host = document.createElement('div');
  host.id = HOST_ID;
  pinShell(host, {
    position: 'fixed',
    right: `${LAUNCHER_INSET}px`,
    bottom: `${LAUNCHER_INSET}px`,
    width: `${LAUNCHER_SIZE}px`,
    height: `${LAUNCHER_SIZE}px`,
    'z-index': String(Z_INDEX),
    'pointer-events': 'auto',
    transition: 'opacity 160ms ease',
  });

  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = CSS;

  const button = document.createElement('button');
  button.type = 'button';
  button.title = 'Chess Break — take a chess break';
  button.setAttribute('aria-label', 'Open Chess Break');

  const icon = document.createElement('img');
  icon.alt = '';
  icon.src = chrome.runtime.getURL('icons/icon-32.png');
  button.append(icon);

  shadow.append(style, button);
  document.documentElement.append(host);
  enterTopLayer(host);

  button.addEventListener('click', () => {
    try {
      void chrome.runtime.sendMessage({ type: 'launcher-click' }).catch(() => undefined);
    } catch {
      // The extension was reloaded or removed while this page stayed open.
      host.remove();
    }
  });

  // The window covers this corner, so the button steps out of the way while it's up.
  window.addEventListener(OVERLAY_EVENT, (event) => {
    const open = (event as CustomEvent<{ open?: boolean }>).detail?.open === true;
    pin(host, 'opacity', open ? '0' : '1');
    pin(host, 'pointer-events', open ? 'none' : 'auto');
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount, { once: true });
} else {
  mount();
}
