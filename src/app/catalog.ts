import type { IconName } from '../ui/icons';

/** The four kinds of game. Every game screen and card wears one of these tags. */
export type Family = 'puzzle' | 'timed' | 'bot' | 'learn';

export const FAMILY_LABEL: Record<Family, string> = {
  puzzle: 'Puzzle',
  timed: 'Timed',
  bot: 'Vs computer',
  learn: 'Learn',
};

export type GameId = 'daily' | 'm1' | 'm2' | 'm3' | 'rush' | 'ghost' | 'streak' | 'coords' | 'themes' | 'retry' | 'endgame' | 'quick' | 'lessons' | 'pieces';

export interface GameInfo {
  id: GameId;
  family: Family;
  name: string;
  /** One line shown on cards. */
  short: string;
  /** What you do, shown on the start sheet. */
  rule: string;
  /** Rough length, e.g. "1 min". */
  time: string;
  goal: string;
  icon: IconName;
}

/** Single source of truth for names, rules and times, so every screen says the same thing. */
export const GAMES: Record<GameId, GameInfo> = {
  daily: {
    id: 'daily',
    family: 'puzzle',
    name: 'Daily Puzzle',
    short: 'One new checkmate every day',
    rule: 'Find the move that leads to checkmate. There is a new puzzle each day.',
    time: '1 min',
    goal: 'Deliver checkmate',
    icon: 'calendar',
  },
  m1: {
    id: 'm1',
    family: 'puzzle',
    name: 'Mate in 1',
    short: 'One move wins',
    rule: 'It is your move. Find the one move that checkmates.',
    time: '30 sec',
    goal: 'Checkmate this move',
    icon: 'target',
  },
  m2: {
    id: 'm2',
    family: 'puzzle',
    name: 'Mate in 2',
    short: 'Two moves win',
    rule: 'Find a move so that, whatever the opponent replies, you checkmate on your next move.',
    time: '1 min',
    goal: 'Checkmate in 2 moves',
    icon: 'target',
  },
  m3: {
    id: 'm3',
    family: 'puzzle',
    name: 'Mate in 3',
    short: 'Three moves win',
    rule: 'Look for a forcing plan: three of your moves end in checkmate.',
    time: '2 min',
    goal: 'Checkmate in 3 moves',
    icon: 'target',
  },
  rush: {
    id: 'rush',
    family: 'timed',
    name: 'Puzzle Rush',
    short: '3 minutes · 3 strikes',
    rule: 'Solve as many checkmate puzzles as you can in 3 minutes. Three wrong moves end the run.',
    time: '3 min',
    goal: 'Beat your best score',
    icon: 'zap',
  },
  ghost: {
    id: 'ghost',
    family: 'timed',
    name: 'Ghost Race',
    short: 'Race your own best run',
    rule: 'Solve puzzles for 90 seconds. A ghost replays your best run, so you can see if you are ahead.',
    time: '90 sec',
    goal: 'Stay ahead of the ghost',
    icon: 'zap',
  },
  themes: {
    id: 'themes',
    family: 'learn',
    name: 'Themes',
    short: 'Fork, pin, back rank…',
    rule: 'Pick one tactical pattern and practise it. Solve 10 to master it.',
    time: '3 min',
    goal: 'Master a pattern',
    icon: 'target',
  },
  lessons: {
    id: 'lessons',
    family: 'learn',
    name: 'Endgame Lessons',
    short: 'King + Queen, King + Rook…',
    rule: 'Learn the standard ways to checkmate, with steps to follow and the computer defending.',
    time: '5 min',
    goal: 'Checkmate each lesson',
    icon: 'bulb',
  },
  pieces: {
    id: 'pieces',
    family: 'learn',
    name: 'Learn the Pieces',
    short: 'How every piece moves',
    rule: 'Move one piece around the board and capture every pawn. Fewer moves earn more stars.',
    time: '1 min',
    goal: 'Capture all the pawns',
    icon: 'board',
  },
  streak: {
    id: 'streak',
    family: 'puzzle',
    name: 'Streak',
    short: 'No clock. Keep going until you miss',
    rule: 'Puzzles get a little harder each time. Your first wrong move ends the streak.',
    time: '2–5 min',
    goal: 'Beat your longest streak',
    icon: 'repeat',
  },
  coords: {
    id: 'coords',
    family: 'timed',
    name: 'Coordinates',
    short: 'Tap the named square',
    rule: 'A square name appears, like e4. Tap that square on the empty board. You have 30 seconds.',
    time: '30 sec',
    goal: 'Score as high as you can',
    icon: 'board',
  },
  retry: {
    id: 'retry',
    family: 'puzzle',
    name: 'Retry mistakes',
    short: 'Puzzles you missed',
    rule: 'Try the puzzles you got wrong again. No clock.',
    time: '2 min',
    goal: 'Clear your list',
    icon: 'repeat',
  },
  endgame: {
    id: 'endgame',
    family: 'bot',
    name: 'Win the Endgame',
    short: 'Start ahead, finish the job',
    rule: 'You begin with a winning position. Convert it to checkmate against the computer.',
    time: '5 min',
    goal: 'Checkmate the computer',
    icon: 'crown',
  },
  quick: {
    id: 'quick',
    family: 'bot',
    name: 'Quick Game',
    short: 'A full game vs the computer',
    rule: 'Choose a level and your colour, then play a normal game from the start.',
    time: '10–20 min',
    goal: 'Checkmate the computer',
    icon: 'play',
  },
};

/** Mate-in-N cards use skill words, so they don't clash with the per-puzzle Easy/Medium/Hard chips. */
export const MATE_LEVEL: Record<1 | 2 | 3, string> = { 1: 'Beginner', 2: 'Improver', 3: 'Strong' };

/** "I have N minutes" → games that fit. */
export const BY_TIME: Record<'1' | '3' | '10', GameId[]> = {
  '1': ['daily', 'm1', 'coords'],
  '3': ['rush', 'streak', 'themes'],
  '10': ['quick', 'endgame', 'lessons'],
};
