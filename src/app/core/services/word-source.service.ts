import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, firstValueFrom, of, timeout } from 'rxjs';

import { DIFFICULTY_LENGTH_RANGE, Difficulty } from '../models/difficulty';
import { WORD_BANK } from '../../shared/data/word-bank';

const DATAMUSE_ENDPOINT = 'https://api.datamuse.com/words';
/** Unsubscribing on timeout cancels HttpClient's in-flight request. */
const FETCH_TIMEOUT_MS = 2_500;
const RESULTS_PER_LENGTH = 60;
/** Below this many candidates, prefer the curated fallback over a thin live result. */
const MIN_ACCEPTABLE_RESULTS = 20;

interface DatamuseEntry {
  readonly word: string;
}

function isDatamuseResponse(value: unknown): value is DatamuseEntry[] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as Record<string, unknown>)['word'] === 'string',
    )
  );
}

/** Datamuse's `sp` (spelled like) pattern: `?` matches exactly one character. */
function exactLengthPattern(length: number): string {
  return '?'.repeat(length);
}

/**
 * Supplies fresh words for a round from the free, keyless Datamuse API,
 * constrained to each difficulty's length band, falling back to the bundled
 * word-bank.ts curated list on any failure - timeout, network error, or a
 * malformed/too-thin response (see ARCHITECTURE.md §D5).
 */
@Injectable({ providedIn: 'root' })
export class WordSourceService {
  private readonly http = inject(HttpClient);

  async getWords(difficulty: Difficulty): Promise<readonly string[]> {
    try {
      const words = await this.fetchFromApi(difficulty);
      if (words.length >= MIN_ACCEPTABLE_RESULTS) {
        return words;
      }
    } catch {
      // Network error, timeout, or malformed response - fall through below.
    }
    return WORD_BANK[difficulty];
  }

  private async fetchFromApi(difficulty: Difficulty): Promise<string[]> {
    const [minLength, maxLength] = DIFFICULTY_LENGTH_RANGE[difficulty];
    const lengths: number[] = [];
    for (let length = minLength; length <= maxLength; length++) {
      lengths.push(length);
    }

    const responses = await Promise.all(lengths.map((length) => this.fetchByLength(length)));

    const seen = new Set<string>();
    const words: string[] = [];
    for (const entries of responses) {
      for (const entry of entries) {
        const word = entry.word.toLowerCase();
        if (/^[a-z]+$/.test(word) && word.length >= minLength && word.length <= maxLength) {
          if (!seen.has(word)) {
            seen.add(word);
            words.push(word);
          }
        }
      }
    }
    return words;
  }

  private fetchByLength(length: number): Promise<DatamuseEntry[]> {
    const url = `${DATAMUSE_ENDPOINT}?sp=${exactLengthPattern(length)}&max=${RESULTS_PER_LENGTH}`;
    return firstValueFrom(
      this.http.get<unknown>(url).pipe(
        timeout(FETCH_TIMEOUT_MS),
        catchError(() => of([] as unknown)),
      ),
    ).then((response) => (isDatamuseResponse(response) ? response : []));
  }
}
