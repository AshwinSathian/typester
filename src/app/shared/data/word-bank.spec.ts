import { DIFFICULTIES, DIFFICULTY_LENGTH_RANGE } from '../../core/models/difficulty';
import { WORD_BANK } from './word-bank';

describe('WORD_BANK', () => {
  it('has at least 150 words per difficulty tier', () => {
    for (const difficulty of DIFFICULTIES) {
      expect(WORD_BANK[difficulty].length).toBeGreaterThanOrEqual(150);
    }
  });

  it('contains only unique, lowercase alphabetic words within each tier', () => {
    for (const difficulty of DIFFICULTIES) {
      const words = WORD_BANK[difficulty];
      expect(new Set(words).size).toBe(words.length);
      for (const word of words) {
        expect(word).toMatch(/^[a-z]+$/);
      }
    }
  });

  it('has no word duplicated across difficulty tiers', () => {
    const all = DIFFICULTIES.flatMap((difficulty) => WORD_BANK[difficulty]);
    expect(new Set(all).size).toBe(all.length);
  });

  it('keeps every word within its tier length band', () => {
    for (const difficulty of DIFFICULTIES) {
      const [min, max] = DIFFICULTY_LENGTH_RANGE[difficulty];
      for (const word of WORD_BANK[difficulty]) {
        expect(word.length).toBeGreaterThanOrEqual(min);
        expect(word.length).toBeLessThanOrEqual(max);
      }
    }
  });
});
