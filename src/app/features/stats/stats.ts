import { DecimalPipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ModeId } from '../../core/engine';
import { MODES } from '../../core/modes';
import { Store, liveStreak } from '../../core/store';
import { utcDate, weakKeys } from '../../core/words';
import { KeyMap } from '../../ui/key-map';
import { PageHeader } from '../../ui/page-header';

const BEST_MODES: readonly ModeId[] = ['rush', 'sprint', 'drill'];

@Component({
  selector: 'app-stats',
  imports: [DecimalPipe, RouterLink, KeyMap, PageHeader],
  templateUrl: './stats.html',
  styleUrl: './stats.css',
})
export class Stats {
  private readonly store = inject(Store);
  private readonly today = utcDate(new Date());

  protected readonly data = this.store.data;
  protected readonly streak = computed(() => liveStreak(this.data().streak, this.today));
  protected readonly minutes = computed(() => Math.round(this.data().totals.ms / 60_000));
  protected readonly weak = computed(() => weakKeys(this.data().keys, 5));
  protected readonly hasKeys = computed(() => Object.keys(this.data().keys).length > 0);

  protected readonly bests = computed(() =>
    BEST_MODES.map((id) => ({ mode: MODES[id], best: this.data().best[id] ?? null })),
  );

  /** Recent WPM, oldest first, as bar heights relative to the fastest. */
  protected readonly recent = computed(() => {
    const runs = [...this.data().recent].reverse();
    const top = Math.max(1, ...runs.map((r) => r.wpm));
    return runs.map((r) => ({ ...r, height: Math.max(4, (r.wpm / top) * 100) }));
  });

  protected readonly recentLabel = computed(() => {
    const runs = this.data().recent;
    if (runs.length === 0) return '';
    const avg = Math.round(runs.reduce((a, r) => a + r.wpm, 0) / runs.length);
    const top = Math.max(...runs.map((r) => r.wpm));
    return `Last ${runs.length} runs: average ${avg} WPM, fastest ${top} WPM.`;
  });
}
