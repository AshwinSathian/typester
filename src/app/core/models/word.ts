import { Difficulty } from './difficulty';

export interface WordEntry {
  readonly text: string;
  readonly difficulty: Difficulty;
  /** Power words are worth double points when typed correctly (see DESIGN §Gamification). */
  readonly isPowerWord: boolean;
}
