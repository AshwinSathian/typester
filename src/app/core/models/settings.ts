export type ThemePreference = 'light' | 'dark' | 'system';
export type MotionPreference = 'system' | 'reduced' | 'full';

export interface Settings {
  readonly theme: ThemePreference;
  readonly soundEnabled: boolean;
  readonly motion: MotionPreference;
  /** Overrides QUICK_PLAY_DURATION_SECONDS; range enforced by the settings form (15-300s). */
  readonly quickPlayDurationSeconds: number;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  soundEnabled: true,
  motion: 'system',
  quickPlayDurationSeconds: 90,
};
