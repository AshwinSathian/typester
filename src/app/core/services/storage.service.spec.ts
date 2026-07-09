import { TestBed } from '@angular/core/testing';

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
