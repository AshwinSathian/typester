import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';

import { ModeId, RULES, Run, Summary, View, WordSupply, ghostWordsAt } from '../../core/engine';
import { MODES } from '../../core/modes';
import { Sound } from '../../core/sound';
import { Recorded, Store } from '../../core/store';
import {
  dailyNumber,
  drillSupply,
  hashString,
  levelledSupply,
  seededRng,
  utcDate,
  weakKeys,
} from '../../core/words';
import { WORDS } from '../../shared/data/words';
import { Burst } from '../../ui/burst';
import { KeycapWord } from '../../ui/keycap-word';
import { Results } from './results';

/** Letters drilled before there's enough history to know your weak keys. */
const DEFAULT_DRILL_KEYS = ['q', 'z', 'x', 'j', 'k', 'v'];

interface Popup {
  readonly id: number;
  readonly text: string;
  readonly gold: boolean;
}

@Component({
  selector: 'app-play',
  imports: [KeycapWord, Results, Burst, DecimalPipe],
  templateUrl: './play.html',
  styleUrl: './play.css',
  host: {
    '[style.--heat]': 'heat()',
    '(document:keydown)': 'onDocumentKey($event)',
    '(document:visibilitychange)': 'onVisibility()',
  },
})
export class Play {
  /** Route param, already checked by the mode guard. */
  readonly mode = input.required<ModeId>();
  /** `?vs=` from a challenge link: a score to beat. */
  readonly vs = input<string>();

  private readonly store = inject(Store);
  private readonly sound = inject(Sound);
  private readonly router = inject(Router);
  private readonly field = viewChild<ElementRef<HTMLInputElement>>('field');
  private readonly wordEl = viewChild<ElementRef<HTMLElement>>('word');
  private readonly burst = viewChild(Burst);

  private run!: Run;
  private today = '';
  private raf = 0;
  private popupId = 0;
  private overAt = 0;

  protected readonly view = signal<View | null>(null);
  protected readonly summary = signal<Summary | null>(null);
  protected readonly recorded = signal<Recorded | null>(null);
  protected readonly ghost = signal<readonly number[] | null>(null);
  protected readonly misses = signal<number | null>(null);
  protected readonly popups = signal<readonly Popup[]>([]);
  protected readonly focused = signal(true);
  protected readonly announcement = signal('');

  protected readonly spec = computed(() => MODES[this.mode()]);
  protected readonly title = computed(() =>
    this.mode() === 'daily' ? `Daily #${dailyNumber(this.today)}` : this.spec().name,
  );
  protected readonly target = computed(() => {
    const n = Number(this.vs());
    return Number.isInteger(n) && n > 0 ? n : null;
  });

  protected readonly seconds = computed(() => {
    const v = this.view();
    if (!v) return '';
    const s = v.remainingMs / 1000;
    return RULES[this.mode()].clock === 'bank' ? s.toFixed(1) : String(Math.ceil(s));
  });

  /** Clock bar fill, 0-1. A bank fills against its 30s cap. */
  protected readonly clockFill = computed(() => {
    const v = this.view();
    if (!v) return 1;
    const rules = RULES[this.mode()];
    const full = rules.clock === 'bank' ? 30_000 : rules.seconds * 1000;
    return Math.min(1, v.remainingMs / full);
  });

  protected readonly lowTime = computed(() => {
    const v = this.view();
    return !!v && v.status === 'running' && v.remainingMs < 5_000;
  });

  /** Progress through the current multiplier step, 0-1. */
  protected readonly comboFill = computed(() => {
    const v = this.view();
    if (!v) return 0;
    const steps = [0, 20, 50, 100, 180];
    const from = steps[v.multiplier - 1];
    const to = steps[v.multiplier];
    return to === undefined ? 1 : (v.combo - from) / (to - from);
  });

  /** Words ahead (+) or behind (-) your best at this moment. */
  protected readonly ghostDelta = computed(() => {
    const v = this.view();
    const ghost = this.ghost();
    if (!v || !ghost || v.status === 'ready') return null;
    return v.wordsDone - ghostWordsAt(ghost, v.elapsedMs);
  });

  protected readonly heat = computed(() => ((this.view()?.multiplier ?? 1) - 1) / 4);

  constructor() {
    effect(() => {
      this.mode();
      untracked(() => this.start());
    });
    afterNextRender(() => this.focus());
    inject(DestroyRef).onDestroy(() => cancelAnimationFrame(this.raf));
  }

  protected start(): void {
    cancelAnimationFrame(this.raf);
    this.today = utcDate(new Date());
    const mode = this.mode();
    const data = this.store.data();
    this.ghost.set(
      (mode === 'daily' ? data.daily[this.today] : data.best[mode])?.wordTimes ?? null,
    );
    this.run = new Run(RULES[mode], this.supplyFor(mode));
    this.summary.set(null);
    this.recorded.set(null);
    this.misses.set(null);
    this.popups.set([]);
    this.sync();
    this.announcement.set(`${this.title()}. Start typing: ${this.view()?.queue[0].text}`);
    this.focus();
  }

