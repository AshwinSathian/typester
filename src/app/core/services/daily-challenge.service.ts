import { Injectable } from '@angular/core';

import { DailyChallenge } from '../models/daily-challenge';
import { WordEntry } from '../models/word';
import { WORD_BANK } from '../../shared/data/word-bank';
import {
  DAILY_CHALLENGE_CONFIG,
  buildDailyChallenge,
  isDailyDateAllowed,
  seededRng,
  utcDateString,
} from './daily-challenge';
import { WordPools, buildRoundWords } from './game-engine';

/**
 * Thin Angular wrapper around the pure helpers in daily-challenge.ts - the
 * seeding/date logic itself has zero Angular imports (PLAN D4).
 */
@Injectable({ providedIn: 'root' })
export class DailyChallengeService {
  todayUtc(): string {
    return utcDateString(new Date());
  }

  isAllowed(date: string): boolean {
    return isDailyDateAllowed(date, this.todayUtc());
  }

  challengeFor(date: string): DailyChallenge {
    return buildDailyChallenge(date);
  }

  /**
   * Always draws from the bundled WORD_BANK, never WordSourceService's live
   * Datamuse fetch - true player-to-player comparability requires every
   * player to draw from the same fixed candidate pool, not just apply the
   * same shuffle to two different pools.
   */
  buildWords(challenge: DailyChallenge): readonly WordEntry[] {
    const difficulty = challenge.config.difficulty as keyof WordPools;
    const pools: WordPools = {
      easy: [],
      medium: [],
      hard: [],
      [difficulty]: WORD_BANK[difficulty],
    };
    return buildRoundWords(
      { ...DAILY_CHALLENGE_CONFIG, ...challenge.config },
      pools,
      seededRng(challenge.seed),
    );
  }
}
