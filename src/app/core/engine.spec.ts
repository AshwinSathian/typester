import {
  BANK_CAP_MS,
  MISS_PENALTY_MS,
  RULES,
  Run,
  Word,
  bonusMsFor,
  ghostWordsAt,
  levelFor,
  multiplierFor,
  wpm,
} from './engine';
import { dailyNumber, drillSupply, lengthBand, levelledSupply, seededRng, weakKeys } from './words';
import { WORDS } from '../shared/data/words';

const list =
  (...texts: string[]) =>
  (i: number): Word => ({ text: texts[i % texts.length], gold: false });

function typeWord(run: Run, text: string, now: number): void {
  for (const c of text) run.press(c, now);
}

describe('Run', () => {
  it('waits for the first key before the clock starts', () => {
    const run = new Run(RULES.sprint, list('cat'));
    expect(run.view(5_000).status).toBe('ready');
    expect(run.view(5_000).remainingMs).toBe(60_000);
    run.press('c', 10_000);
    expect(run.view(12_000).elapsedMs).toBe(2_000);
  });

  it('completes a word on its last letter, no space or Enter needed', () => {
    const run = new Run(RULES.sprint, list('cat', 'dog'));
    typeWord(run, 'ca', 0);
    expect(run.view(0).typed).toBe(2);
    const press = run.press('t', 0);
    expect(press.kind).toBe('word');
    expect(run.view(0).queue[0].text).toBe('dog');
    expect(run.view(0).typed).toBe(0);
  });

  it('ignores spaces and multi-character input', () => {
    const run = new Run(RULES.sprint, list('cat'));
    expect(run.press(' ', 0).kind).toBe('ignored');
    expect(run.press('ca', 0).kind).toBe('ignored');
    expect(run.view(0).status).toBe('ready');
  });

  it('keeps a missed letter out of the word and resets the combo', () => {
    const run = new Run(RULES.sprint, list('cat'));
    typeWord(run, 'ca', 0);
    const press = run.press('x', 0);
    expect(press).toEqual({ kind: 'miss', expected: 't', multiplierLost: false });
    expect(run.view(0).typed).toBe(2);
    expect(run.view(0).combo).toBe(0);
  });

  it('is case-insensitive', () => {
    const run = new Run(RULES.sprint, list('cat'));
    expect(run.press('C', 0).kind).toBe('hit');
  });

  it('scores letters x10 x multiplier, doubled for gold', () => {
    const run = new Run(RULES.sprint, (i) => ({ text: 'abcd', gold: i === 1 }));
    typeWord(run, 'abcd', 0);
    expect(run.view(0).score).toBe(40);
    typeWord(run, 'abcd', 0);
    expect(run.view(0).score).toBe(40 + 80);
  });

  it('applies the multiplier earned by the keystroke that finishes the word', () => {
    // 20 clean keystrokes reach x2; the 20th finishes word five.
    const run = new Run(RULES.sprint, list('abcd'));
    for (let i = 0; i < 4; i++) typeWord(run, 'abcd', 0);
    expect(run.view(0).score).toBe(160);
    typeWord(run, 'abcd', 0);
    expect(run.view(0).score).toBe(160 + 80);
    expect(run.view(0).multiplier).toBe(2);
  });

  it('ends a fixed run when its time is up', () => {
    const run = new Run(RULES.sprint, list('cat'));
    run.press('c', 0);
    expect(run.tick(59_999)).toBe(false);
    expect(run.tick(60_000)).toBe(true);
    expect(run.press('a', 60_001).kind).toBe('ignored');
    expect(run.summary().durationMs).toBe(60_000);
  });

  it('banks time for each finished word in a bank run', () => {
    const run = new Run(RULES.rush, list('cats'));
    typeWord(run, 'cats', 0);
    expect(run.view(0).remainingMs).toBe(15_000 + bonusMsFor({ text: 'cats', gold: false }, 1));
  });

  it('caps the bank', () => {
    const run = new Run({ clock: 'bank', seconds: 29 }, list('elephants'));
    typeWord(run, 'elephants', 0);
    expect(run.view(0).remainingMs).toBe(BANK_CAP_MS);
  });

  it('costs time for a miss in a bank run', () => {
    const run = new Run(RULES.rush, list('cat'));
    run.press('c', 0);
    run.press('z', 0);
    expect(run.view(0).remainingMs).toBe(15_000 - MISS_PENALTY_MS);
  });

  it('stops the clock while paused', () => {
    const run = new Run(RULES.sprint, list('cat'));
    run.press('c', 0);
    run.pause(1_000);
    expect(run.tick(100_000)).toBe(false);
    run.resume(100_000);
    expect(run.view(101_000).elapsedMs).toBe(2_000);
  });

  it('resumes on the next keystroke', () => {
    const run = new Run(RULES.sprint, list('cat'));
    run.press('c', 0);
    run.pause(1_000);
    expect(run.press('a', 5_000).kind).toBe('hit');
    expect(run.view(5_000).elapsedMs).toBe(1_000);
  });

  it('summarises accuracy, per-key tallies and word times', () => {
    const run = new Run(RULES.sprint, list('cat', 'dog'));
    typeWord(run, 'cat', 1_000);
    run.press('x', 2_000);
    typeWord(run, 'dog', 3_000);
    run.end(3_000);
    const s = run.summary();
    expect(s.words).toBe(2);
    expect(s.accuracy).toBe(85.7);
    expect(s.wordTimes).toEqual([0, 2_000]);
    expect(s.misses).toEqual({ d: 1 });
    expect(s.hits['t']).toBe(1);
  });
});

