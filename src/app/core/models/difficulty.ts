export type Difficulty = 'easy' | 'medium' | 'hard';

export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];

/** Base points awarded per correctly typed word, before any combo/power-word bonus. */
export const DIFFICULTY_POINTS: Readonly<Record<Difficulty, number>> = {
  easy: 1,
  medium: 2,
  hard: 3,
};

/** Word length band each difficulty tier draws from (used by word-source.service.ts). */
export const DIFFICULTY_LENGTH_RANGE: Readonly<Record<Difficulty, readonly [number, number]>> = {
  easy: [3, 5],
  medium: [6, 8],
  hard: [9, 15],
};
