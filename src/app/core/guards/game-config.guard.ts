import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { isValidGameConfig } from '../models/game-config';
import { isDailyDateAllowed, utcDateString } from '../services/daily-challenge';

/**
 * Validates /play/:mode/:difficulty/:duration. Game configuration lives
 * entirely in the route (see ARCHITECTURE.md §D3) - this guard is the only
 * gate, replacing the legacy app's mutable accessGame-boolean pattern.
 * An invalid combination redirects home instead of entering a broken game.
 */
export const gameConfigGuard: CanActivateFn = (route) => {
  const router = inject(Router);
  const { mode, difficulty, duration } = route.params;

  if (isValidGameConfig(mode, difficulty, duration)) {
    return true;
  }

  return router.createUrlTree(['/']);
};

/**
 * Validates /play/daily/:date - same "redirect home on anything invalid"
 * philosophy as gameConfigGuard, extended with a date-format + not-in-the-
 * future check instead of a mode/difficulty/duration check.
 */
export const dailyChallengeGuard: CanActivateFn = (route) => {
  const router = inject(Router);
  const { date } = route.params;

  if (typeof date === 'string' && isDailyDateAllowed(date, utcDateString(new Date()))) {
    return true;
  }

  return router.createUrlTree(['/']);
};
