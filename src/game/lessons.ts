import type { FinishPosition } from './types';

/** An endgame lesson: a winning position plus the steps that make it work. */
export interface Lesson extends FinishPosition {
  steps: string[];
}

export const LESSON_PREFIX = 'lesson-';
export const isLessonId = (id: string): boolean => id.startsWith(LESSON_PREFIX);

export const LESSONS: Lesson[] = [
  {
    id: 'lesson-kq',
    title: 'King + Queen vs King',
    fen: '8/8/8/8/3k4/8/Q7/4K3 w - - 0 1',
    tier: 'easy',
    goal: 'Checkmate. Aim for about 10 moves.',
    tip: 'Use the queen to shrink the king’s box, then walk your king up to help.',
    steps: [
      'Keep the queen a knight’s move away from the enemy king, so it cannot attack her.',
      'Shrink the box one step at a time. Each queen move should take away more squares.',
      'When the enemy king is on the edge, bring your own king close.',
      'Before every move, check the enemy king still has a legal move. If not, and it is not in check, that is stalemate.',
    ],
  },
  {
    id: 'lesson-kr',
    title: 'King + Rook vs King',
    fen: '8/8/8/4k3/8/8/8/R3K3 w - - 0 1',
    tier: 'easy',
    goal: 'Checkmate. Aim for about 16 moves.',
    tip: 'Cut the king off with the rook, then use the opposition with your king.',
    steps: [
      'Use the rook to cut off a whole rank or file, so the enemy king cannot cross it.',
      'Walk your king next to the enemy king, facing it with one square between (the opposition).',
      'Slide the rook along the edge to give check. The enemy king must go back.',
      'Repeat on the next line until the king is on the edge, then give mate with the rook.',
    ],
  },
  {
    id: 'lesson-2r',
    title: 'Two Rooks: the ladder',
    fen: '8/8/8/4k3/8/8/R7/1R2K3 w - - 0 1',
    tier: 'easy',
    goal: 'Checkmate. Aim for about 6 moves.',
    tip: 'Rooks take turns: one checks, the other cuts off the next line.',
    steps: [
      'Put one rook on a line to cut the king off, for example the 4th rank.',
      'Give check with the other rook one line further up.',
      'Move the first rook past the second to give check again. The king is pushed one line each time.',
      'Keep going until the king runs out of room at the edge.',
    ],
  },
  {
    id: 'lesson-2b',
    title: 'Two Bishops vs King',
    fen: '8/8/8/4k3/8/8/8/2B1KB2 w - - 0 1',
    tier: 'medium',
    goal: 'Checkmate. Aim for about 20 moves.',
    tip: 'Keep the bishops side by side on neighbouring diagonals, like a wall.',
    steps: [
      'Place the bishops on neighbouring diagonals so they block a wide strip together.',
      'Push the king toward a corner, one diagonal at a time.',
      'Bring your king close. It covers the squares the bishops cannot.',
      'Mate happens in the corner, with the bishops and king working together.',
    ],
  },
];
