import {
  DestroyRef,
  Component,
  ElementRef,
  OnInit,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';

import { Difficulty } from '../../core/models/difficulty';
import { GameConfig, GameMode, RouteDifficulty } from '../../core/models/game-config';
import { GameResult } from '../../core/models/game-result';
import {
  GameSession,
  SessionSnapshot,
  WordPools,
  buildRoundWords,
} from '../../core/services/game-engine';
import { SoundService } from '../../core/services/sound.service';
import { StorageService } from '../../core/services/storage.service';
import { WordSourceService } from '../../core/services/word-source.service';
import { Button } from '../../shared/ui/button/button';
import { Dialog } from '../../shared/ui/dialog/dialog';
import { StatBadge } from '../../shared/ui/stat-badge/stat-badge';
import { TimerRing } from '../../shared/ui/timer-ring/timer-ring';

type Phase = 'loading' | 'playing' | 'finished';
type Feedback = 'none' | 'correct' | 'near' | 'incorrect';

const TICK_INTERVAL_MS = 100;
/** Correct feedback stays instant (DESIGN-typester.md §Sound); incorrect
 *  holds a beat longer (matches --duration-slow) so the per-character
 *  mistake diff is actually readable, not just flashed. */
const CORRECT_FEEDBACK_MS = 150;
const INCORRECT_FEEDBACK_MS = 420;

@Component({
  selector: 'app-game',
  imports: [TimerRing, StatBadge, Button, Dialog],
  templateUrl: './game.html',
  styleUrl: './game.css',
})
export class Game implements OnInit {
  readonly mode = input.required<string>();
  readonly difficulty = input.required<string>();
  readonly duration = input.required<string>();

  private readonly router = inject(Router);
  private readonly wordSource = inject(WordSourceService);
  private readonly storage = inject(StorageService);
  private readonly sound = inject(SoundService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly phase = signal<Phase>('loading');
  protected readonly snapshot = signal<SessionSnapshot | null>(null);
  protected readonly remainingSeconds = signal(0);
  protected readonly elapsedMs = signal(0);
  protected readonly feedback = signal<Feedback>('none');
  protected readonly typedValue = signal('');
  protected readonly showExitConfirm = signal(false);

  /** Per-character diff of the last incorrect (or near-miss) submission
   *  against the target word - a precision-instrument detail
   *  (DESIGN-typester.md §Game) showing exactly which keystrokes were
   *  wrong, not just that the word was wrong. */
  protected readonly mistypedChars = computed<readonly boolean[]>(() => {
    if (this.feedback() !== 'incorrect' && this.feedback() !== 'near') return [];
    const target = this.snapshot()?.currentWord?.text ?? '';
    const typed = this.typedValue();
    const length = Math.max(target.length, typed.length);
    return Array.from(
      { length },
      (_, i) => (typed[i] ?? '').toLowerCase() !== (target[i] ?? '').toLowerCase(),
    );
  });

  /** Live-updating WPM, refreshed on the same 100ms tick that already
   *  drives the countdown (TICK_INTERVAL_MS) - no second interval. Mirrors
   *  GameSession.result()'s formula exactly, using the same elapsed-ms
   *  snapshot captured at the instant a round-ending submit/expiry happens,
   *  so the live value converges on the Results-screen value at round end. */
  protected readonly liveWpm = computed(() => {
    const snap = this.snapshot();
    const elapsedMinutes = this.elapsedMs() / 60_000;
    if (!snap || elapsedMinutes <= 0) return 0;
    return Math.round(snap.correctChars / 5 / elapsedMinutes);
  });

  protected readonly config = computed<GameConfig>(() => ({
    mode: this.mode() as GameMode,
    difficulty: this.difficulty() as RouteDifficulty,
    durationSeconds: Number(this.duration()),
  }));

  protected readonly liveAnnouncement = computed(() => {
    const snap = this.snapshot();
    if (!snap) return '';
    const outcome =
      this.feedback() === 'correct'
        ? 'Correct. '
        : this.feedback() === 'incorrect'
          ? 'Incorrect. '
          : '';
    return `${outcome}Score ${snap.score}, streak ${snap.streak}`;
  });

  private readonly answerInputRef = viewChild<ElementRef<HTMLInputElement>>('answerInput');

  private session: GameSession | null = null;
  private startedAtMs = 0;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private feedbackTimeoutId: ReturnType<typeof setTimeout> | null = null;
  /** Set while the exit-confirm dialog is open - the round is genuinely
   *  paused (see pauseTimer/resumeTimerIfPaused), not just visually frozen,
   *  so deciding whether to leave never silently costs the player time. */
  private pausedAtMs: number | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => {
      if (this.intervalId !== null) clearInterval(this.intervalId);
      if (this.feedbackTimeoutId !== null) clearTimeout(this.feedbackTimeoutId);
    });

    // Zero-click round start: focus the answer field the moment it renders,
    // without the `autofocus` attribute (flagged by @angular-eslint/template/
    // no-autofocus - unexpected-on-load focus shifts hurt AT users; a
    // deliberate, single programmatic focus() once gameplay begins doesn't).
    effect(() => {
      if (this.phase() === 'playing' && !this.showExitConfirm()) {
        this.answerInputRef()?.nativeElement.focus();
      }
    });

    effect(() => {
      if (this.showExitConfirm()) {
        this.pauseTimer();
      } else {
        this.resumeTimerIfPaused();
      }
    });
  }

  ngOnInit(): void {
    void this.beginRound();
  }

  protected onInput(inputEl: HTMLInputElement): void {
    this.typedValue.set(inputEl.value);
  }

  /** Escape opens the same exit-confirm dialog as the corner button - a
   *  common, discoverable convention for "leave this full-screen mode". */
  protected onEscape(): void {
    if (this.phase() === 'playing' && !this.showExitConfirm()) {
      this.openExitConfirm();
    }
  }

  protected openExitConfirm(): void {
    if (this.phase() !== 'playing') return;
    this.showExitConfirm.set(true);
  }

  protected resumeGame(): void {
    this.showExitConfirm.set(false);
  }

  /** Ends the round right now with whatever was scored so far - reuses
   *  GameSession.expireTime, the exact same "time ran out mid-word" path a
   *  natural timeout takes, so an early exit scores identically (time bonus
   *  only if the word list was actually exhausted, which it wasn't). */
  protected exitAndSave(): void {
    this.showExitConfirm.set(false);
    if (!this.session) return;
    this.snapshot.set(this.session.expireTime(Date.now()));
    this.endRound();
  }

  protected exitWithoutSaving(): void {
    this.showExitConfirm.set(false);
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    void this.router.navigate(['/']);
  }

  private pauseTimer(): void {
    if (this.pausedAtMs !== null) return;
    this.pausedAtMs = Date.now();
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private resumeTimerIfPaused(): void {
    if (this.pausedAtMs === null) return;
    this.startedAtMs += Date.now() - this.pausedAtMs;
    this.pausedAtMs = null;
    if (this.phase() === 'playing' && this.intervalId === null) {
      this.intervalId = setInterval(() => this.tick(), TICK_INTERVAL_MS);
    }
  }

  protected onSubmit(inputEl: HTMLInputElement): void {
    if (this.phase() !== 'playing' || !this.session) return;
    const value = inputEl.value;
    if (!value.trim()) return;

    const nowMs = Date.now();
    const outcome = this.session.submit(value, nowMs);
    this.snapshot.set(outcome.snapshot);
    this.elapsedMs.set(nowMs - this.startedAtMs);
    this.showFeedback(outcome.correct ? 'correct' : outcome.nearMiss ? 'near' : 'incorrect');

    // The input clears on every submission, correct or not - an incorrect
    // guess used to leave stray characters behind, forcing a manual clear
    // before retrying (PLAN-typester-growth.md Executive Diagnosis #8). The
    // per-character diff still reads correctly afterwards because it's
    // driven by the `typedValue` signal, which only updates on the next
    // keystroke via onInput(), not by this DOM clear.
    inputEl.value = '';
    if (outcome.correct) {
      this.typedValue.set('');
      const streak = outcome.snapshot.streak;
      this.sound.play(streak > 0 && streak % 5 === 0 ? 'combo' : 'correct');
    } else {
      this.sound.play(outcome.nearMiss ? 'nearMiss' : 'incorrect');
    }

    if (outcome.finished) {
      this.endRound();
    } else {
      inputEl.focus();
    }
  }

  private async beginRound(): Promise<void> {
    const config = this.config();
    const pools = await this.loadPools(config);
    const words = buildRoundWords(config, pools);

    this.session = new GameSession(config, words);
    this.startedAtMs = Date.now();
    this.snapshot.set(this.session.start(this.startedAtMs));
    this.remainingSeconds.set(config.durationSeconds);
    this.elapsedMs.set(0);
    this.phase.set('playing');

    this.intervalId = setInterval(() => this.tick(), TICK_INTERVAL_MS);
  }

  private async loadPools(config: GameConfig): Promise<WordPools> {
    const empty: readonly string[] = [];

    if (config.mode === 'quick') {
      const [easy, medium, hard] = await Promise.all([
        this.wordSource.getWords('easy'),
        this.wordSource.getWords('medium'),
        this.wordSource.getWords('hard'),
      ]);
      return { easy, medium, hard };
    }

    const difficulty = config.difficulty as Difficulty;
    const words = await this.wordSource.getWords(difficulty);
    return {
      easy: difficulty === 'easy' ? words : empty,
      medium: difficulty === 'medium' ? words : empty,
      hard: difficulty === 'hard' ? words : empty,
    };
  }

  private tick(): void {
    if (!this.session) return;
    const nowMs = Date.now();
    this.elapsedMs.set(nowMs - this.startedAtMs);
    const elapsedSeconds = (nowMs - this.startedAtMs) / 1000;
    const remaining = Math.max(0, this.config().durationSeconds - elapsedSeconds);
    this.remainingSeconds.set(remaining);

    if (remaining <= 0) {
      this.snapshot.set(this.session.expireTime(nowMs));
      this.sound.play('timeUp');
      this.endRound();
    }
  }

  private endRound(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.phase.set('finished');

    const result = this.session!.result();
    const outcome = this.storage.recordResult(result);
    const finalResult: GameResult = {
      ...result,
      achievementsUnlocked: outcome.achievementsUnlocked,
    };

    void this.router.navigate(['/results'], {
      state: { result: finalResult, isNewBest: outcome.isNewBest },
    });
  }

  private showFeedback(kind: Feedback): void {
    this.feedback.set(kind);
    if (this.feedbackTimeoutId !== null) clearTimeout(this.feedbackTimeoutId);
    const duration = kind === 'correct' ? CORRECT_FEEDBACK_MS : INCORRECT_FEEDBACK_MS;
    this.feedbackTimeoutId = setTimeout(() => this.feedback.set('none'), duration);
  }
}
