/**
 * Generates public/icons/icon-{16,32,48,128}.png: a rounded green tile with a
 * checkerboard and a yellow lightning bolt ("a quick chess break").
 *   npm run icons
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

type RGBA = [number, number, number, number];

const GREEN: RGBA = [47, 125, 79, 255];
const LIGHT: RGBA = [240, 217, 181, 255];
const DARK: RGBA = [181, 136, 99, 255];
const BOLT: RGBA = [255, 205, 60, 255];
const BOLT_EDGE: RGBA = [60, 40, 10, 255];

// Bolt polygon in unit coordinates.
const BOLT_POLY: [number, number][] = [
  [0.6, 0.12], [0.3, 0.55], [0.48, 0.55], [0.38, 0.9], [0.72, 0.42], [0.53, 0.42], [0.66, 0.12],
];

function inPoly(x: number, y: number, poly: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function distToPoly(x: number, y: number, poly: [number, number][]): number {
  let d = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, ay] = poly[j];
    const [bx, by] = poly[i];
    const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)));
    d = Math.min(d, Math.hypot(x - (ax + t * (bx - ax)), y - (ay + t * (by - ay))));
  }
  return d;
}

function sample(x: number, y: number, size: number): RGBA | null {
  const r = 0.2;
  // Rounded-square mask.
  const cx = Math.min(Math.max(x, r), 1 - r);
  const cy = Math.min(Math.max(y, r), 1 - r);
  if (Math.hypot(x - cx, y - cy) > r) return null;
  const edge = size <= 16 ? 0.06 : 0.035;
  if (inPoly(x, y, BOLT_POLY)) return BOLT;
  if (distToPoly(x, y, BOLT_POLY) < edge) return BOLT_EDGE;
  const m = 0.14;
  if (x > m && x < 1 - m && y > m && y < 1 - m) {
    const n = 4;
    const fx = Math.floor(((x - m) / (1 - 2 * m)) * n);
    const fy = Math.floor(((y - m) / (1 - 2 * m)) * n);
    return (fx + fy) % 2 ? DARK : LIGHT;
  }
  return GREEN;
}

function render(size: number): Buffer {
  const ss = 4;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let py = 0; py < size; py++) {
    raw[py * (size * 4 + 1)] = 0;
    for (let px = 0; px < size; px++) {
      const acc = [0, 0, 0, 0];
      for (let sy = 0; sy < ss; sy++)
        for (let sx = 0; sx < ss; sx++) {
          const c = sample((px + (sx + 0.5) / ss) / size, (py + (sy + 0.5) / ss) / size, size);
          if (!c) continue;
          acc[0] += c[0] * c[3];
          acc[1] += c[1] * c[3];
          acc[2] += c[2] * c[3];
          acc[3] += c[3];
        }
      const o = py * (size * 4 + 1) + 1 + px * 4;
      const a = acc[3] / (ss * ss);
      raw[o] = acc[3] ? Math.round(acc[0] / acc[3]) : 0;
      raw[o + 1] = acc[3] ? Math.round(acc[1] / acc[3]) : 0;
      raw[o + 2] = acc[3] ? Math.round(acc[2] / acc[3]) : 0;
      raw[o + 3] = Math.round(a);
    }
  }
  return png(size, size, raw);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(w: number, h: number, raw: Buffer): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync('public/icons', { recursive: true });
for (const s of [16, 32, 48, 128]) writeFileSync(`public/icons/icon-${s}.png`, render(s));
console.log('icons written to public/icons');
