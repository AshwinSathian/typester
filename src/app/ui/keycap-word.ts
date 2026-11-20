import { Component, computed, input } from '@angular/core';

/**
 * A word as a row of keycaps. Letters already typed are pressed down; the
 * next letter is marked. Purely visual: the parent owns the accessible text.
 */
@Component({
  selector: 'app-keycap-word',
  host: {
    'aria-hidden': 'true',
    class: 'keycap-word',
    '[style.--n]': 'letters().length',
    '[class.keycap-word--gold]': 'gold()',
    // Re-keyed on every miss so the shake animation restarts.
    '[attr.data-miss]': 'missParity()',
  },
  template: `
    @for (letter of letters(); track $index) {
      <span
        class="key keycap-word__cap"
        [class.key--accent]="$index < typed() && !gold()"
        [class.key--gold]="gold() && $index < typed()"
        [class.is-down]="$index < typed()"
        [class.keycap-word__cap--next]="$index === typed()"
        >{{ letter }}</span
      >
    }
  `,
  styles: `
    :host {
      --cap: min(var(--keycap), calc(100cqi / (var(--n) * 1.14)));
      display: flex;
      flex-wrap: nowrap;
      justify-content: center;
      gap: calc(var(--cap) * 0.12);
      padding-bottom: calc(var(--travel) + 0.8rem);
    }
    .keycap-word__cap {
      width: var(--cap);
      height: calc(var(--cap) * 1.08);
      font-size: calc(var(--cap) * 0.52);
      font-weight: 800;
      line-height: 1;
      cursor: default;
      flex-shrink: 1;
      min-width: 0;
    }
    .keycap-word__cap {
      position: relative;
    }
    /* The cursor: a bar under the next key to press. */
    .keycap-word__cap--next::after {
      content: '';
      position: absolute;
      left: 22%;
      right: 22%;
      bottom: calc(-1 * var(--travel) - 0.6rem);
      height: 4px;
      border-radius: 2px;
      background: var(--cursor, var(--accent));
    }
    :host(.keycap-word--gold) .keycap-word__cap:not(.is-down) {
      box-shadow:
        0 var(--travel) 0 var(--gold-side),
        0 0 0 3px var(--gold);
    }
    :host([data-miss='0']) {
      animation: shake-a var(--d-base) var(--ease);
    }
    :host([data-miss='1']) {
      animation: shake-b var(--d-base) var(--ease);
    }
    :host([data-miss]) {
      --cursor: var(--miss);
    }
    :host([data-miss]) .keycap-word__cap--next {
      color: var(--miss);
    }
    @keyframes shake-a {
      25% {
        transform: translateX(-6px);
      }
      75% {
        transform: translateX(6px);
      }
    }
    @keyframes shake-b {
      25% {
        transform: translateX(-6px);
      }
      75% {
        transform: translateX(6px);
      }
    }
  `,
})
export class KeycapWord {
  readonly text = input.required<string>();
  readonly typed = input(0);
  readonly gold = input(false);
  /** Increments on every miss; null when the last keystroke was a hit. */
  readonly misses = input<number | null>(null);

  protected readonly letters = computed(() => [...this.text()]);
  protected readonly missParity = computed(() => {
    const m = this.misses();
    return m === null ? null : m % 2;
  });
}
