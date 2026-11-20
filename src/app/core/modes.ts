import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';

import { ModeId } from './engine';

export interface ModeSpec {
  readonly id: ModeId;
  readonly name: string;
  /** One line on the home screen: what the mode asks of you. */
  readonly blurb: string;
}

export const MODES: Readonly<Record<ModeId, ModeSpec>> = {
  rush: {
    id: 'rush',
    name: 'Rush',
    blurb: 'Every word buys time. Words get longer and buy less of it.',
  },
  sprint: { id: 'sprint', name: 'Sprint', blurb: 'Sixty seconds, as many words as you can.' },
  daily: {
    id: 'daily',
    name: 'Daily',
    blurb: 'A Rush with the same words for everyone today.',
  },
  drill: {
    id: 'drill',
    name: 'Drill',
    blurb: 'Forty-five seconds of words full of the keys you miss most.',
  },
};

export function isModeId(value: unknown): value is ModeId {
  return typeof value === 'string' && Object.hasOwn(MODES, value);
}

/** `/play/:mode` only opens for a real mode; anything else goes home. */
export const modeGuard: CanActivateFn = (route) =>
  isModeId(route.paramMap.get('mode')) || inject(Router).createUrlTree(['/']);
