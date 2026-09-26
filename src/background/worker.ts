/**
 * Event-driven service worker, following Holdpad's structure.
 *
 * Chrome stops idle workers, so this holds no state: every handler re-reads what it
 * needs. Its jobs are opening Chess Break on the toolbar click / shortcut / corner
 * button, and keeping the optional corner button registered in step with the setting.
 */

import { canInject } from '../shell/inject';
import { loadSettings, patchSettings } from '../storage/settings';

/**
 * The toolbar click has to reach `action.onClicked` so the window can be injected,
 * which it won't while Chrome is set to open the side panel itself. The side panel
 * stays registered as the last resort.
 */
function configurePanel(): void {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => undefined);
}

/**
 * Show Chess Break for this tab. The first click injects the window, which opens
 * itself; later clicks find it there and toggle it. `activeTab` grants access to just
 * the tab that was clicked, so no host permissions are needed.
 */
async function showPanel(tab: chrome.tabs.Tab, mode: 'toggle' | 'open' = 'toggle'): Promise<void> {
  if (!canInject(tab.url) || tab.id === undefined) {
    openPopup(tab);
    return;
  }
  try {
    await chrome.tabs.sendMessage(tab.id, { type: mode === 'open' ? 'open-overlay' : 'toggle-overlay' });
    return;
  } catch {
    // No listener yet: first click on this page.
  }
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
  } catch {
    // Refused on protected origins even when the URL looks ordinary.
    openPopup(tab);
  }
}

const POPUP_PAGE = 'popup.html';

/**
 * Show the app as the toolbar popup, on pages that allow no window (chrome://, the Web
 * Store). The popup is attached only for as long as it takes to open it; left attached,
 * Chrome would open it on every later click and `onClicked` would never fire again.
 * Must run while the click still counts as a user gesture, so nothing is awaited first.
 */
function openPopup(tab: chrome.tabs.Tab): void {
  const { id: tabId, windowId } = tab;
  if (tabId === undefined) {
    if (windowId !== undefined) chrome.sidePanel.open({ windowId }).catch(() => undefined);
    return;
  }
  const attached = chrome.action.setPopup({ tabId, popup: POPUP_PAGE });
  chrome.action
    .openPopup(windowId !== undefined ? { windowId } : {})
    .catch(() => (windowId !== undefined ? chrome.sidePanel.open({ windowId }) : undefined))
    .catch(() => undefined)
    .finally(() => {
      void attached.then(() => chrome.action.setPopup({ tabId, popup: '' })).catch(() => undefined);
    });
}

// ---- optional corner button ----

const LAUNCHER_SCRIPT_ID = 'chess-break-launcher';
const LAUNCHER_ORIGINS = ['<all_urls>'];

async function hasSiteAccess(): Promise<boolean> {
  try {
    return await chrome.permissions.contains({ origins: LAUNCHER_ORIGINS });
  } catch {
    return false;
  }
}

async function launcherRegistered(): Promise<boolean> {
  try {
    const scripts = await chrome.scripting.getRegisteredContentScripts();
    return scripts.some((s) => s.id === LAUNCHER_SCRIPT_ID);
  } catch {
    return false;
  }
}

/** Register the button script only while the setting is on and site access is granted. */
async function syncLauncher(): Promise<boolean> {
  let wanted = false;
  try {
    wanted = (await loadSettings()).showLauncher && (await hasSiteAccess());
  } catch {
    wanted = false; // fail closed for something that runs on every page
  }
  if (wanted === (await launcherRegistered())) return wanted;
  try {
    if (wanted) {
      await chrome.scripting.registerContentScripts([
        { id: LAUNCHER_SCRIPT_ID, js: ['launcher.js'], matches: LAUNCHER_ORIGINS, runAt: 'document_idle', allFrames: false, persistAcrossSessions: true },
      ]);
    } else {
      await chrome.scripting.unregisterContentScripts({ ids: [LAUNCHER_SCRIPT_ID] });
    }
  } catch {
    // Best-effort: the toolbar icon and the shortcut still work without it.
  }
  return wanted;
}

/** A registered script only reaches pages loaded later, so add/remove it on open tabs too. */
async function updateOpenTabs(show: boolean): Promise<void> {
  let tabs: chrome.tabs.Tab[] = [];
  try {
    tabs = await chrome.tabs.query({});
  } catch {
    return;
  }
  await Promise.all(
    tabs.map(async (tab) => {
      if (tab.id === undefined || !canInject(tab.url)) return;
      try {
        if (show) await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['launcher.js'] });
        else await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => document.getElementById('chess-break-launcher-host')?.remove() });
      } catch {
        // A tab that refuses injection just doesn't get a button.
      }
    }),
  );
}

function startup(): void {
  configurePanel();
  void syncLauncher();
}

chrome.runtime.onInstalled.addListener(startup);
chrome.runtime.onStartup.addListener(startup);

chrome.action.onClicked.addListener((tab) => void showPanel(tab));

chrome.commands.onCommand.addListener((command, tab) => {
  if (command !== 'open-panel') return;
  if (tab) void showPanel(tab);
  else chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT }).catch(() => undefined);
});

// Site access can be revoked from Chrome's own extensions page; turn the setting off too.
chrome.permissions.onRemoved.addListener(() => {
  void (async () => {
    if (await hasSiteAccess()) return;
    if ((await loadSettings()).showLauncher) await patchSettings({ showLauncher: false });
    await syncLauncher();
    await updateOpenTabs(false);
  })();
});
chrome.permissions.onAdded.addListener(() => void syncLauncher());

const fromExtensionPage = (sender: chrome.runtime.MessageSender) => sender.url?.startsWith(chrome.runtime.getURL('')) === true;

chrome.runtime.onMessage.addListener((message: { type?: string } | undefined, sender, respond) => {
  if (message?.type === 'launcher-click') {
    // A content script could be driven by a hostile page; opening our window is all it can ask for.
    if (sender.tab) void showPanel(sender.tab);
    respond({ ok: true });
    return false;
  }
  if (!fromExtensionPage(sender)) return undefined;
  if (message?.type === 'launcher-changed') {
    void syncLauncher()
      .then((on) => updateOpenTabs(on))
      .then(() => respond({ ok: true }));
    return true;
  }
  return undefined;
});
