import {
  DAILY_CHALLENGE_EPOCH,
  addUtcDays,
  buildDailyChallenge,
  dailyChallengeNumber,
  dailySeed,
  isDailyDateAllowed,
  isValidDailyDateFormat,
  seededRng,
  utcDateString,
} from './daily-challenge';

describe('utcDateString', () => {
  it('formats a Date as UTC YYYY-MM-DD', () => {
    expect(utcDateString(new Date('2026-07-09T23:59:00.000Z'))).toBe('2026-07-09');
  });
});

describe('isValidDailyDateFormat', () => {
  it('accepts a well-formed, calendar-valid date', () => {
    expect(isValidDailyDateFormat('2026-07-09')).toBe(true);
  });

  it('rejects malformed strings and calendar-invalid dates', () => {
    expect(isValidDailyDateFormat('2026-7-9')).toBe(false);
    expect(isValidDailyDateFormat('not-a-date')).toBe(false);
    expect(isValidDailyDateFormat('2026-13-01')).toBe(false);
    expect(isValidDailyDateFormat('2026-02-30')).toBe(false);
  });
});

describe('isDailyDateAllowed', () => {
  it('allows today and any past date', () => {
    expect(isDailyDateAllowed('2026-07-09', '2026-07-09')).toBe(true);
    expect(isDailyDateAllowed('2026-07-01', '2026-07-09')).toBe(true);
  });

  it('rejects a future date', () => {
    expect(isDailyDateAllowed('2026-07-10', '2026-07-09')).toBe(false);
  });

  it('rejects a malformed date regardless of the today comparison', () => {
    expect(isDailyDateAllowed('bogus', '2026-07-09')).toBe(false);
  });
});

describe('dailySeed', () => {
  it('is deterministic for the same date', () => {
    expect(dailySeed('2026-07-09')).toBe(dailySeed('2026-07-09'));
  });

  it('differs for a different date', () => {
    expect(dailySeed('2026-07-09')).not.toBe(dailySeed('2026-07-10'));
  });
});

describe('seededRng', () => {
  it('produces the same sequence for the same seed', () => {
    const a = seededRng(42);
    const b = seededRng(42);
    const sequenceA = Array.from({ length: 5 }, () => a());
    const sequenceB = Array.from({ length: 5 }, () => b());
    expect(sequenceA).toEqual(sequenceB);
  });

  it('produces a different sequence for a different seed', () => {
    const a = seededRng(1);
    const b = seededRng(2);
    expect(a()).not.toBe(b());
  });

  it('always returns a value in [0, 1)', () => {
    const rng = seededRng(7);
    for (let i = 0; i < 50; i++) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe('addUtcDays', () => {
  it('adds and subtracts whole days across a month boundary', () => {
    expect(addUtcDays('2026-07-31', 1)).toBe('2026-08-01');
    expect(addUtcDays('2026-08-01', -1)).toBe('2026-07-31');
  });
});

describe('dailyChallengeNumber', () => {
  it('is 1 on the epoch date and increments by one per day after', () => {
    expect(dailyChallengeNumber(DAILY_CHALLENGE_EPOCH)).toBe(1);
    expect(dailyChallengeNumber(addUtcDays(DAILY_CHALLENGE_EPOCH, 1))).toBe(2);
    expect(dailyChallengeNumber(addUtcDays(DAILY_CHALLENGE_EPOCH, 9))).toBe(10);
  });
});

describe('buildDailyChallenge', () => {
  it('returns byte-identical challenges for two independent calls with the same date', () => {
    const a = buildDailyChallenge('2026-07-09');
    const b = buildDailyChallenge('2026-07-09');
    expect(a).toEqual(b);
  });

  it("returns a different seed for tomorrow's date", () => {
    const today = buildDailyChallenge('2026-07-09');
    const tomorrow = buildDailyChallenge(addUtcDays('2026-07-09', 1));
    expect(today.seed).not.toBe(tomorrow.seed);
  });

  it('always uses the fixed timed/medium/60s config', () => {
    const challenge = buildDailyChallenge('2026-07-09');
    expect(challenge.config).toEqual({ mode: 'timed', difficulty: 'medium', durationSeconds: 60 });
  });
});
