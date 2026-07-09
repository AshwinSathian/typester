import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { provideRouter } from '@angular/router';

import { utcDateString } from '../services/daily-challenge';
import { dailyChallengeGuard, gameConfigGuard } from './game-config.guard';

function snapshotWithParams(params: Record<string, string>): ActivatedRouteSnapshot {
  return { params } as unknown as ActivatedRouteSnapshot;
}

describe('gameConfigGuard', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  function runGuard(params: Record<string, string>): boolean | UrlTree {
    return TestBed.runInInjectionContext(() =>
      gameConfigGuard(snapshotWithParams(params), {} as RouterStateSnapshot),
    ) as boolean | UrlTree;
  }

  it('allows a valid quick play route', () => {
    expect(runGuard({ mode: 'quick', difficulty: 'mixed', duration: '90' })).toBe(true);
  });

  it('allows a valid timed route for every difficulty/duration combination', () => {
    for (const difficulty of ['easy', 'medium', 'hard']) {
      for (const duration of ['30', '60', '120']) {
        expect(runGuard({ mode: 'timed', difficulty, duration })).toBe(true);
      }
    }
  });

  it('redirects home on an invalid mode', () => {
    const result = runGuard({ mode: 'bogus', difficulty: 'easy', duration: '30' });
    expect(result).toBeInstanceOf(UrlTree);
  });

  it('redirects home when quick mode is combined with a non-mixed difficulty', () => {
    const result = runGuard({ mode: 'quick', difficulty: 'easy', duration: '90' });
    expect(result).toBeInstanceOf(UrlTree);
  });

  it('redirects home on a duration outside the allowed set for timed mode', () => {
    const result = runGuard({ mode: 'timed', difficulty: 'easy', duration: '45' });
    expect(result).toBeInstanceOf(UrlTree);
  });

  it('allows a valid endless route for every difficulty/lives combination', () => {
    for (const difficulty of ['easy', 'medium', 'hard']) {
      for (const lives of ['3', '5', '10']) {
        expect(runGuard({ mode: 'endless', difficulty, duration: lives })).toBe(true);
      }
    }
  });

  it('redirects home on a lives count outside the allowed set for endless mode', () => {
    const result = runGuard({ mode: 'endless', difficulty: 'easy', duration: '7' });
    expect(result).toBeInstanceOf(UrlTree);
  });

  it('redirects home to the root path', () => {
    const router = TestBed.inject(Router);
    const result = runGuard({ mode: 'nope', difficulty: 'nope', duration: 'nope' }) as UrlTree;
    expect(router.serializeUrl(result)).toBe('/');
  });
});

describe('dailyChallengeGuard', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  function runGuard(params: Record<string, string>): boolean | UrlTree {
    return TestBed.runInInjectionContext(() =>
      dailyChallengeGuard(snapshotWithParams(params), {} as RouterStateSnapshot),
    ) as boolean | UrlTree;
  }

  it("allows today's date", () => {
    expect(runGuard({ date: utcDateString(new Date()) })).toBe(true);
  });

  it('allows a past date', () => {
    expect(runGuard({ date: '2000-01-01' })).toBe(true);
  });

  it('redirects home for a future date', () => {
    expect(runGuard({ date: '2999-01-01' })).toBeInstanceOf(UrlTree);
  });

  it('redirects home for a malformed date', () => {
    expect(runGuard({ date: 'not-a-date' })).toBeInstanceOf(UrlTree);
  });
});
