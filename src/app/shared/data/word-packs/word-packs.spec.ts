import { DIFFICULTIES, DIFFICULTY_LENGTH_RANGE } from '../../../core/models/difficulty';
import { findWordPack, WORD_PACKS } from './index';

const MIN_WORDS_PER_TIER = 15;

describe('WORD_PACKS', () => {
  it('ships at least 4 packs, per PLAN-typester-growth.md Phase 8', () => {
    expect(WORD_PACKS.length).toBeGreaterThanOrEqual(4);
  });

  it('has unique ids and labels across packs', () => {
    const ids = WORD_PACKS.map((p) => p.id);
    const labels = WORD_PACKS.map((p) => p.label);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(labels).size).toBe(labels.length);
  });

  for (const pack of WORD_PACKS) {
    describe(`${pack.label} pack`, () => {
      it(`has at least ${MIN_WORDS_PER_TIER} words per difficulty tier`, () => {
        for (const difficulty of DIFFICULTIES) {
          expect(pack.words[difficulty].length).toBeGreaterThanOrEqual(MIN_WORDS_PER_TIER);
        }
      });

      it('contains only unique, lowercase alphabetic words within each tier', () => {
        for (const difficulty of DIFFICULTIES) {
          const words = pack.words[difficulty];
          expect(new Set(words).size).toBe(words.length);
          for (const word of words) {
            expect(word).toMatch(/^[a-z]+$/);
          }
        }
      });

      it("has no word duplicated across this pack's own difficulty tiers", () => {
        const all = DIFFICULTIES.flatMap((difficulty) => pack.words[difficulty]);
        expect(new Set(all).size).toBe(all.length);
      });

      it('keeps every word within its tier length band', () => {
        for (const difficulty of DIFFICULTIES) {
          const [min, max] = DIFFICULTY_LENGTH_RANGE[difficulty];
          for (const word of pack.words[difficulty]) {
            expect(word.length).toBeGreaterThanOrEqual(min);
            expect(word.length).toBeLessThanOrEqual(max);
          }
        }
      });
    });
  }
});

describe('findWordPack', () => {
  it('finds a pack by id', () => {
    expect(findWordPack('science')?.label).toBe('Science');
  });

  it('returns null for an unknown or undefined id', () => {
    expect(findWordPack('bogus')).toBeNull();
    expect(findWordPack(undefined)).toBeNull();
  });
});
