import { DOCUMENT } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { ACHIEVEMENTS, AchievementDef } from '../../core/models/achievement';
import { GameResult } from '../../core/models/game-result';
import { ShareService } from '../../core/services/share.service';
import { Button } from '../../shared/ui/button/button';
import { StatBadge } from '../../shared/ui/stat-badge/stat-badge';
import { Toast } from '../../shared/ui/toast/toast';

interface ResultsNavigationState {
  readonly result?: GameResult;
  readonly isNewBest?: boolean;
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

  private readonly navState = (this.document.defaultView?.history.state ??
    {}) as ResultsNavigationState;

  protected readonly result = signal<GameResult | null>(this.navState.result ?? null);
  protected readonly isNewBest = signal(this.navState.isNewBest ?? false);
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

  constructor() {
    if (!this.result()) {
      void this.router.navigate(['/']);
    }
  }

  playAgain(): void {
    const config = this.result()?.config;
    if (!config) return;
    void this.router.navigate(['/play', config.mode, config.difficulty, config.durationSeconds]);
  }

  goToMenu(): void {
    void this.router.navigate(['/']);
  }

  async shareResult(): Promise<void> {
    const result = this.result();
    if (!result) return;

    const origin = this.document.defaultView?.location.origin ?? '';
    const text = `Scored ${result.totalScore} pts at ${result.wpm} WPM on Typester (${result.config.mode}/${result.config.difficulty}) — ${origin}`;
    const outcome = await this.share.share(text);

    if (outcome === 'copied') {
      this.toastMessage.set('Copied to clipboard');
    } else if (outcome === 'failed') {
      this.toastMessage.set("Couldn't share right now");
    }
  }

  dismissToast(): void {
    this.toastMessage.set(null);
  }
}
