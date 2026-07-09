import { DEFAULT_STATS } from '../models/stats';
import { GameConfig } from '../models/game-config';
import { WordEntry } from '../models/word';
import {
  GameSession,
  WordPools,
  buildRoundWords,
  evaluateAchievements,
  multiplierForStreak,
} from './game-engine';

const pools: WordPools = {
  easy: ['cat', 'dog', 'sun', 'run', 'top', 'hat', 'red', 'box'],
  medium: ['garden', 'planet', 'silver', 'window', 'castle', 'bridge'],
  hard: ['adventure', 'chocolate', 'important', 'community', 'wonderful'],
};

function sequentialRng(): () => number {
  // Deterministic, non-repeating sequence in [0, 1) so tests are reproducible.
  let n = 0;
  return () => {
    n = (n + 0.137) % 1;
    return n;
  };
}

function entry(text: string, difficulty: WordEntry['difficulty'] = 'easy'): WordEntry {
  return { text, difficulty, isPowerWord: false };
}

describe('multiplierForStreak', () => {
  it('is x1 below a 5-streak, x1.5 from 5-9, x2 at 10+', () => {
    expect(multiplierForStreak(0)).toBe(1);
    expect(multiplierForStreak(4)).toBe(1);
    expect(multiplierForStreak(5)).toBe(1.5);
    expect(multiplierForStreak(9)).toBe(1.5);
    expect(multiplierForStreak(10)).toBe(2);
    expect(multiplierForStreak(25)).toBe(2);
  });
});

describe('buildRoundWords', () => {
  it('builds a 4/4/2 easy/medium/hard composition for quick mode', () => {
    const config: GameConfig = { mode: 'quick', difficulty: 'mixed', durationSeconds: 90 };
    const words = buildRoundWords(config, pools, sequentialRng());

    expect(words).toHaveLength(10);
    expect(words.filter((w) => w.difficulty === 'easy')).toHaveLength(4);
    expect(words.filter((w) => w.difficulty === 'medium')).toHaveLength(4);
    expect(words.filter((w) => w.difficulty === 'hard')).toHaveLength(2);
  });

  it('draws the whole pool without replacement for timed mode', () => {
    const config: GameConfig = { mode: 'timed', difficulty: 'medium', durationSeconds: 60 };
    const words = buildRoundWords(config, pools, sequentialRng());

    expect(words).toHaveLength(pools.medium.length);
    expect(new Set(words.map((w) => w.text)).size).toBe(pools.medium.length);
    expect(words.every((w) => w.difficulty === 'medium')).toBe(true);
  });

  it('never marks the first word of a round as a power word', () => {
    const config: GameConfig = { mode: 'timed', difficulty: 'hard', durationSeconds: 30 };
    const words = buildRoundWords(config, pools, () => 0); // rng() always 0 -> would be a power word if allowed
    expect(words[0].isPowerWord).toBe(false);
  });
});

