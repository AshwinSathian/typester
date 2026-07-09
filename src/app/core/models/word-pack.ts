import { Difficulty } from './difficulty';

export interface WordPack {
  readonly id: string;
  readonly label: string;
  readonly words: Readonly<Record<Difficulty, readonly string[]>>;
}

/** No pack selected - falls back to the live Datamuse fetch + WORD_BANK
 *  fallback behavior. Packs are an additional, opt-in mode-selection axis,
 *  not a replacement default. */
export const DEFAULT_WORD_PACK_ID = 'default';
