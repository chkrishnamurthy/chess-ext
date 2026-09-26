import { startApp } from '../app/app';
import { trapFocus } from '../shell/focusTrap';

// The app inside the in-page window (framed by src/content/overlay.ts).
void startApp('overlay');

// Tab cycles through the window instead of escaping into the page behind it, where
// nothing visible would show what has focus. Escape and ✕ still close it.
trapFocus(document);
