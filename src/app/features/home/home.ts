import { isPlatformBrowser } from '@angular/common';
import { Component, DestroyRef, PLATFORM_ID, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';

import { ChallengeLinkPayload } from '../../core/models/challenge-link';
import { Difficulty, DIFFICULTIES } from '../../core/models/difficulty';
import { ENDLESS_MISTAKE_OPTIONS, GAME_DURATIONS } from '../../core/models/game-config';
import { BestScoreEntry, streakStatus } from '../../core/models/stats';
import { DEFAULT_WORD_PACK_ID } from '../../core/models/word-pack';
import { decodeChallengeLinkParams } from '../../core/services/challenge-link';
import { dailyChallengeNumber } from '../../core/services/daily-challenge';
import { DailyChallengeService } from '../../core/services/daily-challenge.service';
import { StorageService } from '../../core/services/storage.service';
import { WORD_BANK } from '../../shared/data/word-bank';
import { WORD_PACKS } from '../../shared/data/word-packs';
import { Button } from '../../shared/ui/button/button';
import {
  SegmentedControl,
  SegmentOption,
} from '../../shared/ui/segmented-control/segmented-control';

type PickerMode = 'timed' | 'endless';

/** A fixed, deterministic sample (no randomness - this component is
 *  server-prerendered, so the client hydration must match) of short words
 *  from the bundled word bank, for the auto-typing hero preview. */
const PREVIEW_WORDS = WORD_BANK.easy.filter((word) => word.length <= 4).slice(0, 4);
const PREVIEW_TYPE_MS = 90;
const PREVIEW_HOLD_MS = 500;
const PREVIEW_GAP_MS = 200;

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
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly destroyRef = inject(DestroyRef);
  private previewTimeoutId: ReturnType<typeof setTimeout> | null = null;

  /** Auto-typing hero preview (DESIGN §Home screen additions) - a
   *  first-time visitor sees what the mechanic looks like before clicking
   *  anything. Frozen on the first fully-typed word under reduced motion,
   *  matching the pattern already used for .home__caret / .game__word--power. */
  protected readonly previewText = signal(PREVIEW_WORDS[0] ?? '');

  protected readonly showModePicker = signal(false);
  protected readonly pickerMode = signal<PickerMode>('timed');
  protected readonly pickerDifficulty = signal<Difficulty>('easy');
  protected readonly pickerDuration = signal<string>('60');
  protected readonly pickerLives = signal<string>('5');
  protected readonly pickerPack = signal<string>(DEFAULT_WORD_PACK_ID);

  protected readonly modeOptions: readonly SegmentOption<PickerMode>[] = [
    { value: 'timed', label: 'Timed' },
    { value: 'endless', label: 'Endless' },
  ];
  protected readonly difficultyOptions: readonly SegmentOption<Difficulty>[] = DIFFICULTIES.map(
    (value) => ({ value, label: capitalize(value) }),
  );
  protected readonly durationOptions: readonly SegmentOption<string>[] = GAME_DURATIONS.map(
    (value) => ({ value: String(value), label: `${value}s` }),
  );
  protected readonly livesOptions: readonly SegmentOption<string>[] = ENDLESS_MISTAKE_OPTIONS.map(
    (value) => ({ value: String(value), label: `${value} lives` }),
  );
  protected readonly packOptions: readonly SegmentOption<string>[] = [
    { value: DEFAULT_WORD_PACK_ID, label: 'Default' },
    ...WORD_PACKS.map((pack) => ({ value: pack.id, label: pack.label })),
  ];

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

  constructor() {
    this.destroyRef.onDestroy(() => {
      if (this.previewTimeoutId !== null) clearTimeout(this.previewTimeoutId);
    });

    if (this.isBrowser && PREVIEW_WORDS.length > 0 && !this.prefersReducedMotion()) {
      this.runPreviewLoop(0, 1);
    }
  }

  private prefersReducedMotion(): boolean {
    const motion = this.storage.settings().motion;
    if (motion === 'reduced') return true;
    if (motion === 'full') return false;
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  }

  /** Recursive setTimeout (not setInterval) since typing/hold/gap phases
   *  each need their own duration - types PREVIEW_WORDS[wordIndex] one
   *  character at a time, holds, clears, and moves to the next word,
   *  looping forever. */
  private runPreviewLoop(wordIndex: number, charIndex: number): void {
    const word = PREVIEW_WORDS[wordIndex % PREVIEW_WORDS.length];

    if (charIndex <= word.length) {
      this.previewText.set(word.slice(0, charIndex));
      this.previewTimeoutId = setTimeout(
        () => this.runPreviewLoop(wordIndex, charIndex + 1),
        PREVIEW_TYPE_MS,
      );
      return;
    }

    this.previewTimeoutId = setTimeout(() => {
      this.previewText.set('');
      this.previewTimeoutId = setTimeout(
        () => this.runPreviewLoop(wordIndex + 1, 1),
        PREVIEW_GAP_MS,
      );
    }, PREVIEW_HOLD_MS);
  }

  startQuickPlay(): void {
    const duration = this.storage.settings().quickPlayDurationSeconds;
    this.router.navigate(['/play', 'quick', 'mixed', duration]);
  }

  toggleModePicker(): void {
    this.showModePicker.update((visible) => !visible);
  }

  startTimedGame(): void {
    const mode = this.pickerMode();
    const durationOrLives = mode === 'endless' ? this.pickerLives() : this.pickerDuration();
    const pack = this.pickerPack();
    this.router.navigate(['/play', mode, this.pickerDifficulty(), durationOrLives], {
      queryParams: pack === DEFAULT_WORD_PACK_ID ? {} : { pack },
    });
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
