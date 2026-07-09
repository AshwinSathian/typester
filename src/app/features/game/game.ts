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
import { StatBadge } from '../../shared/ui/stat-badge/stat-badge';
import { TimerRing } from '../../shared/ui/timer-ring/timer-ring';

type Phase = 'loading' | 'playing' | 'finished';
type Feedback = 'none' | 'correct' | 'incorrect';

const TICK_INTERVAL_MS = 100;
const FEEDBACK_DURATION_MS = 150;

@Component({
  selector: 'app-game',
  imports: [TimerRing, StatBadge],
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
  protected readonly feedback = signal<Feedback>('none');

  protected readonly config = computed<GameConfig>(() => ({
    mode: this.mode() as GameMode,
    difficulty: this.difficulty() as RouteDifficulty,
    durationSeconds: Number(this.duration()),
  }));

  protected readonly liveAnnouncement = computed(() => {
    const snap = this.snapshot();
    if (!snap) return '';
    return `Score ${snap.score}, streak ${snap.streak}`;
  });

  private readonly answerInputRef = viewChild<ElementRef<HTMLInputElement>>('answerInput');

  private session: GameSession | null = null;
  private startedAtMs = 0;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private feedbackTimeoutId: ReturnType<typeof setTimeout> | null = null;

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
      if (this.phase() === 'playing') {
        this.answerInputRef()?.nativeElement.focus();
      }
    });
  }

  ngOnInit(): void {
    void this.beginRound();
  }

  protected onSubmit(inputEl: HTMLInputElement): void {
    if (this.phase() !== 'playing' || !this.session) return;
    const value = inputEl.value;
    if (!value.trim()) return;

    const outcome = this.session.submit(value, Date.now());
    this.snapshot.set(outcome.snapshot);
    this.showFeedback(outcome.correct ? 'correct' : 'incorrect');

    if (outcome.correct) {
      inputEl.value = '';
      const streak = outcome.snapshot.streak;
      this.sound.play(streak > 0 && streak % 5 === 0 ? 'combo' : 'correct');
    } else {
      this.sound.play('incorrect');
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
    const elapsedSeconds = (Date.now() - this.startedAtMs) / 1000;
    const remaining = Math.max(0, this.config().durationSeconds - elapsedSeconds);
    this.remainingSeconds.set(remaining);

    if (remaining <= 0) {
      this.snapshot.set(this.session.expireTime(Date.now()));
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
    this.feedbackTimeoutId = setTimeout(() => this.feedback.set('none'), FEEDBACK_DURATION_MS);
  }
}
