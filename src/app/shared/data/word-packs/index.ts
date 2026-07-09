import { WordPack } from '../../../core/models/word-pack';
import { EVERYDAY_PACK } from './everyday';
import { MOVIES_TV_PACK } from './movies-tv';
import { SCIENCE_PACK } from './science';
import { TECH_PROGRAMMING_PACK } from './tech-programming';

/** Themed alternative word sources for Timed/Endless mode - bundled, no
 *  runtime fetch, opt-in via Home's "Word Pack" picker (PLAN-typester-growth.md
 *  Phase 8). Quick Play keeps its fixed legacy composition untouched. */
export const WORD_PACKS: readonly WordPack[] = [
  MOVIES_TV_PACK,
  TECH_PROGRAMMING_PACK,
  SCIENCE_PACK,
  EVERYDAY_PACK,
];

export function findWordPack(id: string | undefined): WordPack | null {
  return WORD_PACKS.find((pack) => pack.id === id) ?? null;
}
