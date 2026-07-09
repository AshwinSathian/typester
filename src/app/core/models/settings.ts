export type ThemePreference = 'light' | 'dark' | 'system';
export type MotionPreference = 'system' | 'reduced' | 'full';

export interface Settings {
  readonly theme: ThemePreference;
  readonly soundEnabled: boolean;
  readonly motion: MotionPreference;
  /** Overrides QUICK_PLAY_DURATION_SECONDS; range enforced by the settings form (15-300s). */
  readonly quickPlayDurationSeconds: number;
  /** Set once the first-visit local-storage disclosure banner is dismissed. */
  readonly localStorageNoticeDismissed: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  soundEnabled: true,
  motion: 'system',
  quickPlayDurationSeconds: 90,
  localStorageNoticeDismissed: false,
};
