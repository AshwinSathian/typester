import { DOCUMENT } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { ACHIEVEMENTS, AchievementDef } from '../../core/models/achievement';
import { ChallengeLinkPayload } from '../../core/models/challenge-link';
import { DailyChallenge } from '../../core/models/daily-challenge';
import { ComboDescriptor, nextUnbeatenCombo } from '../../core/models/game-config';
import { GameResult } from '../../core/models/game-result';
import { encodeChallengeLinkParams } from '../../core/services/challenge-link';
import { ShareCardService } from '../../core/services/share-card.service';
import { ShareService } from '../../core/services/share.service';
import { StorageService } from '../../core/services/storage.service';
import { Button } from '../../shared/ui/button/button';
import { StatBadge } from '../../shared/ui/stat-badge/stat-badge';
import { Toast } from '../../shared/ui/toast/toast';

interface ResultsNavigationState {
  readonly result?: GameResult;
  readonly isNewBest?: boolean;
  readonly closestMiss?: string | null;
  readonly dailyChallenge?: DailyChallenge | null;
  readonly freezeConsumed?: boolean;
}

interface ConfettiPiece {
  readonly id: number;
  readonly leftPercent: number;
  readonly delayMs: number;
  readonly durationMs: number;
  readonly rotateDeg: number;
  readonly energy: boolean;
}

const CONFETTI_PIECE_COUNT = 16;

function buildConfetti(): ConfettiPiece[] {
  return Array.from({ length: CONFETTI_PIECE_COUNT }, (_, i) => ({
    id: i,
    leftPercent: Math.round(Math.random() * 100),
    delayMs: Math.round(Math.random() * 150),
    durationMs: Math.round(700 + Math.random() * 400),
    rotateDeg: Math.round(Math.random() * 360),
    energy: i % 2 === 0,
  }));
}

@Component({
  selector: 'app-results',
  imports: [Button, StatBadge, Toast],
  templateUrl: './results.html',
  styleUrl: './results.css',
})
export class Results {
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly share = inject(ShareService);
  private readonly shareCard = inject(ShareCardService);
  private readonly storage = inject(StorageService);

  private readonly navState = (this.document.defaultView?.history.state ??
    {}) as ResultsNavigationState;

  protected readonly result = signal<GameResult | null>(this.navState.result ?? null);
  protected readonly isNewBest = signal(this.navState.isNewBest ?? false);
  protected readonly closestMiss = signal(this.navState.closestMiss ?? null);
  protected readonly dailyChallenge = signal(this.navState.dailyChallenge ?? null);
  protected readonly freezeConsumed = signal(this.navState.freezeConsumed ?? false);
  protected readonly toastMessage = signal<string | null>(null);

  /** Generated once at construction, not reactively - a decorative one-shot
   *  burst for a genuine "New Best" moment, not a recurring effect. */
  protected readonly confettiPieces: readonly ConfettiPiece[] = this.isNewBest()
    ? buildConfetti()
    : [];

  protected readonly accuracyPercent = computed(() => {
    const result = this.result();
    return result ? Math.round(result.accuracy * 100) : 0;
  });

  protected readonly unlockedAchievements = computed<readonly AchievementDef[]>(() => {
    const result = this.result();
    if (!result) return [];
    const unlocked = new Set(result.achievementsUnlocked);
    return ACHIEVEMENTS.filter((achievement) => unlocked.has(achievement.id));
  });

  /** The next not-yet-beaten combo to suggest, only once this round already
   *  landed a best score - a cold suggestion after a mediocre round would
   *  read as a non-sequitur (DESIGN §Results screen rework). */
  protected readonly suggestedCombo = computed<ComboDescriptor | null>(() => {
    const result = this.result();
    if (!result || !this.isNewBest()) return null;
    return nextUnbeatenCombo(this.storage.stats(), result.config);
  });

  constructor() {
    if (!this.result()) {
      void this.router.navigate(['/']);
    }
  }

  playAgain(): void {
    // A daily-challenge result's config is just DAILY_CHALLENGE_CONFIG (no
    // date) - routing from it directly would silently start a regular
    // Timed/Medium/60s round instead of replaying the actual daily
    // challenge, breaking both "same config, restarts immediately" and the
    // dailyResults/bestScores bucket split (ARCHITECTURE.md §Data flow).
    const daily = this.dailyChallenge();
    if (daily) {
      void this.router.navigate(['/play', 'daily', daily.date]);
      return;
    }

    const config = this.result()?.config;
    if (!config) return;
    void this.router.navigate(['/play', config.mode, config.difficulty, config.durationSeconds]);
  }

  playSuggestedCombo(): void {
    const combo = this.suggestedCombo();
    if (!combo) return;
    const { config } = combo;
    void this.router.navigate(['/play', config.mode, config.difficulty, config.durationSeconds]);
  }

  goToMenu(): void {
    void this.router.navigate(['/']);
  }

  async shareResult(): Promise<void> {
    const result = this.result();
    if (!result) return;

    const origin = this.document.defaultView?.location.origin ?? '';
    const daily = this.dailyChallenge();
    const shareUrl = daily
      ? `${origin}/play/daily/${daily.date}`
      : this.buildChallengeLinkUrl(origin, result);
    const label = daily ? `Typester Daily #${daily.dayNumber}` : 'Typester';
    const text = `Scored ${result.totalScore} pts at ${result.wpm} WPM on ${label} — ${shareUrl}`;

    const blob = await this.shareCard.generate({ result, dailyChallenge: daily });
    const nav = this.document.defaultView?.navigator;
    if (blob && nav?.share && nav.canShare) {
      const file = new File([blob], 'typester-result.png', { type: 'image/png' });
      if (nav.canShare({ files: [file] })) {
        try {
          await nav.share({ files: [file], text });
          return;
        } catch {
          // User cancelled, or the platform rejected the file share - fall
          // through to the existing text/clipboard path below.
        }
      }
    }

    const outcome = await this.share.share(text);
    if (outcome === 'copied') {
      this.toastMessage.set('Copied to clipboard');
    } else if (outcome === 'failed') {
      this.toastMessage.set("Couldn't share right now");
    }
  }

  private buildChallengeLinkUrl(origin: string, result: GameResult): string {
    const payload: ChallengeLinkPayload = {
      config: result.config,
      score: result.totalScore,
      wpm: result.wpm,
    };
    const params = new URLSearchParams(
      encodeChallengeLinkParams(payload.config, payload.score, payload.wpm),
    );
    return `${origin}/?${params.toString()}`;
  }

  dismissToast(): void {
    this.toastMessage.set(null);
  }
}
