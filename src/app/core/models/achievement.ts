export type AchievementId =
  | 'first-round'
  | 'wpm-30'
  | 'wpm-50'
  | 'wpm-70'
  | 'wpm-90'
  | 'wpm-110'
  | 'perfect-accuracy'
  | 'streak-10'
  | 'streak-day-7'
  | 'streak-day-30'
  | 'streak-day-100'
  | 'all-difficulties';

export interface AchievementDef {
  readonly id: AchievementId;
  readonly title: string;
  readonly description: string;
}

/** WPM Club tiers, ordered ascending - both the round-result check
 *  (game-engine.ts evaluateAchievements) and the Results "closest miss"
 *  progress line iterate this same list. */
export const WPM_CLUB_TIERS: readonly number[] = [30, 50, 70, 90, 110];

/** Day-streak milestone tiers, ordered ascending. */
export const DAY_STREAK_TIERS: readonly number[] = [7, 30, 100];

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  {
    id: 'first-round',
    title: 'First Round',
    description: 'Finish your first round.',
  },
  ...WPM_CLUB_TIERS.map((tier): AchievementDef => ({
    id: `wpm-${tier}` as AchievementId,
    title: `${tier} WPM Club`,
    description: `Reach ${tier} words per minute in a single round.`,
  })),
  {
    id: 'perfect-accuracy',
    title: 'Perfect Accuracy',
    description: 'Finish a round with 100% accuracy.',
  },
  {
    id: 'streak-10',
    title: '10-Streak',
    description: 'Type 10 words correctly in a row.',
  },
  ...DAY_STREAK_TIERS.map((tier): AchievementDef => ({
    id: `streak-day-${tier}` as AchievementId,
    title: `${tier}-Day Streak`,
    description: `Play Typester ${tier} days in a row.`,
  })),
  {
    id: 'all-difficulties',
    title: 'Every Difficulty Beaten',
    description: 'Set a best score on easy, medium, and hard.',
  },
];
