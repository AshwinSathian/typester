import { TestBed } from '@angular/core/testing';

import { buildDailyChallenge } from './daily-challenge';
import { GameConfig } from '../models/game-config';
import { GameResult } from '../models/game-result';
import { DEFAULT_SETTINGS } from '../models/settings';
import { DEFAULT_STATS } from '../models/stats';
import { StorageService } from './storage.service';

function fixtureResult(overrides: Partial<GameResult> = {}): GameResult {
  const config: GameConfig = { mode: 'timed', difficulty: 'easy', durationSeconds: 30 };
  return {
    config,
    wordsCorrect: 10,
    wordsIncorrect: 0,
    baseScore: 10,
    timeBonus: 5,
    totalScore: 15,
    wpm: 40,
    accuracy: 1,
    bestStreak: 10,
    achievementsUnlocked: [],
    finishedAt: new Date('2026-07-09T00:00:00.000Z').toISOString(),
    ...overrides,
  };
}

describe('StorageService', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('falls back to defaults on a fresh install', () => {
    const service = TestBed.inject(StorageService);
    expect(service.settings()).toEqual(DEFAULT_SETTINGS);
    expect(service.stats()).toEqual(DEFAULT_STATS);
  });

  it('round-trips a settings update through localStorage', () => {
    const service = TestBed.inject(StorageService);
    service.updateSettings({ soundEnabled: false, theme: 'dark' });

    expect(service.settings().soundEnabled).toBe(false);
    expect(service.settings().theme).toBe('dark');

    const persisted = JSON.parse(window.localStorage.getItem('typester:v1:settings')!);
    expect(persisted.soundEnabled).toBe(false);
    expect(persisted.theme).toBe('dark');
  });

  it('falls back to defaults when stored data is corrupted or the wrong shape', () => {
    window.localStorage.setItem('typester:v1:settings', '{not valid json');
    window.localStorage.setItem('typester:v1:stats', JSON.stringify({ unrelated: true }));

    const service = TestBed.inject(StorageService);
    expect(service.settings()).toEqual(DEFAULT_SETTINGS);
    expect(service.stats()).toEqual(DEFAULT_STATS);
  });

  it('records a round result, updates best score, and merges achievements', () => {
    const service = TestBed.inject(StorageService);
    const outcome = service.recordResult(fixtureResult());

    expect(outcome.isNewBest).toBe(true);
    expect(outcome.achievementsUnlocked).toContain('first-round');
    expect(service.stats().roundsPlayed).toBe(1);
    expect(service.stats().totalWordsTyped).toBe(10);
    expect(service.stats().bestScores['timed:easy:30'].totalScore).toBe(15);
    expect(service.stats().difficultiesBeaten).toContain('easy');
  });

  it('does not overwrite an existing best score with a lower one', () => {
    const service = TestBed.inject(StorageService);
    service.recordResult(fixtureResult({ totalScore: 50 }));
    const outcome = service.recordResult(fixtureResult({ totalScore: 10 }));

    expect(outcome.isNewBest).toBe(false);
    expect(service.stats().bestScores['timed:easy:30'].totalScore).toBe(50);
  });

  it('only tracks difficultiesBeaten for timed mode, not quick play', () => {
    const service = TestBed.inject(StorageService);
    service.recordResult(
      fixtureResult({ config: { mode: 'quick', difficulty: 'mixed', durationSeconds: 90 } }),
    );
    expect(service.stats().difficultiesBeaten).toEqual([]);
  });

  it('starts a day streak of 1 on the first recorded round', () => {
    const service = TestBed.inject(StorageService);
    service.recordResult(fixtureResult({ finishedAt: '2026-07-09T00:00:00.000Z' }));

    expect(service.stats().dayStreak).toBe(1);
    expect(service.stats().lastPlayedDate).toBe('2026-07-09');
  });

  it('does not increment the day streak for a second round on the same day', () => {
    const service = TestBed.inject(StorageService);
    service.recordResult(fixtureResult({ finishedAt: '2026-07-09T00:00:00.000Z' }));
    service.recordResult(fixtureResult({ finishedAt: '2026-07-09T23:00:00.000Z' }));

    expect(service.stats().dayStreak).toBe(1);
  });

  it('increments the day streak on the very next calendar day', () => {
    const service = TestBed.inject(StorageService);
    service.recordResult(fixtureResult({ finishedAt: '2026-07-09T12:00:00.000Z' }));
    service.recordResult(fixtureResult({ finishedAt: '2026-07-10T01:00:00.000Z' }));

    expect(service.stats().dayStreak).toBe(2);
  });

  it('resets the day streak to 1 after a skipped day', () => {
    const service = TestBed.inject(StorageService);
    service.recordResult(fixtureResult({ finishedAt: '2026-07-09T12:00:00.000Z' }));
    service.recordResult(fixtureResult({ finishedAt: '2026-07-11T01:00:00.000Z' }));

    expect(service.stats().dayStreak).toBe(1);
    expect(service.stats().lastPlayedDate).toBe('2026-07-11');
  });

  it('defaults dayStreak/lastPlayedDate for stats persisted before those fields existed', () => {
    window.localStorage.setItem(
      'typester:v1:stats',
      JSON.stringify({
        bestScores: {},
        achievementsUnlocked: [],
        roundsPlayed: 3,
        totalWordsTyped: 30,
        difficultiesBeaten: ['easy'],
      }),
    );

    const service = TestBed.inject(StorageService);
    expect(service.stats().dayStreak).toBe(0);
    expect(service.stats().lastPlayedDate).toBeNull();
    expect(service.stats().roundsPlayed).toBe(3);
  });

  it('awards a streak-freeze token every 7 consecutive days, not before', () => {
    const service = TestBed.inject(StorageService);
    for (let day = 0; day < 6; day++) {
      service.recordResult(
        fixtureResult({ finishedAt: `2026-07-${String(day + 1).padStart(2, '0')}T12:00:00.000Z` }),
      );
    }
    expect(service.stats().dayStreak).toBe(6);
    expect(service.stats().streakFreezeCount).toBe(0);

    service.recordResult(fixtureResult({ finishedAt: '2026-07-07T12:00:00.000Z' }));
    expect(service.stats().dayStreak).toBe(7);
    expect(service.stats().streakFreezeCount).toBe(1);
  });

  it('consumes exactly one freeze token to forgive exactly one missed day', () => {
    const service = TestBed.inject(StorageService);
    for (let day = 1; day <= 7; day++) {
      service.recordResult(
        fixtureResult({ finishedAt: `2026-07-${String(day).padStart(2, '0')}T12:00:00.000Z` }),
      );
    }
    expect(service.stats().streakFreezeCount).toBe(1);

    // Day 8 is skipped entirely; playing again on day 9 should consume the
    // one freeze token and continue the streak rather than resetting it.
    const outcome = service.recordResult(fixtureResult({ finishedAt: '2026-07-09T12:00:00.000Z' }));
    expect(outcome.freezeConsumed).toBe(true);
    expect(service.stats().dayStreak).toBe(8);
    expect(service.stats().streakFreezeCount).toBe(0);

    // A second consecutive gap with no freeze left resets to 1, not another forgiveness.
    const secondOutcome = service.recordResult(
      fixtureResult({ finishedAt: '2026-07-11T12:00:00.000Z' }),
    );
    expect(secondOutcome.freezeConsumed).toBe(false);
    expect(service.stats().dayStreak).toBe(1);
  });

  it('records a daily-challenge result into its own dailyResults bucket, never bestScores', () => {
    const service = TestBed.inject(StorageService);
    const challenge = buildDailyChallenge('2026-07-09');
    const outcome = service.recordDailyResult(
      challenge,
      fixtureResult({ finishedAt: '2026-07-09T12:00:00.000Z' }),
    );

    expect(outcome.isNewBest).toBe(true);
    expect(service.stats().dailyResults['2026-07-09'].totalScore).toBe(15);
    expect(service.stats().dailyResults['2026-07-09'].dayNumber).toBe(challenge.dayNumber);
    expect(service.stats().bestScores['timed:medium:60']).toBeUndefined();
    expect(service.stats().roundsPlayed).toBe(1);
  });

  it('keeps the higher score when the same daily date is replayed', () => {
    const service = TestBed.inject(StorageService);
    const challenge = buildDailyChallenge('2026-07-09');
    service.recordDailyResult(
      challenge,
      fixtureResult({ totalScore: 50, finishedAt: '2026-07-09T12:00:00.000Z' }),
    );
    const outcome = service.recordDailyResult(
      challenge,
      fixtureResult({ totalScore: 10, finishedAt: '2026-07-09T13:00:00.000Z' }),
    );

    expect(outcome.isNewBest).toBe(false);
    expect(service.stats().dailyResults['2026-07-09'].totalScore).toBe(50);
  });

  it('reconciles stats written by another tab via the storage event', () => {
    const service = TestBed.inject(StorageService);
    service.recordResult(fixtureResult());

    // Simulate a second tab writing a newer stats blob directly to localStorage,
    // then firing the cross-tab `storage` event this tab listens for.
    const otherTabStats = {
      ...service.stats(),
      roundsPlayed: 99,
    };
    window.localStorage.setItem('typester:v1:stats', JSON.stringify(otherTabStats));
    window.dispatchEvent(new StorageEvent('storage', { key: 'typester:v1:stats' }));

    expect(service.stats().roundsPlayed).toBe(99);
  });
});
