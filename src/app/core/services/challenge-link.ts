/**
 * Pure TypeScript challenge-link encode/decode - zero Angular imports. A
 * non-daily GameConfig + the score/WPM that beat it, packed into plain
 * query params so a fresh session landing on Home can render a distinct
 * "beat it?" state.
 */
import { ChallengeLinkPayload } from '../models/challenge-link';
import { GameConfig, GameMode, RouteDifficulty, isValidGameConfig } from '../models/game-config';

export interface ChallengeLinkParams {
  readonly mode?: string;
  readonly difficulty?: string;
  readonly duration?: string;
  readonly score?: string;
  readonly wpm?: string;
}

export function encodeChallengeLinkParams(
  config: GameConfig,
  score: number,
  wpm: number,
): Record<string, string> {
  return {
    mode: config.mode,
    difficulty: config.difficulty,
    duration: String(config.durationSeconds),
    score: String(Math.max(0, Math.round(score))),
    wpm: String(Math.max(0, Math.round(wpm))),
  };
}

/** Returns null on any missing/malformed/out-of-range field rather than a
 *  best-effort partial parse - an invalid challenge link should fall back to
 *  Home's normal state entirely, not a half-broken one. */
export function decodeChallengeLinkParams(
  params: ChallengeLinkParams,
): ChallengeLinkPayload | null {
  const { mode, difficulty, duration, score, wpm } = params;
  if (!mode || !difficulty || !duration || !score || !wpm) return null;
  if (!isValidGameConfig(mode, difficulty, duration)) return null;

  const scoreNum = Number(score);
  const wpmNum = Number(wpm);
  if (!Number.isFinite(scoreNum) || scoreNum < 0) return null;
  if (!Number.isFinite(wpmNum) || wpmNum < 0) return null;

  const config: GameConfig = {
    mode: mode as GameMode,
    difficulty: difficulty as RouteDifficulty,
    durationSeconds: Number(duration),
  };

  return { config, score: scoreNum, wpm: wpmNum };
}
