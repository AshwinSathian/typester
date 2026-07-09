import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { GameConfig } from '../../core/models/game-config';
import { GameResult } from '../../core/models/game-result';
import { ShareService } from '../../core/services/share.service';
import { Results } from './results';

function fixtureResult(overrides: Partial<GameResult> = {}): GameResult {
  const config: GameConfig = { mode: 'timed', difficulty: 'medium', durationSeconds: 60 };
  return {
    config,
    wordsCorrect: 20,
    wordsIncorrect: 1,
    baseScore: 40,
    timeBonus: 10,
    totalScore: 50,
    wpm: 45,
    accuracy: 0.9524,
    bestStreak: 12,
    achievementsUnlocked: ['wpm-50' as const].slice(0, 0), // no achievements by default
    finishedAt: new Date('2026-07-09T00:00:00.000Z').toISOString(),
    ...overrides,
  };
}

describe('Results', () => {
  beforeEach(() => {
    window.localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  afterEach(() => {
    window.history.replaceState({}, '');
  });

  it('renders Total first (visually dominant), then the secondary stat row', () => {
    window.history.replaceState({ result: fixtureResult(), isNewBest: false }, '');
    const fixture = TestBed.createComponent(Results);
    fixture.detectChanges();

    const values = Array.from(fixture.nativeElement.querySelectorAll('.app-stat-badge__value')).map(
      (el) => (el as HTMLElement).textContent?.trim(),
    );

    expect(values).toEqual(['50', '40', '10', '45', '95%']);
  });

  it('shows the New Best badge only when isNewBest is true', () => {
    window.history.replaceState({ result: fixtureResult(), isNewBest: true }, '');
    const fixture = TestBed.createComponent(Results);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.results__badge')).not.toBeNull();
  });

  it('does not show the New Best badge when isNewBest is false', () => {
    window.history.replaceState({ result: fixtureResult(), isNewBest: false }, '');
    const fixture = TestBed.createComponent(Results);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.results__badge')).toBeNull();
  });

  it('renders a confetti burst only alongside the New Best badge', () => {
    window.history.replaceState({ result: fixtureResult(), isNewBest: true }, '');
    const fixture = TestBed.createComponent(Results);
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelectorAll('.results__confetti-piece').length,
    ).toBeGreaterThan(0);
  });

  it('renders no confetti pieces when there is no New Best', () => {
    window.history.replaceState({ result: fixtureResult(), isNewBest: false }, '');
    const fixture = TestBed.createComponent(Results);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.results__confetti-piece').length).toBe(0);
  });

  it('renders unlocked achievement badges', () => {
    window.history.replaceState(
      {
        result: fixtureResult({ achievementsUnlocked: ['wpm-50', 'streak-10'] }),
        isNewBest: false,
      },
      '',
    );
    const fixture = TestBed.createComponent(Results);
    fixture.detectChanges();

    const chips = Array.from(fixture.nativeElement.querySelectorAll('.results__achievement')).map(
      (el) => (el as HTMLElement).textContent?.trim(),
    );
    expect(chips).toEqual(['50 WPM Club', '10-Streak']);
  });

  it('shows the closest-miss line only when nothing unlocked this round', () => {
    window.history.replaceState(
      { result: fixtureResult(), isNewBest: false, closestMiss: '6 more WPM for the 50 WPM Club' },
      '',
    );
    const fixture = TestBed.createComponent(Results);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.results__closest-miss')?.textContent?.trim()).toBe(
      '6 more WPM for the 50 WPM Club',
    );
  });

  it('prefers unlocked-achievement chips over the closest-miss line', () => {
    window.history.replaceState(
      {
        result: fixtureResult({ achievementsUnlocked: ['wpm-50'] }),
        isNewBest: false,
        closestMiss: 'should not show',
      },
      '',
    );
    const fixture = TestBed.createComponent(Results);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.results__closest-miss')).toBeNull();
    expect(fixture.nativeElement.querySelector('.results__achievement')).not.toBeNull();
  });

  it('shows the Typester Daily sub-brand eyebrow for a daily-challenge result', () => {
    window.history.replaceState(
      {
        result: fixtureResult(),
        isNewBest: false,
        dailyChallenge: {
          date: '2026-07-09',
          seed: 1,
          config: fixtureResult().config,
          dayNumber: 7,
        },
      },
      '',
    );
    const fixture = TestBed.createComponent(Results);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.results__eyebrow')?.textContent).toContain(
      'Typester Daily #7',
    );
  });

  it('shows a streak-freeze note when this round consumed one', () => {
    window.history.replaceState(
      { result: fixtureResult(), isNewBest: false, freezeConsumed: true },
      '',
    );
    const fixture = TestBed.createComponent(Results);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.results__freeze-note')).not.toBeNull();
  });

  it('suggests the next unbeaten combo only alongside a new best', () => {
    window.history.replaceState({ result: fixtureResult(), isNewBest: true }, '');
    const fixture = TestBed.createComponent(Results);
    fixture.detectChanges();

    const suggestion = Array.from(fixture.nativeElement.querySelectorAll('app-button')).find(
      (btn) => (btn as HTMLElement).textContent?.includes('New best'),
    );
    expect(suggestion).not.toBeUndefined();
  });

  it('does not suggest a next combo without a new best', () => {
    window.history.replaceState({ result: fixtureResult(), isNewBest: false }, '');
    const fixture = TestBed.createComponent(Results);
    fixture.detectChanges();

    const suggestion = Array.from(fixture.nativeElement.querySelectorAll('app-button')).find(
      (btn) => (btn as HTMLElement).textContent?.includes('New best'),
    );
    expect(suggestion).toBeUndefined();
  });

  it('redirects home when there is no result in navigation state', () => {
    window.history.replaceState({}, '');
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    TestBed.createComponent(Results);

    expect(navigateSpy).toHaveBeenCalledWith(['/']);
  });

  it('navigates to a fresh round with the same config on Play Again', () => {
    window.history.replaceState({ result: fixtureResult(), isNewBest: false }, '');
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(Results);
    fixture.detectChanges();

    fixture.componentInstance.playAgain();

    expect(navigateSpy).toHaveBeenCalledWith(['/play', 'timed', 'medium', 60]);
  });

  it('navigates home on Menu', () => {
    window.history.replaceState({ result: fixtureResult(), isNewBest: false }, '');
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(Results);
    fixture.detectChanges();

    fixture.componentInstance.goToMenu();

    expect(navigateSpy).toHaveBeenCalledWith(['/']);
  });

  it('shows a "Copied to clipboard" toast when ShareService falls back to clipboard', async () => {
    window.history.replaceState({ result: fixtureResult(), isNewBest: false }, '');
    TestBed.overrideProvider(ShareService, {
      useValue: { share: vi.fn().mockResolvedValue('copied') },
    });
    const fixture = TestBed.createComponent(Results);
    fixture.detectChanges();

    await fixture.componentInstance.shareResult();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.app-toast')?.textContent?.trim()).toBe(
      'Copied to clipboard',
    );
  });

  it('shows no toast when the Web Share sheet opens successfully', async () => {
    window.history.replaceState({ result: fixtureResult(), isNewBest: false }, '');
    TestBed.overrideProvider(ShareService, {
      useValue: { share: vi.fn().mockResolvedValue('shared') },
    });
    const fixture = TestBed.createComponent(Results);
    fixture.detectChanges();

    await fixture.componentInstance.shareResult();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.app-toast')).toBeNull();
  });
});
