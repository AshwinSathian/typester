import { AchievementId } from './achievement';
import { GameConfig } from './game-config';

export interface GameResult {
  readonly config: GameConfig;
  readonly wordsCorrect: number;
  readonly wordsIncorrect: number;
  /** Sum of per-word points, combo multiplier and power-word bonuses already applied. */
  readonly baseScore: number;
  readonly timeBonus: number;
  readonly totalScore: number;
  readonly wpm: number;
  /** 0..1 */
  readonly accuracy: number;
  readonly bestStreak: number;
  readonly achievementsUnlocked: readonly AchievementId[];
  readonly finishedAt: string;
}
