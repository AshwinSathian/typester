import { GameConfig } from './game-config';

/** Decoded payload of a challenge-link URL - self-reported and unverifiable
 *  (no backend), a deliberate, accepted limitation - never presented in
 *  copy as "verified" or a "leaderboard" (PLAN-typester-growth.md Phase 6). */
export interface ChallengeLinkPayload {
  readonly config: GameConfig;
  readonly score: number;
  readonly wpm: number;
}
