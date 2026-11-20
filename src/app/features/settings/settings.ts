import { Component, inject, signal } from '@angular/core';

import { Motion, Settings as Prefs, Store, Theme } from '../../core/store';
import { PageHeader } from '../../ui/page-header';

interface Choice<T> {
  readonly value: T;
  readonly label: string;
}

@Component({
  selector: 'app-settings',
  imports: [PageHeader],
  templateUrl: './settings.html',
  styleUrl: './settings.css',
})
export class Settings {
  private readonly store = inject(Store);

  protected readonly settings = this.store.settings;
  protected readonly confirmingReset = signal(false);
  protected readonly resetDone = signal(false);

  protected readonly themes: readonly Choice<Theme>[] = [
    { value: 'system', label: 'Match device' },
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
  ];

  protected readonly motions: readonly Choice<Motion>[] = [
    { value: 'system', label: 'Match device' },
    { value: 'full', label: 'Full' },
    { value: 'reduced', label: 'Reduced' },
  ];

  /** Writes straight away: there is no save button to forget. */
  protected set<K extends keyof Prefs>(key: K, value: Prefs[K]): void {
    this.store.updateSettings({ [key]: value });
  }

  protected reset(): void {
    if (!this.confirmingReset()) {
      this.confirmingReset.set(true);
      return;
    }
    this.store.reset();
    this.confirmingReset.set(false);
    this.resetDone.set(true);
  }
}
