import { Component, Signal, effect, inject, signal, untracked } from '@angular/core';
import { FormField, form, max, min } from '@angular/forms/signals';
import { Router } from '@angular/router';

import { MotionPreference, ThemePreference } from '../../core/models/settings';
import { StorageService } from '../../core/services/storage.service';
import { Button } from '../../shared/ui/button/button';
import {
  SegmentedControl,
  SegmentOption,
} from '../../shared/ui/segmented-control/segmented-control';
import { Toggle } from '../../shared/ui/toggle/toggle';

@Component({
  selector: 'app-settings',
  imports: [FormField, Button, SegmentedControl, Toggle],
  templateUrl: './settings.html',
  styleUrl: './settings.css',
})
export class Settings {
  private readonly router = inject(Router);
  private readonly storage = inject(StorageService);

  protected readonly themeOptions: readonly SegmentOption<ThemePreference>[] = [
    { value: 'system', label: 'System' },
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
  ];
  protected readonly motionOptions: readonly SegmentOption<MotionPreference>[] = [
    { value: 'system', label: 'System' },
    { value: 'full', label: 'Full' },
    { value: 'reduced', label: 'Reduced' },
  ];

  // Theme/Motion/Sound are plain enum/boolean pickers with no validation -
  // no different from Home's difficulty/duration SegmentedControl, so they
  // persist the same way (a local signal + skip-first-run effect) rather
  // than through Signal Forms. Quick Play duration is the one field with a
  // real range constraint, so it's the one still backed by Signal Forms.
  protected readonly theme = signal<ThemePreference>(this.storage.settings().theme);
  protected readonly motion = signal<MotionPreference>(this.storage.settings().motion);
  protected readonly soundEnabled = signal(this.storage.settings().soundEnabled);

  protected readonly model = signal(this.storage.settings());
  protected readonly settingsForm = form(this.model, (path) => {
    min(path.quickPlayDurationSeconds, 15);
    max(path.quickPlayDurationSeconds, 300);
  });

  constructor() {
    this.persistOnChange(this.theme, (theme) => this.storage.updateSettings({ theme }));
    this.persistOnChange(this.motion, (motion) => this.storage.updateSettings({ motion }));
    this.persistOnChange(this.soundEnabled, (soundEnabled) =>
      this.storage.updateSettings({ soundEnabled }),
    );
  }

  private persistOnChange<T>(source: Signal<T>, persist: (value: T) => void): void {
    let isFirstRun = true;
    effect(() => {
      const value = source();
      if (isFirstRun) {
        isFirstRun = false;
        return;
      }
      // untracked is required here, not just tidy: updateSettings() both
      // reads and writes StorageService's settings signal. Without
      // untracked, that nested read gets swept into this effect's own
      // dependency set, and since updateSettings always writes a fresh
      // object (never Object.is-equal to the last), the effect would then
      // re-trigger itself on its own write, forever.
      untracked(() => persist(value));
    });
  }

  onQuickPlayDurationChange(event: Event): void {
    if (this.settingsForm.quickPlayDurationSeconds().invalid()) return;
    this.storage.updateSettings({
      quickPlayDurationSeconds: Number((event.target as HTMLInputElement).value),
    });
  }

  goToMenu(): void {
    void this.router.navigate(['/']);
  }
}