describe('GameSession', () => {
  const config: GameConfig = { mode: 'timed', difficulty: 'easy', durationSeconds: 30 };

  it('starts idle and rejects submit/result before start()', () => {
    const session = new GameSession(config, [entry('cat')]);
    expect(session.snapshot().state).toBe('idle');
    expect(() => session.submit('cat', 1000)).toThrow();
    expect(() => session.result()).toThrow();
  });

  it('rejects starting a session twice', () => {
    const session = new GameSession(config, [entry('cat')]);
    session.start(0);
    expect(() => session.start(100)).toThrow();
  });

  it('is case-insensitive and trims whitespace on submit', () => {
    const session = new GameSession(config, [entry('cat'), entry('dog')]);
    session.start(0);
    const outcome = session.submit('  CAT  ', 100);
    expect(outcome.correct).toBe(true);
  });

  it('advances only on a correct submission and resets streak on a mistake', () => {
    const session = new GameSession(config, [entry('cat'), entry('dog'), entry('sun')]);
    session.start(0);

    session.submit('cat', 100);
    let snap = session.submit('cat', 200).snapshot; // wrong word for this position now ("dog")
    expect(snap.streak).toBe(0);
    expect(snap.wordIndex).toBe(1); // did not advance past "dog"

    snap = session.submit('dog', 300).snapshot;
    expect(snap.wordIndex).toBe(2);
    expect(snap.streak).toBe(1);
  });

  it('finishes and reports totals once every word is exhausted', () => {
    const session = new GameSession(config, [entry('cat'), entry('dog')]);
    session.start(0);
    session.submit('cat', 1_000);
    const outcome = session.submit('dog', 31_000); // 30s elapsed total
    expect(outcome.finished).toBe(true);
    expect(session.snapshot().state).toBe('finished');

    const result = session.result();
    expect(result.wordsCorrect).toBe(2);
    expect(result.wordsIncorrect).toBe(0);
    expect(result.accuracy).toBe(1);
  });

  it('applies streak multiplier and power-word doubling to score', () => {
    const words: WordEntry[] = [
      entry('cat'), // easy = 1pt, streak 1 -> x1 -> 1
      entry('dog'), // easy = 1pt, streak 2 -> x1 -> 1
      { text: 'sun', difficulty: 'easy', isPowerWord: true }, // 1pt * x1 * 2 = 2
    ];
    const session = new GameSession(config, words);
    session.start(0);
    session.submit('cat', 100);
    session.submit('dog', 200);
    const outcome = session.submit('sun', 300);

    expect(outcome.snapshot.score).toBe(1 + 1 + 2);
  });

  it('awards a time bonus only when the word list is exhausted before time runs out', () => {
    const exhaustedSession = new GameSession(config, [entry('cat')]);
    exhaustedSession.start(0);
    exhaustedSession.submit('cat', 10_000); // 10s of 30s used, 20s left over
    const exhaustedResult = exhaustedSession.result();
    expect(exhaustedResult.timeBonus).toBe(20);
    expect(exhaustedResult.totalScore).toBe(exhaustedResult.baseScore + 20);

    const timedOutSession = new GameSession(config, [entry('cat'), entry('dog')]);
    timedOutSession.start(0);
    timedOutSession.submit('cat', 10_000);
    timedOutSession.expireTime(30_000);
    expect(timedOutSession.result().timeBonus).toBe(0);
  });

  it('computes WPM from correct characters per minute elapsed', () => {
    // "cat" + "dog" = 6 correct chars, over exactly 6 seconds = 0.1 minutes -> 6/5/0.1 = 12 wpm
    const session = new GameSession(config, [entry('cat'), entry('dog')]);
    session.start(0);
    session.submit('cat', 3_000);
    session.submit('dog', 6_000);
    expect(session.result().wpm).toBe(12);
  });
});

describe('evaluateAchievements', () => {
  const baseResult = {
    config: { mode: 'timed', difficulty: 'easy', durationSeconds: 30 } as GameConfig,
    wordsCorrect: 5,
    wordsIncorrect: 0,
    baseScore: 10,
    timeBonus: 0,
    totalScore: 10,
    wpm: 30,
    accuracy: 1,
    bestStreak: 5,
    achievementsUnlocked: [],
    finishedAt: new Date(0).toISOString(),
  };

  it("unlocks first-round only on a player's first-ever round", () => {
    expect(evaluateAchievements(baseResult, DEFAULT_STATS)).toContain('first-round');
    const seasoned = { ...DEFAULT_STATS, roundsPlayed: 5 };
    expect(evaluateAchievements(baseResult, seasoned)).not.toContain('first-round');
  });

  it('unlocks wpm-50 at 50+ wpm and not below', () => {
    expect(evaluateAchievements({ ...baseResult, wpm: 50 }, DEFAULT_STATS)).toContain('wpm-50');
    expect(evaluateAchievements({ ...baseResult, wpm: 49 }, DEFAULT_STATS)).not.toContain('wpm-50');
  });

  it('unlocks perfect-accuracy only at 100% accuracy with at least one correct word', () => {
    expect(evaluateAchievements(baseResult, DEFAULT_STATS)).toContain('perfect-accuracy');
    expect(evaluateAchievements({ ...baseResult, accuracy: 0.99 }, DEFAULT_STATS)).not.toContain(
      'perfect-accuracy',
    );
  });

  it('unlocks streak-10 at a 10+ best streak', () => {
    expect(evaluateAchievements({ ...baseResult, bestStreak: 10 }, DEFAULT_STATS)).toContain(
      'streak-10',
    );
    expect(evaluateAchievements({ ...baseResult, bestStreak: 9 }, DEFAULT_STATS)).not.toContain(
      'streak-10',
    );
  });

  it('unlocks all-difficulties once every difficulty has a best score', () => {
    const almost = { ...DEFAULT_STATS, difficultiesBeaten: ['medium', 'hard'] as const };
    expect(
      evaluateAchievements(
        { ...baseResult, config: { ...baseResult.config, difficulty: 'easy' } },
        almost,
      ),
    ).toContain('all-difficulties');
  });

  it('never re-unlocks an achievement already present in priorStats', () => {
    const already = { ...DEFAULT_STATS, achievementsUnlocked: ['first-round', 'wpm-50'] as const };
    const unlocked = evaluateAchievements({ ...baseResult, wpm: 60 }, already);
    expect(unlocked).not.toContain('first-round');
    expect(unlocked).not.toContain('wpm-50');
  });
});
