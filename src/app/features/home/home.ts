import { Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';

import { ChallengeLinkPayload } from '../../core/models/challenge-link';
import { Difficulty, DIFFICULTIES } from '../../core/models/difficulty';
import { GAME_DURATIONS } from '../../core/models/game-config';
import { BestScoreEntry, streakStatus } from '../../core/models/stats';
import { decodeChallengeLinkParams } from '../../core/services/challenge-link';
import { dailyChallengeNumber } from '../../core/services/daily-challenge';
import { DailyChallengeService } from '../../core/services/daily-challenge.service';
import { StorageService } from '../../core/services/storage.service';
import { Button } from '../../shared/ui/button/button';
import {
  SegmentedControl,
  SegmentOption,
} from '../../shared/ui/segmented-control/segmented-control';

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

@Component({
  selector: 'app-home',
  imports: [Button, SegmentedControl],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  // Challenge-link query params (see core/services/challenge-link.ts) - the
  // Home screen's own difficulty/duration picker signals below are named
  // picker* specifically so they don't collide with these.
  readonly mode = input<string>();
  readonly difficulty = input<string>();
  readonly duration = input<string>();
  readonly score = input<string>();
  readonly wpm = input<string>();

  private readonly router = inject(Router);
  private readonly storage = inject(StorageService);
  private readonly dailyChallenge = inject(DailyChallengeService);

  protected readonly showModePicker = signal(false);
  protected readonly pickerDifficulty = signal<Difficulty>('easy');
  protected readonly pickerDuration = signal<string>('60');

  protected readonly difficultyOptions: readonly SegmentOption<Difficulty>[] = DIFFICULTIES.map(
    (value) => ({ value, label: capitalize(value) }),
  );
  protected readonly durationOptions: readonly SegmentOption<string>[] = GAME_DURATIONS.map(
    (value) => ({ value: String(value), label: `${value}s` }),
  );

  /** Surfaces StorageService's per-visit data back to a returning player -
   *  a first-time visitor and a regular see a different Home screen. */
  protected readonly stats = this.storage.stats;
  protected readonly hasPlayed = computed(() => this.stats().roundsPlayed > 0);
  protected readonly bestOverall = computed<BestScoreEntry | null>(() => {
    const scores = Object.values(this.stats().bestScores);
    return scores.length === 0
      ? null
      : scores.reduce((best, entry) => (entry.totalScore > best.totalScore ? entry : best));
  });

  protected readonly todayUtc = this.dailyChallenge.todayUtc();
  protected readonly dailyDayNumber = computed(() => dailyChallengeNumber(this.todayUtc));
  protected readonly streakStatus = computed(() => streakStatus(this.stats(), this.todayUtc));

  /** Present only when Home was opened via a shared challenge link -
   *  overrides the standard hero (DESIGN §Challenge-link landing state).
   *  Never persists past this navigation without the query params. */
  protected readonly challengeLink = computed<ChallengeLinkPayload | null>(() =>
    decodeChallengeLinkParams({
      mode: this.mode(),
      difficulty: this.difficulty(),
      duration: this.duration(),
      score: this.score(),
      wpm: this.wpm(),
    }),
  );

  protected readonly challengeLabel = computed(() => {
    const challenge = this.challengeLink();
    if (!challenge) return '';
    const { config } = challenge;
    const modeLabel =
      config.mode === 'quick'
        ? 'Quick Play'
        : `${capitalize(config.difficulty)}/${config.durationSeconds}s`;
    return `${challenge.score} pts (${challenge.wpm} WPM) on ${modeLabel}`;
  });

  startQuickPlay(): void {
    const duration = this.storage.settings().quickPlayDurationSeconds;
    this.router.navigate(['/play', 'quick', 'mixed', duration]);
  }

  toggleModePicker(): void {
    this.showModePicker.update((visible) => !visible);
  }

  startTimedGame(): void {
    this.router.navigate(['/play', 'timed', this.pickerDifficulty(), this.pickerDuration()]);
  }

  startDailyChallenge(): void {
    this.router.navigate(['/play', 'daily', this.todayUtc]);
  }

  acceptChallenge(): void {
    const challenge = this.challengeLink();
    if (!challenge) return;
    const { config } = challenge;
    this.router.navigate(['/play', config.mode, config.difficulty, config.durationSeconds]);
  }

  dismissChallenge(): void {
    void this.router.navigate(['/']);
  }

  goToStats(): void {
    this.router.navigate(['/stats']);
  }

  goToHelp(): void {
    this.router.navigate(['/help']);
  }

  goToSettings(): void {
    this.router.navigate(['/settings']);
  }
}
