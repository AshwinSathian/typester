import { DOCUMENT } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { StorageService } from './core/services/storage.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly document = inject(DOCUMENT);
  private readonly storage = inject(StorageService);

  constructor() {
    effect(() => {
      const { theme, motion } = this.storage.settings();
      const root = this.document.documentElement;

      if (theme === 'system') {
        root.removeAttribute('data-theme');
      } else {
        root.setAttribute('data-theme', theme);
      }

      if (motion === 'system') {
        root.removeAttribute('data-motion');
      } else {
        root.setAttribute('data-motion', motion === 'reduced' ? 'reduced' : 'full');
      }
    });
  }
}
