/** Pure helpers for the Coordinates drill (kept apart from the DOM so they can be unit-tested). */

export const FILES = 'abcdefgh';

export type Orientation = 'white' | 'black';

/** Square name under a point inside a board of `size` px, or null if outside. */
export function squareAt(x: number, y: number, size: number, orientation: Orientation): string | null {
  if (x < 0 || y < 0 || x >= size || y >= size) return null;
  const col = Math.floor((x / size) * 8);
  const row = Math.floor((y / size) * 8);
  const file = orientation === 'white' ? col : 7 - col;
  const rank = orientation === 'white' ? 8 - row : row + 1;
  return `${FILES[file]}${rank}`;
}

/** A random square that differs from `previous`. `rng` returns a number in [0, 1). */
export function randomSquare(previous: string | undefined, rng: () => number = Math.random): string {
  for (;;) {
    const sq = `${FILES[Math.floor(rng() * 8) % 8]}${(Math.floor(rng() * 8) % 8) + 1}`;
    if (sq !== previous) return sq;
  }
}
