/**
 * Writes chess-break.zip from dist/ for the Chrome Web Store. Cross-platform:
 * Windows 10+ and macOS ship a bsdtar that can write zip (`tar -a`); Linux uses `zip`.
 * (PowerShell's Compress-Archive is avoided: older versions write backslash paths.)
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'dist');
const out = resolve(root, 'chess-break.zip');

if (!existsSync(resolve(dist, 'manifest.json'))) throw new Error('dist/manifest.json is missing. Run `npm run build` first.');
const manifest = JSON.parse(readFileSync(resolve(dist, 'manifest.json'), 'utf8')) as { version: string };
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as { version: string };
if (manifest.version !== pkg.version) throw new Error(`Version mismatch: manifest ${manifest.version} vs package.json ${pkg.version}`);

rmSync(out, { force: true });
// Name the top-level entries instead of '.', so archive paths are "manifest.json", not "./manifest.json".
const entries = readdirSync(dist);
// On Windows call the system bsdtar by full path: a GNU tar earlier on PATH (Git Bash) cannot write zips.
const tar = process.platform === 'win32' ? resolve(process.env.SystemRoot ?? 'C:\Windows', 'System32', 'tar.exe') : 'tar';
if (process.platform === 'win32' || process.platform === 'darwin') execFileSync(tar, ['-a', '-c', '-f', '../chess-break.zip', ...entries], { cwd: dist, stdio: 'inherit' });
else execFileSync('zip', ['-qr', '../chess-break.zip', ...entries], { cwd: dist, stdio: 'inherit' });

console.log(`packaged chess-break.zip (${(statSync(out).size / 1024 / 1024).toFixed(2)} MB, version ${manifest.version})`);
