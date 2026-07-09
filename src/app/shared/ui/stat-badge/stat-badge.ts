import { Component, computed, effect, input, signal } from '@angular/core';

@Component({
  selector: 'app-stat-badge',
  template: `
    <div class="app-stat-badge">
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

  protected readonly popping = signal(false);
  protected readonly formattedValue = computed(() => `${this.value()}${this.suffix()}`);

  constructor() {
    let isFirstRun = true;
    effect((onCleanup) => {
      this.value();
      if (isFirstRun) {
        isFirstRun = false;
        return;
      }
      this.popping.set(true);
      const id = setTimeout(() => this.popping.set(false), 260);
      onCleanup(() => clearTimeout(id));
    });
  }
}
