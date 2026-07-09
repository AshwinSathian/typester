import { Component, inject, signal } from '@angular/core';
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
  // no different from Home's difficulty/duration SegmentedControl. They
  // persist synchronously from the same event that changed them (like
  // onQuickPlayDurationChange below), not via an effect() watching the
  // signal: an effect's flush is scheduler-timed, not tied to the
  // triggering event, so a click immediately followed by navigation (e.g.
  // a fast e2e reload, or a real user tapping a setting then immediately
  // leaving the page) could race ahead of the effect and silently drop the
  // write. A direct call in the same handler has no such window.
  protected readonly theme = signal<ThemePreference>(this.storage.settings().theme);
  protected readonly motion = signal<MotionPreference>(this.storage.settings().motion);
  protected readonly soundEnabled = signal(this.storage.settings().soundEnabled);

  protected readonly model = signal(this.storage.settings());
  protected readonly settingsForm = form(this.model, (path) => {
    min(path.quickPlayDurationSeconds, 15);
    max(path.quickPlayDurationSeconds, 300);
  });

  onThemeChange(theme: ThemePreference): void {
    this.theme.set(theme);
    this.storage.updateSettings({ theme });
  }

  onMotionChange(motion: MotionPreference): void {
    this.motion.set(motion);
    this.storage.updateSettings({ motion });
  }

  onSoundChange(soundEnabled: boolean): void {
    this.soundEnabled.set(soundEnabled);
    this.storage.updateSettings({ soundEnabled });
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
