import { isPlatformBrowser } from '@angular/common';
import { Component, PLATFORM_ID, computed, effect, inject, input, signal } from '@angular/core';

@Component({
  selector: 'app-stat-badge',
  template: `
    <div class="app-stat-badge" [class.app-stat-badge--energy]="variant() === 'energy'">
      <span class="app-stat-badge__label">{{ label() }}</span>
      <span class="app-stat-badge__value" [class.app-stat-badge__value--pop]="popping()">
        {{ formattedValue() }}
      </span>
    </div>
  `,
  styleUrl: './stat-badge.css',
})
export class StatBadge {
  readonly label = input.required<string>();
  readonly value = input.required<number | string>();
  readonly suffix = input('');
  /** 'energy' marks momentum-driven stats (combo) with the warm accent
   *  reserved for in-round momentum, distinct from the default neutral badge. */
  readonly variant = input<'default' | 'energy'>('default');
  /** Counts up from 0 on first render instead of appearing instantly - used
   *  on Results, where a satisfying reveal matters more than an instant read. */
  readonly countUp = input(false);

  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly popping = signal(false);
  private readonly displayNumber = signal<number | null>(null);

  protected readonly formattedValue = computed(() => {
    const raw = this.value();
    const shown =
      this.countUp() && typeof raw === 'number' && this.displayNumber() !== null
        ? this.displayNumber()
        : raw;
    return `${shown}${this.suffix()}`;
  });

  constructor() {
    let isFirstRun = true;
    effect((onCleanup) => {
      const raw = this.value();

      if (isFirstRun) {
        isFirstRun = false;
        if (this.countUp() && typeof raw === 'number' && this.isBrowser) {
          this.runCountUp(raw, onCleanup);
        }
        return;
      }

      this.popping.set(true);
      const id = setTimeout(() => this.popping.set(false), 260);
      onCleanup(() => clearTimeout(id));
    });
  }

  private runCountUp(target: number, onCleanup: (fn: () => void) => void): void {
    // Reuses --duration-slow (the token this app already dedicates to
    // "results reveal") so reduced-motion users get an instant final value
    // via the same mechanism that already zeroes every other duration.
    const durationMs =
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--duration-slow')) ||
      0;

    if (durationMs <= 0) {
      this.displayNumber.set(target);
      return;
    }

    this.displayNumber.set(0);
    const startTime = performance.now();
    let frameId: number;
    const step = (now: number) => {
      const t = Math.min(1, (now - startTime) / durationMs);
      this.displayNumber.set(Math.round(target * t));
      if (t < 1) {
        frameId = requestAnimationFrame(step);
      }
    };
    frameId = requestAnimationFrame(step);
    onCleanup(() => cancelAnimationFrame(frameId));
  }
}
