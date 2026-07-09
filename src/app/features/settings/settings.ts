import { Component, inject, signal } from '@angular/core';
import { FormField, form, max, min } from '@angular/forms/signals';
import { Router } from '@angular/router';

import {
  MotionPreference,
  Settings as SettingsModel,
  ThemePreference,
} from '../../core/models/settings';
import { StorageService } from '../../core/services/storage.service';
import { Button } from '../../shared/ui/button/button';

@Component({
  selector: 'app-settings',
  imports: [FormField, Button],
  templateUrl: './settings.html',
  styleUrl: './settings.css',
})
export class Settings {
  private readonly router = inject(Router);
  private readonly storage = inject(StorageService);

  protected readonly model = signal<SettingsModel>(this.storage.settings());
  protected readonly settingsForm = form(this.model, (path) => {
    min(path.quickPlayDurationSeconds, 15);
    max(path.quickPlayDurationSeconds, 300);
  });

  // Every field persists on change - no separate "Save" button (this is
  // what fixes the legacy SettingsComponent, which built a FormGroup but
  // never wired up anything that actually saved it). Persisting from each
  // field's own native (change) event - rather than a single effect() over
  // the whole form model - keeps this deterministic and side-effect-free.
  onThemeChange(event: Event): void {
    this.storage.updateSettings({
      theme: (event.target as HTMLSelectElement).value as ThemePreference,
    });
  }

  onSoundChange(event: Event): void {
    this.storage.updateSettings({ soundEnabled: (event.target as HTMLInputElement).checked });
  }

  onMotionChange(event: Event): void {
    this.storage.updateSettings({
      motion: (event.target as HTMLSelectElement).value as MotionPreference,
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
