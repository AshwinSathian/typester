import { TestBed } from '@angular/core/testing';

import { GameConfig } from '../models/game-config';
import { GameResult } from '../models/game-result';
import { ShareCardService } from './share-card.service';

function fixtureResult(overrides: Partial<GameResult> = {}): GameResult {
  const config: GameConfig = { mode: 'timed', difficulty: 'medium', durationSeconds: 60 };
  return {
    config,
    wordsCorrect: 20,
    wordsIncorrect: 1,
    baseScore: 40,
    timeBonus: 10,
    totalScore: 50,
    wpm: 62,
    accuracy: 0.95,
    bestStreak: 12,
    achievementsUnlocked: [],
    finishedAt: new Date('2026-07-09T00:00:00.000Z').toISOString(),
    ...overrides,
  };
}

describe('ShareCardService', () => {
  it('never throws even when the test environment has no 2D canvas context (jsdom)', async () => {
    const service = TestBed.inject(ShareCardService);
    await expect(
      service.generate({ result: fixtureResult(), dailyChallenge: null }),
    ).resolves.not.toThrow();
  });

  it('resolves to a Blob or null, never rejects, for a daily-challenge result', async () => {
    const service = TestBed.inject(ShareCardService);
    const outcome = await service.generate({
      result: fixtureResult(),
      dailyChallenge: { date: '2026-07-09', seed: 1, config: fixtureResult().config, dayNumber: 1 },
    });
    expect(outcome === null || outcome instanceof Blob).toBe(true);
  });
});
