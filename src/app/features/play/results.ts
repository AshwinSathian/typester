import { DecimalPipe } from '@angular/common';
import {
  Component,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { ModeId, Summary } from '../../core/engine';
import { Share } from '../../core/share';
import { Recorded, Store, liveStreak } from '../../core/store';
import { KeyTally, utcDate } from '../../core/words';
import { KeyMap } from '../../ui/key-map';
import { RaceChart } from '../../ui/race-chart';

@Component({
  selector: 'app-results',
  imports: [DecimalPipe, RouterLink, KeyMap, RaceChart],
  templateUrl: './results.html',
  styleUrl: './results.css',
})
export class Results {
  readonly mode = input.required<ModeId>();
  readonly title = input.required<string>();
  readonly run = input.required<Summary>();
  readonly recorded = input<Recorded | null>(null);
  readonly ghost = input<readonly number[] | null>(null);
  readonly target = input<number | null>(null);
  readonly again = output();

  private readonly store = inject(Store);
  private readonly sharer = inject(Share);
  private readonly heading = viewChild<ElementRef<HTMLElement>>('heading');

  protected readonly shareStatus = signal('');
  protected readonly sharing = signal(false);

  protected readonly verdict = computed(() => {
    const run = this.run();
    const rec = this.recorded();
    if (run.words === 0) return 'No words this time. The clock starts on your first key.';
    if (!rec) return '';
    const prev = rec.previousBest?.score;
    if (rec.isBest && prev) return `New best, up ${(run.score - prev).toLocaleString('en')}.`;
    if (rec.isBest)
      return this.mode() === 'daily' ? 'Your score for today.' : 'Now there’s a score to beat.';
    return `Best ${prev?.toLocaleString('en')}. ${((prev ?? 0) - run.score).toLocaleString('en')} short.`;
  });

  protected readonly targetLine = computed(() => {
    const t = this.target();
    if (!t) return '';
    const score = this.run().score;
    const sent = `the ${t.toLocaleString('en')} you were sent`;
    return score > t
      ? `You beat ${sent}.`
      : `${(t - score).toLocaleString('en')} short of ${sent}.`;
  });

  protected readonly tally = computed<KeyTally>(() => {
    const { hits, misses } = this.run();
    const tally: Record<string, readonly [number, number]> = {};
    for (const k of new Set([...Object.keys(hits), ...Object.keys(misses)])) {
      tally[k] = [hits[k] ?? 0, misses[k] ?? 0];
    }
    return tally;
  });

  protected readonly missCount = computed(() =>
    Object.values(this.run().misses).reduce((a, b) => a + b, 0),
  );

  protected readonly streak = computed(() =>
    liveStreak(this.store.data().streak, utcDate(new Date())),
  );

  constructor() {
    // Move focus to the result so screen readers hear it and Enter works.
    afterNextRender(() => this.heading()?.nativeElement.focus());
  }

  protected async share(): Promise<void> {
    this.sharing.set(true);
    this.shareStatus.set('');
    const outcome = await this.sharer.share({
      mode: this.mode(),
      title: `Typester ${this.title()}`,
      run: this.run(),
    });
    this.sharing.set(false);
    this.shareStatus.set(
      {
        shared: '',
        cancelled: '',
        copied: 'Link copied. Paste it to whoever you want to beat.',
        failed: 'Couldn’t share from this browser.',
      }[outcome],
    );
  }
}
