import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { StorageService } from '../../core/services/storage.service';
import { Stats } from './stats';

describe('Stats', () => {
  beforeEach(() => {
    window.localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  it('renders all 10 combos in the best-scores grid, reachable without playing a round', () => {
    const fixture = TestBed.createComponent(Stats);
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll(
      '.stats__card--best-scores .stats__combo-row',
    );
    expect(rows).toHaveLength(10);
  });

  it('renders all 9 Endless combos (3 difficulties x 3 lives) in their own section', () => {
    const fixture = TestBed.createComponent(Stats);
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('.stats__card--endless .stats__combo-row');
    expect(rows).toHaveLength(9);
  });

  it('shows a beaten Endless combo score, distinct from the Quick/Timed grid', () => {
    const storage = TestBed.inject(StorageService);
    storage.recordResult({
      config: { mode: 'endless', difficulty: 'easy', durationSeconds: 5 },
      wordsCorrect: 12,
      wordsIncorrect: 2,
      baseScore: 12,
      timeBonus: 0,
      totalScore: 12,
      wpm: 30,
      accuracy: 0.86,
      bestStreak: 6,
      achievementsUnlocked: [],
      finishedAt: new Date().toISOString(),
    });

    const fixture = TestBed.createComponent(Stats);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelectorAll('.stats__card--endless .stats__combo-score')).toHaveLength(1);
    expect(el.querySelectorAll('.stats__card--best-scores .stats__combo-score')).toHaveLength(0);
  });

  it('shows a Play action for an unplayed combo and a score for a beaten one', () => {
    const storage = TestBed.inject(StorageService);
    storage.recordResult({
      config: { mode: 'timed', difficulty: 'easy', durationSeconds: 30 },
      wordsCorrect: 10,
      wordsIncorrect: 0,
      baseScore: 10,
      timeBonus: 5,
      totalScore: 15,
      wpm: 40,
      accuracy: 1,
      bestStreak: 10,
      achievementsUnlocked: [],
      finishedAt: new Date().toISOString(),
    });

    const fixture = TestBed.createComponent(Stats);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelectorAll('.stats__combo-score')).toHaveLength(1);
    expect(el.querySelectorAll('.stats__combo-placeholder').length).toBeGreaterThan(0);
  });

  it('renders locked and unlocked achievements distinctly', () => {
    const storage = TestBed.inject(StorageService);
    storage.recordResult({
      config: { mode: 'timed', difficulty: 'easy', durationSeconds: 30 },
      wordsCorrect: 10,
      wordsIncorrect: 0,
      baseScore: 10,
      timeBonus: 5,
      totalScore: 15,
      wpm: 40,
      accuracy: 1,
      bestStreak: 10,
      achievementsUnlocked: [],
      finishedAt: new Date().toISOString(),
    });

    const fixture = TestBed.createComponent(Stats);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelectorAll('.stats__achievement--unlocked').length).toBeGreaterThan(0);
    expect(
      el.querySelectorAll('.stats__achievement:not(.stats__achievement--unlocked)').length,
    ).toBeGreaterThan(0);
  });

  it('navigates to Home from Back to Menu', () => {
    const fixture = TestBed.createComponent(Stats);
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.detectChanges();

    fixture.nativeElement.querySelector('.stats > app-button button').click();
    expect(navigateSpy).toHaveBeenCalledWith(['/']);
  });

  it('starts an unplayed combo round when its Play button is clicked', () => {
    const fixture = TestBed.createComponent(Stats);
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.detectChanges();

    const playButton = fixture.nativeElement.querySelector(
      '.stats__combo-unplayed app-button button',
    ) as HTMLButtonElement;
    playButton.click();

    expect(navigateSpy).toHaveBeenCalledWith(['/play', 'quick', 'mixed', 90]);
  });
});
