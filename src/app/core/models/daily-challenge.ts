import { GameConfig } from './game-config';

export interface DailyChallenge {
  /** UTC `YYYY-MM-DD`. */
  readonly date: string;
  readonly seed: number;
  readonly config: GameConfig;
  /** "Typester Daily #N" sub-brand number - days since DAILY_CHALLENGE_EPOCH. */
  readonly dayNumber: number;
}
