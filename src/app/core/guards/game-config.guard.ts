import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { isValidGameConfig } from '../models/game-config';

/**
 * Validates /play/:mode/:difficulty/:duration. Game configuration lives
 * entirely in the route (see PLAN-typester.md D3) - this guard is the only
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
