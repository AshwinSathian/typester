import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { Difficulty, DIFFICULTIES } from '../../core/models/difficulty';
import { GAME_DURATIONS } from '../../core/models/game-config';
import { StorageService } from '../../core/services/storage.service';
import { Button } from '../../shared/ui/button/button';
import {
  SegmentedControl,
  SegmentOption,
} from '../../shared/ui/segmented-control/segmented-control';

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

@Component({
  selector: 'app-home',
  imports: [Button, SegmentedControl],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  private readonly router = inject(Router);
  private readonly storage = inject(StorageService);

  protected readonly showModePicker = signal(false);
  protected readonly difficulty = signal<Difficulty>('easy');
  protected readonly duration = signal<string>('60');

  protected readonly difficultyOptions: readonly SegmentOption<Difficulty>[] = DIFFICULTIES.map(
    (value) => ({ value, label: capitalize(value) }),
  );
  protected readonly durationOptions: readonly SegmentOption<string>[] = GAME_DURATIONS.map(
    (value) => ({ value: String(value), label: `${value}s` }),
  );

  startQuickPlay(): void {
    const duration = this.storage.settings().quickPlayDurationSeconds;
    this.router.navigate(['/play', 'quick', 'mixed', duration]);
  }

  toggleModePicker(): void {
    this.showModePicker.update((visible) => !visible);
  }

  startTimedGame(): void {
    this.router.navigate(['/play', 'timed', this.difficulty(), this.duration()]);
  }

  goToHelp(): void {
    this.router.navigate(['/help']);
  }

  goToSettings(): void {
    this.router.navigate(['/settings']);
  }
}
