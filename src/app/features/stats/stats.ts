import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';

import { ACHIEVEMENTS, AchievementDef, AchievementId } from '../../core/models/achievement';
import { ComboDescriptor, allEndlessCombos, allGameCombos } from '../../core/models/game-config';
import { BestScoreEntry } from '../../core/models/stats';
import { StorageService } from '../../core/services/storage.service';
import { Button } from '../../shared/ui/button/button';
import { StatBadge } from '../../shared/ui/stat-badge/stat-badge';

@Component({
  selector: 'app-stats',
  imports: [Button, StatBadge],
  templateUrl: './stats.html',
  styleUrl: './stats.css',
})
export class Stats {
  private readonly router = inject(Router);
  private readonly storage = inject(StorageService);

  protected readonly stats = this.storage.stats;
  protected readonly combos: readonly ComboDescriptor[] = allGameCombos();
  protected readonly endlessCombos: readonly ComboDescriptor[] = allEndlessCombos();
  protected readonly achievements: readonly AchievementDef[] = ACHIEVEMENTS;

  protected readonly unlockedIds = computed(() => new Set(this.stats().achievementsUnlocked));

  isUnlocked(id: AchievementId): boolean {
    return this.unlockedIds().has(id);
  }

  bestScoreFor(combo: ComboDescriptor): BestScoreEntry | null {
    return this.stats().bestScores[combo.key] ?? null;
  }

  playCombo(combo: ComboDescriptor): void {
    const { config } = combo;
    this.router.navigate(['/play', config.mode, config.difficulty, config.durationSeconds]);
  }

  goToMenu(): void {
    void this.router.navigate(['/']);
  }
}
