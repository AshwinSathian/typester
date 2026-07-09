import { Component, computed, input } from '@angular/core';

const RADIUS = 42;
const CENTER = 50;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * SVG circular countdown driven entirely by a computed() signal - no
 * setInterval DOM writes (fixes the legacy app's timer.component.ts, which
 * manipulated the DOM directly; see PLAN-typester.md D4).
 */
@Component({
  selector: 'app-timer-ring',
  template: `
    <div class="app-timer-ring-wrap">
      <svg
        viewBox="0 0 100 100"
        class="app-timer-ring"
        [class.app-timer-ring--warning]="severity() === 'warning'"
        [class.app-timer-ring--danger]="severity() === 'danger'"
        role="img"
        [attr.aria-label]="ariaLabel()"
      >
        <circle
          class="app-timer-ring__track"
          [attr.cx]="center"
          [attr.cy]="center"
          [attr.r]="radius"
        />
        <circle
          class="app-timer-ring__progress"
          [attr.cx]="center"
          [attr.cy]="center"
          [attr.r]="radius"
          [attr.stroke-dasharray]="circumference"
          [attr.stroke-dashoffset]="strokeDashoffset()"
        />
      </svg>
      <span
        class="app-timer-ring__value"
        [class.app-timer-ring__value--warning]="severity() === 'warning'"
        [class.app-timer-ring__value--danger]="severity() === 'danger'"
        aria-hidden="true"
      >
        {{ displaySeconds() }}
      </span>
    </div>
  `,
  styleUrl: './timer-ring.css',
})
export class TimerRing {
  readonly remainingSeconds = input.required<number>();
  readonly totalSeconds = input.required<number>();

  protected readonly radius = RADIUS;
  protected readonly center = CENTER;
  protected readonly circumference = CIRCUMFERENCE;

  protected readonly progress = computed(() => {
    const total = this.totalSeconds();
    if (total <= 0) return 0;
    return Math.max(0, Math.min(1, this.remainingSeconds() / total));
  });

  protected readonly strokeDashoffset = computed(() => CIRCUMFERENCE * (1 - this.progress()));

  protected readonly severity = computed<'accent' | 'warning' | 'danger'>(() => {
    const p = this.progress();
    if (p <= 0.1) return 'danger';
    if (p <= 0.2) return 'warning';
    return 'accent';
  });

  protected readonly displaySeconds = computed(() =>
    Math.max(0, Math.ceil(this.remainingSeconds())),
  );

  protected readonly ariaLabel = computed(() => `${this.displaySeconds()} seconds remaining`);
}
