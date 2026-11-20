import { Component, computed, input } from '@angular/core';

const W = 600;
const H = 160;

/** Step-line path of words finished over time, scaled to the chart box. */
function path(times: readonly number[], maxT: number, maxN: number): string {
  if (times.length === 0) return '';
  const x = (t: number) => ((t / maxT) * W).toFixed(1);
  const y = (n: number) => (H - (n / maxN) * H).toFixed(1);
  let d = `M0,${H}`;
  times.forEach((t, i) => (d += ` H${x(t)} V${y(i + 1)}`));
  return d;
}

/**
 * This run against your previous best, as words finished over time. Where
 * your line sits above the dashed one, you were ahead.
 */
@Component({
  selector: 'app-race-chart',
  template: `
    <svg
      [attr.viewBox]="'0 0 ' + w + ' ' + h"
      preserveAspectRatio="none"
      role="img"
      [attr.aria-label]="label()"
    >
      @if (ghostPath()) {
        <path class="ghost" [attr.d]="ghostPath()" vector-effect="non-scaling-stroke" />
      }
      <path class="you" [attr.d]="youPath()" vector-effect="non-scaling-stroke" />
    </svg>
    <div class="legend" aria-hidden="true">
      <span class="legend__you">This run</span>
      @if (ghostPath()) {
        <span class="legend__ghost">Previous best</span>
      }
    </div>
  `,
  styles: `
    svg {
      display: block;
      width: 100%;
      height: 9rem;
      overflow: visible;
    }
    path {
      fill: none;
      stroke-width: 3;
      stroke-linejoin: round;
    }
    .you {
      stroke: var(--accent);
    }
    .ghost {
      stroke: var(--ink-soft);
      stroke-dasharray: 5 6;
      stroke-width: 2;
    }
    .legend {
      display: flex;
      gap: var(--space-4);
      margin-top: var(--space-2);
      font-size: var(--text-sm);
      color: var(--ink-soft);
    }
    .legend span::before {
      content: '';
      display: inline-block;
      width: 1.2em;
      height: 3px;
      margin-right: 0.4em;
      vertical-align: middle;
      background: var(--accent);
    }
    .legend .legend__ghost::before {
      background: repeating-linear-gradient(90deg, var(--ink-soft) 0 4px, transparent 4px 7px);
    }
  `,
})
export class RaceChart {
  readonly you = input.required<readonly number[]>();
  readonly ghost = input<readonly number[] | null>(null);
  readonly durationMs = input.required<number>();

  protected readonly w = W;
  protected readonly h = H;

  private readonly scale = computed(() => {
    const ghost = this.ghost() ?? [];
    return {
      t: Math.max(this.durationMs(), ghost.at(-1) ?? 0, 1),
      n: Math.max(this.you().length, ghost.length, 1),
    };
  });

  protected readonly youPath = computed(() => {
    const { t, n } = this.scale();
    return path(this.you(), t, n);
  });

  protected readonly ghostPath = computed(() => {
    const ghost = this.ghost();
    if (!ghost?.length) return '';
    const { t, n } = this.scale();
    return path(ghost, t, n);
  });

  protected readonly label = computed(() => {
    const you = this.you().length;
    const ghost = this.ghost()?.length;
    return ghost
      ? `Words over time: ${you} this run, ${ghost} in your previous best.`
      : `Words over time: ${you} words this run.`;
  });
}
