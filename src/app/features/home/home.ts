import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { ModeId } from '../../core/engine';
import { MODES, isModeId } from '../../core/modes';
import { Sound } from '../../core/sound';
import { Store, liveStreak } from '../../core/store';
import { dailyNumber, utcDate, weakKeys } from '../../core/words';
import { KeycapWord } from '../../ui/keycap-word';

const HERO = 'typester';
const ORDER: readonly ModeId[] = ['rush', 'sprint', 'daily', 'drill'];

@Component({
  selector: 'app-home',
  imports: [DecimalPipe, RouterLink, KeycapWord],
  templateUrl: './home.html',
  styleUrl: './home.css',
  host: { '(document:keydown)': 'onKey($event)' },
})
export class Home {
  /** Challenge link query params: `?mode=rush&vs=1240`. */
  readonly vs = input<string>();
  readonly mode = input<string>();

  private readonly store = inject(Store);
  private readonly sound = inject(Sound);
  private readonly router = inject(Router);

  protected readonly hero = HERO;
  protected readonly typed = signal(0);
  protected readonly misses = signal<number | null>(null);
  private readonly today = utcDate(new Date());

  protected readonly challenge = computed(() => {
    const score = Number(this.vs());
    const mode = this.mode();
    if (!Number.isInteger(score) || score <= 0 || !isModeId(mode) || mode === 'daily') return null;
    return { mode: MODES[mode], score };
  });

  protected readonly rows = computed(() => {
    const data = this.store.data();
    const weak = weakKeys(data.keys, 4);
    return ORDER.map((id, i) => {
      const best = id === 'daily' ? data.daily[this.today] : data.best[id];
      let note = best ? `Best ${best.score.toLocaleString('en')}` : '';
      if (id === 'daily')
        note = best ? `Today ${best.score.toLocaleString('en')}` : 'Not played today';
      if (id === 'drill' && weak.length < 3) note = 'Learns your weak keys as you play';
      return {
        ...MODES[id],
        shortcut: String(i + 1),
        name: id === 'daily' ? `Daily #${dailyNumber(this.today)}` : MODES[id].name,
        note,
        weak: id === 'drill' && weak.length >= 3 ? weak : [],
      };
    });
  });

  protected readonly streak = computed(() => liveStreak(this.store.data().streak, this.today));
  protected readonly playedToday = computed(() => this.store.data().streak.last === this.today);

  protected onKey(event: KeyboardEvent): void {
    if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
    // Leave keys alone while focus is on a link or button.
    if (event.target instanceof HTMLElement && event.target.closest('a, button, input')) return;

    const index = Number(event.key) - 1;
    if (ORDER[index]) {
      this.go(ORDER[index]);
      return;
    }
    if (event.key.length !== 1 || this.typed() >= HERO.length) return;

    if (event.key.toLowerCase() === HERO[this.typed()]) {
      this.typed.update((n) => n + 1);
      this.misses.set(null);
      this.sound.hit(this.typed(), 1);
      if (this.typed() === HERO.length) {
        this.sound.word(2, false);
        setTimeout(() => this.go(this.challenge()?.mode.id ?? 'rush'), 220);
      }
    } else {
      this.misses.update((m) => (m ?? 0) + 1);
      this.sound.miss();
    }
  }

  protected go(mode: ModeId): void {
    const challenge = this.challenge();
    const queryParams = challenge?.mode.id === mode ? { vs: challenge.score } : {};
    void this.router.navigate(['/play', mode], { queryParams });
  }
}
