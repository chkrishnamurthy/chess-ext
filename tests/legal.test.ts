import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8').replace(/\r\n/g, '\n');
const pkg = JSON.parse(read('package.json')) as { license: string; author: string; homepage: string; dependencies: Record<string, string> };

describe('licensing files', () => {
  it('the project is GPL-3.0-or-later with the full licence text at the root', () => {
    expect(pkg.license).toBe('GPL-3.0-or-later');
    const text = read('LICENSE');
    expect(text).toContain('GNU GENERAL PUBLIC LICENSE');
    expect(text).toContain('Version 3, 29 June 2007');
    expect(text.split('\n').length).toBeGreaterThan(600);
  });

  it('ships the licence and notices inside the extension, and they are up to date', () => {
    expect(read('public/legal/LICENSE.txt').trimEnd()).toBe(read('LICENSE').trimEnd());
    const notices = read('public/legal/THIRD-PARTY-NOTICES.txt');
    for (const name of Object.keys(pkg.dependencies)) expect(notices, `${name} missing from notices — run npm run notices`).toContain(name);
    expect(notices).toContain(pkg.homepage);
    expect(notices).toContain(pkg.author);
    expect(notices).toContain('Lichess puzzle database');
  });

  it('the Stockfish licence travels with the engine files', () => {
    expect(read('public/engine/COPYING.txt')).toContain('GNU GENERAL PUBLIC LICENSE');
  });
});
