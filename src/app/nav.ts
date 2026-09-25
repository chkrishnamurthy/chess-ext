/** Navigation to other extension surfaces. */

export function openOptions(tab?: string): void {
  const url = `options.html${tab ? '#' + tab : ''}`;
  if (typeof chrome !== 'undefined' && chrome.tabs?.create && chrome.runtime?.getURL) void chrome.tabs.create({ url: chrome.runtime.getURL(url) });
  else window.open(url, '_blank');
}

// Resolve the window id up front: sidePanel.open() must run synchronously inside the click
// handler, or Chrome no longer treats it as a user gesture.
let windowId: number | undefined;
if (typeof chrome !== 'undefined' && chrome.windows?.getCurrent) void chrome.windows.getCurrent().then((w) => (windowId = w.id));

/** Opens the side panel for longer games. Call directly from a click handler. */
export async function openSidePanel(): Promise<boolean> {
  try {
    if (typeof chrome === 'undefined' || !chrome.sidePanel?.open || windowId === undefined) return false;
    await chrome.sidePanel.open({ windowId });
    return true;
  } catch {
    return false;
  }
}
