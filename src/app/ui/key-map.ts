import { Component, computed, input } from '@angular/core';

import { KeyTally, missRate } from '../core/words';

const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

/**
 * A keyboard tinted by where you miss. Tint strength is each key's miss
 * rate relative to your worst key, so the map always shows a spread. The
 * same facts are listed in text for screen readers.
 */
@Component({
  selector: 'app-key-map',
  template: `
    <div class="map" aria-hidden="true">
      @for (row of rows; track row; let r = $index) {
        <div class="map__row" [style.--indent]="r">
          @for (k of row; track k) {
            <span class="map__key" [style.--heat]="heat()[k] ?? 0">{{ k }}</span>
          }
        </div>
      }
    </div>
    <p class="sr-only">{{ summary() }}</p>
  `,
  styles: `
    :host {
      display: block;
    }
    .map {
      display: grid;
      gap: 0.3rem;
      justify-content: var(--map-align, center);
    }
    .map__row {
      display: flex;
      gap: 0.3rem;
      padding-left: calc(var(--indent) * 0.9rem);
    }
    .map__key {
      display: grid;
      place-items: center;
      width: clamp(1.6rem, 7.4vw, 2.4rem);
      aspect-ratio: 1;
      border-radius: 0.45rem;
      background: color-mix(in oklab, var(--miss-key) calc(var(--heat) * 100%), var(--key));
      box-shadow: 0 3px 0 color-mix(in oklab, var(--miss) calc(var(--heat) * 70%), var(--key-side));
      color: var(--ink);
      font-variation-settings: var(--casual);
      font-weight: 700;
      font-size: var(--text-sm);
    }
  `,
})
export class KeyMap {
  readonly tally = input.required<KeyTally>();

  protected readonly rows = ROWS.map((r) => [...r]);

  protected readonly heat = computed(() => {
    const tally = this.tally();
    const missed = Object.keys(tally).filter((k) => tally[k][1] > 0);
    const worst = Math.max(0, ...missed.map((k) => missRate(tally, k)));
    const heat: Record<string, number> = {};
    for (const k of missed)
      heat[k] = worst ? Math.round((missRate(tally, k) / worst) * 100) / 100 : 0;
    return heat;
  });

  protected readonly summary = computed(() => {
    const tally = this.tally();
    const missed = Object.keys(tally)
      .filter((k) => tally[k][1] > 0)
      .sort((a, b) => tally[b][1] - tally[a][1]);
    if (missed.length === 0) return 'No missed keys.';
    return `Missed keys: ${missed.map((k) => `${k} ${tally[k][1]} ${tally[k][1] === 1 ? 'time' : 'times'}`).join(', ')}.`;
  });
}
