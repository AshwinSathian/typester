import { TestBed } from '@angular/core/testing';

import { DailyChallengeService } from './daily-challenge.service';

describe('DailyChallengeService', () => {
  function service(): DailyChallengeService {
    return TestBed.inject(DailyChallengeService);
  }

  it('produces byte-identical word lists for two independent calls on the same date', () => {
    const challenge = service().challengeFor('2026-07-09');
    const wordsA = service().buildWords(challenge);
    const wordsB = service().buildWords(challenge);
    expect(wordsA).toEqual(wordsB);
  });

  it("produces a different word order for tomorrow's date", () => {
    const today = service().challengeFor('2026-07-09');
    const tomorrow = service().challengeFor('2026-07-10');
    const wordsToday = service()
      .buildWords(today)
      .map((w) => w.text);
    const wordsTomorrow = service()
      .buildWords(tomorrow)
      .map((w) => w.text);
    expect(wordsToday).not.toEqual(wordsTomorrow);
  });

  it('draws only medium-difficulty words for the fixed daily config', () => {
    const challenge = service().challengeFor('2026-07-09');
    const words = service().buildWords(challenge);
    expect(words.length).toBeGreaterThan(0);
    expect(words.every((w) => w.difficulty === 'medium')).toBe(true);
  });

  it('rejects a future date and accepts today/past dates', () => {
    const today = service().todayUtc();
    expect(service().isAllowed(today)).toBe(true);
    expect(service().isAllowed('2999-01-01')).toBe(false);
  });
});