describe('scoring helpers', () => {
  it('steps the multiplier at the combo thresholds', () => {
    expect([0, 19, 20, 49, 50, 100, 180, 999].map(multiplierFor)).toEqual([1, 1, 2, 2, 3, 4, 5, 5]);
  });

  it('levels up every six words', () => {
    expect([0, 5, 6, 12].map(levelFor)).toEqual([1, 1, 2, 3]);
  });

  it('shrinks the time bonus each level', () => {
    const word = { text: 'abcdef', gold: false };
    expect(bonusMsFor(word, 2)).toBeLessThan(bonusMsFor(word, 1));
    expect(bonusMsFor({ ...word, gold: true }, 1)).toBeGreaterThan(bonusMsFor(word, 1));
  });

  it('computes WPM with five characters a word plus a space per word', () => {
    expect(wpm(20, 5, 60_000)).toBe(5);
    expect(wpm(20, 5, 500)).toBe(0);
  });

  it('counts how far a ghost had got', () => {
    expect(ghostWordsAt([500, 1_200, 3_000], 1_200)).toBe(2);
    expect(ghostWordsAt([], 9_000)).toBe(0);
  });
});

describe('word supply', () => {
  it('gives every Daily player the same words', () => {
    const a = levelledSupply(WORDS, seededRng(42));
    const b = levelledSupply(WORDS, seededRng(42));
    const first = Array.from({ length: 60 }, (_, i) => a(i));
    expect(Array.from({ length: 60 }, (_, i) => b(i))).toEqual(first);
  });

  it('starts short and gets longer', () => {
    const supply = levelledSupply(WORDS, seededRng(1));
    for (let i = 0; i < 6; i++) expect(supply(i).text.length).toBeLessThanOrEqual(5);
    const late = Array.from({ length: 12 }, (_, i) => supply(48 + i).text.length);
    expect(Math.min(...late)).toBeGreaterThanOrEqual(lengthBand(48)[0]);
  });

  it('never makes the first word gold', () => {
    for (let seed = 0; seed < 50; seed++) {
      expect(levelledSupply(WORDS, seededRng(seed))(0).gold).toBe(false);
    }
  });

  it('survives a pool with nothing in the band', () => {
    const supply = levelledSupply(['ox'], seededRng(1));
    expect(supply(0).text).toBe('ox');
  });

  it('biases drill words towards weak letters', () => {
    const supply = drillSupply(WORDS, ['q', 'z', 'x'], seededRng(3));
    const words = Array.from({ length: 30 }, (_, i) => supply(i).text);
    const hits = words.filter((w) => /[qzx]/.test(w)).length;
    expect(hits).toBeGreaterThan(20);
  });

  it('names weak keys only once there is evidence', () => {
    expect(weakKeys({ a: [100, 1], q: [3, 4], e: [200, 9] })).toEqual(['q', 'e']);
  });

  it('numbers the Daily from its first day', () => {
    expect(dailyNumber('2026-07-09')).toBe(1);
    expect(dailyNumber('2026-11-21')).toBe(136);
  });
});