  private supplyFor(mode: ModeId): WordSupply {
    switch (mode) {
      case 'daily':
        return levelledSupply(WORDS, seededRng(hashString(this.today)));
      case 'drill': {
        const weak = weakKeys(this.store.data().keys, 6);
        return drillSupply(WORDS, weak.length >= 3 ? weak : DEFAULT_DRILL_KEYS, Math.random);
      }
      default:
        return levelledSupply(WORDS, Math.random);
    }
  }

  protected onInput(event: Event): void {
    const el = event.target as HTMLInputElement;
    const text = el.value;
    el.value = '';
    for (const char of text) this.press(char);
  }

  private press(char: string): void {
    if (this.summary()) return;
    const before = this.view()?.status;
    const result = this.run.press(char, performance.now());
    const v = this.run.view(performance.now());

    switch (result.kind) {
      case 'ignored':
        break;
      case 'hit':
        this.misses.set(null);
        this.sound.hit(v.wordsDone * 2 + v.typed, v.multiplier);
        if (result.multiplierUp) this.multiplierUp(v.multiplier);
        break;
      case 'miss':
        this.misses.update((m) => (m ?? 0) + 1);
        this.sound.miss();
        if (result.multiplierLost) this.announcement.set('Combo lost.');
        this.vibrate(18);
        break;
      case 'word': {
        this.misses.set(null);
        this.sound.word(v.multiplier, result.word.gold);
        this.addPopup(result.points, result.bonusMs, result.word.gold);
        const el = this.wordEl()?.nativeElement;
        const burst = this.burst();
        if (el && burst) {
          const colors = result.word.gold
            ? [burst.token('--gold'), burst.token('--gold-side'), burst.token('--key')]
            : [burst.token('--accent-fill'), burst.token('--key'), burst.token('--gold')];
          burst.fire(el, result.word.gold ? 36 : 10 + v.multiplier * 4, colors);
        }
        if (result.multiplierUp) this.multiplierUp(v.multiplier);
        if (result.levelUp) {
          this.sound.levelUp();
          this.announcement.set(`Level ${v.level}. Next word: ${v.queue[0].text}`);
        } else {
          this.announcement.set(v.queue[0].text);
        }
        break;
      }
    }
    this.sync();
    // First key of the run, or first key after a pause: (re)start the clock.
    if (before !== 'running' && v.status === 'running') this.loop();
  }

  private multiplierUp(multiplier: number): void {
    this.sound.multiplierUp(multiplier);
    this.announcement.set(`Multiplier ${multiplier}.`);
  }

  private addPopup(points: number, bonusMs: number, gold: boolean): void {
    const id = ++this.popupId;
    const time = bonusMs >= 100 ? `  +${(bonusMs / 1000).toFixed(1)}s` : '';
    this.popups.update((list) => [...list.slice(-2), { id, text: `+${points}${time}`, gold }]);
    setTimeout(() => this.popups.update((list) => list.filter((p) => p.id !== id)), 700);
  }

  private loop(): void {
    const frame = () => {
      if (this.run.tick(performance.now())) {
        this.finish();
        return;
      }
      this.sync();
      if (this.view()?.status === 'running') this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  private sync(): void {
    this.view.set(this.run.view(performance.now()));
  }

  private finish(): void {
    cancelAnimationFrame(this.raf);
    this.sync();
    const summary = this.run.summary();
    this.recorded.set(this.store.record(this.mode(), summary, this.today));
    this.summary.set(summary);
    this.overAt = performance.now();
    this.sound.over();
    this.vibrate(60);
  }

  /** Esc ends the run; the score so far still counts. */
  protected end(): void {
    const status = this.view()?.status;
    if (status === 'ready') {
      void this.router.navigate(['/']);
      return;
    }
    if (status === 'running' || status === 'paused') {
      this.run.end(performance.now());
      this.finish();
    }
  }

  protected onDocumentKey(event: KeyboardEvent): void {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (this.summary()) {
      // A beat of grace, so the keystroke still in flight when time ran
      // out doesn't skip past the results.
      if (performance.now() - this.overAt < 600) return;
      if (event.key === 'Enter' && !(event.target instanceof HTMLButtonElement)) {
        event.preventDefault();
        this.start();
      } else if (event.key === 'Escape') {
        void this.router.navigate(['/']);
      }
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      this.end();
      return;
    }
    // Typing anywhere on the page goes to the game.
    const field = this.field()?.nativeElement;
    if (field && event.target !== field && event.key.length === 1) {
      event.preventDefault();
      this.focus();
      this.press(event.key);
    }
  }

  protected onVisibility(): void {
    if (document.hidden && this.view()?.status === 'running') {
      this.run.pause(performance.now());
      cancelAnimationFrame(this.raf);
      this.sync();
    }
  }

  protected focus(): void {
    this.field()?.nativeElement.focus({ preventScroll: true });
  }

  protected onFocusChange(focused: boolean): void {
    this.focused.set(focused);
  }

  private vibrate(ms: number): void {
    navigator.vibrate?.(ms);
  }
}
