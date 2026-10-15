/**
 * Writes the legal files that ship inside the extension (public/legal/):
 *   - LICENSE.txt: the project's GPL-3.0 text (a copy of ./LICENSE)
 *   - THIRD-PARTY-NOTICES.txt: licences and credits for everything bundled
 *
 * Run `npm run notices` after changing dependencies. `npm run release` runs it for you,
 * and tests/legal.test.ts fails if the generated files are out of date.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const outDir = resolve(root, 'public', 'legal');

const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
  version: string;
  author: string;
  homepage: string;
  dependencies: Record<string, string>;
};

const read = (path: string) => readFileSync(path, 'utf8').replace(/\r\n/g, '\n').trimEnd();

interface DepInfo {
  name: string;
  version: string;
  license: string;
  author: string;
  url: string;
  text: string | null;
}

function dep(name: string): DepInfo {
  const dir = resolve(root, 'node_modules', name);
  const p = JSON.parse(readFileSync(resolve(dir, 'package.json'), 'utf8')) as {
    version: string;
    license: string;
    author?: string | { name?: string };
    homepage?: string;
    repository?: string | { url?: string };
  };
  const author = typeof p.author === 'string' ? p.author : (p.author?.name ?? 'the authors');
  const repo = typeof p.repository === 'string' ? p.repository : p.repository?.url;
  const url = (p.homepage ?? repo ?? '').replace(/^git\+/, '').replace(/\.git$/, '');
  const licenseFile = ['LICENSE', 'LICENSE.txt', 'LICENSE.md', 'Copying.txt'].map((f) => resolve(dir, f)).find(existsSync);
  const isGpl = p.license.startsWith('GPL');
  return { name, version: p.version, license: p.license, author, url, text: isGpl || !licenseFile ? null : read(licenseFile) };
}

const rule = '='.repeat(78);
const sections: string[] = [];

sections.push(
  [
    'Chess Break: third-party notices',
    '',
    `Chess Break ${pkg.version} is free software, copyright (C) 2026 ${pkg.author}.`,
    'You can redistribute it and/or modify it under the terms of the GNU General Public',
    'License, version 3 or (at your option) any later version. The full text is in',
    'LICENSE.txt, next to this file.',
    '',
    `Source code: ${pkg.homepage}`,
    '',
    'Chess Break includes the following software and data.',
  ].join('\n'),
);

const names = Object.keys(pkg.dependencies).sort();
for (const name of names) {
  const d = dep(name);
  const lines = [rule, `${d.name} ${d.version}`, `License: ${d.license}`, `Copyright: ${d.author}`];
  if (d.url) lines.push(`Source: ${d.url}`);
  if (d.name === 'stockfish') {
    lines.push(
      'The chess engine in engine/stockfish.js and engine/stockfish.wasm is the Stockfish',
      'project, built for the web by this package. Stockfish source code:',
      'https://github.com/official-stockfish/Stockfish and https://github.com/nmrugg/stockfish.js',
      'The engine files in this extension are used unmodified.',
    );
  }
  if (d.name === '@lichess-org/chessground') {
    lines.push(
      'This package also provides the chess piece images (the "cburnett" set, drawn by',
      'Colin M.L. Burnett) that the extension shows in its default piece style.',
    );
  }
  lines.push('');
  lines.push(d.text ?? 'Licensed under the GNU General Public License, version 3 or later. See LICENSE.txt.');
  sections.push(lines.join('\n'));
}

sections.push(
  [
    rule,
    'Lucide and Feather icons (inline SVG paths in the toolbar and buttons)',
    'License: ISC (Lucide), MIT (portions from Feather)',
    'Source: https://lucide.dev',
    '',
    'ISC License',
    '',
    'Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT).',
    'All other copyright (c) for Lucide are held by Lucide Contributors 2022.',
    '',
    'Permission to use, copy, modify, and/or distribute this software for any purpose with or without',
    'fee is hereby granted, provided that the above copyright notice and this permission notice appear',
    'in all copies.',
    '',
    'THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS',
    'SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE',
    'AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES',
    'WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT,',
    'NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE',
    'OF THIS SOFTWARE.',
    '',
    'MIT License (Feather portions)',
    '',
    'Copyright (c) 2013-2023 Cole Bemis',
    '',
    'Permission is hereby granted, free of charge, to any person obtaining a copy of this software and',
    'associated documentation files (the "Software"), to deal in the Software without restriction,',
    'including without limitation the rights to use, copy, modify, merge, publish, distribute,',
    'sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is',
    'furnished to do so, subject to the following conditions:',
    '',
    'The above copyright notice and this permission notice shall be included in all copies or',
    'substantial portions of the Software.',
    '',
    'THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT',
    'NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND',
    'NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,',
    'DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT',
    'OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.',
  ].join('\n'),
  [
    rule,
    'Lichess puzzle database',
    'License: CC0 1.0 (public domain dedication)',
    'Source: https://database.lichess.org/#puzzles',
    'The puzzles in src/data/puzzles.json come from this database. Each imported puzzle keeps its',
    'Lichess id in its "src" field. No permission or attribution is required; credit is given anyway.',
  ].join('\n'),
);

mkdirSync(outDir, { recursive: true });
writeFileSync(resolve(outDir, 'THIRD-PARTY-NOTICES.txt'), sections.join('\n\n') + '\n');
writeFileSync(resolve(outDir, 'LICENSE.txt'), read(resolve(root, 'LICENSE')) + '\n');
console.log(`wrote public/legal/LICENSE.txt and THIRD-PARTY-NOTICES.txt (${names.length} packages)`);
