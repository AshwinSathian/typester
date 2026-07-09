export type AchievementId =
  'first-round' | 'wpm-50' | 'perfect-accuracy' | 'streak-10' | 'all-difficulties';

export interface AchievementDef {
  readonly id: AchievementId;
  readonly title: string;
  readonly description: string;
}

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  {
    id: 'first-round',
    title: 'First Round',
    description: 'Finish your first round.',
  },
  {
    id: 'wpm-50',
    title: '50 WPM Club',
    description: 'Reach 50 words per minute in a single round.',
  },
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
  {
    id: 'all-difficulties',
    title: 'Every Difficulty Beaten',
    description: 'Set a best score on easy, medium, and hard.',
  },
];
