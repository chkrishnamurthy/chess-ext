type Child = Node | string | number | false | null | undefined;
type Attrs = Record<string, unknown> & { class?: string; style?: string };

/** Minimal hyperscript helper: h('button.primary', { onclick }, 'Go'). */
export function h<K extends keyof HTMLElementTagNameMap>(
  sel: K | `${K}.${string}` | `${K}#${string}`,
  attrs: Attrs | null = null,
  ...children: (Child | Child[])[]
): HTMLElementTagNameMap[K] {
  const [tagAndId, ...classes] = sel.split('.');
  const [tag, id] = tagAndId.split('#');
  const el = document.createElement(tag) as HTMLElementTagNameMap[K];
  if (id) el.id = id;
  if (classes.length) el.className = classes.join(' ');
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = [el.className, v].filter(Boolean).join(' ');
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener);
      else if (k === 'style') el.setAttribute('style', String(v));
      else if (k in el && typeof v !== 'string') (el as unknown as Record<string, unknown>)[k] = v;
      else el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function clear(el: Element): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

/** Announce text to screen readers via a shared polite live region. */
export function announce(text: string): void {
  let live = document.getElementById('sr-live');
  if (!live) {
    live = h('div#sr-live', { 'aria-live': 'polite', class: 'sr-only' });
    document.body.append(live);
  }
  live.textContent = '';
  setTimeout(() => (live!.textContent = text), 30);
}

export function toast(text: string, kind: 'info' | 'good' | 'warn' = 'info', ms = 2200): void {
  let host = document.getElementById('toasts');
  if (!host) {
    host = h('div#toasts');
    document.body.append(host);
  }
  const t = h('div.toast', { class: kind, role: 'status' }, text);
  host.append(t);
  setTimeout(() => t.classList.add('out'), ms);
  setTimeout(() => t.remove(), ms + 400);
}
