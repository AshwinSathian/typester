import { DOCUMENT } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Meta } from '@angular/platform-browser';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';

import { StorageService } from './core/services/storage.service';
import { NoticeBanner } from './shared/ui/notice-banner/notice-banner';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NoticeBanner, RouterLink],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly meta = inject(Meta);
  protected readonly storage = inject(StorageService);

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

    // Angular's Router sets document.title from each route's `title` on its
    // own; this mirrors that per-route data into the description/OG/Twitter
    // meta tags, which the router has no built-in equivalent for.
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.syncMetaTags());
  }

  private syncMetaTags(): void {
    let route = this.activatedRoute;
    while (route.firstChild) {
      route = route.firstChild;
    }

    const description = route.snapshot.data['description'] as string | undefined;
    if (description) {
      this.meta.updateTag({ name: 'description', content: description });
      this.meta.updateTag({ property: 'og:description', content: description });
      this.meta.updateTag({ name: 'twitter:description', content: description });
    }

    const title = this.document.title;
    this.meta.updateTag({ property: 'og:title', content: title });
    this.meta.updateTag({ name: 'twitter:title', content: title });
  }

  dismissNotice(): void {
    this.storage.updateSettings({ localStorageNoticeDismissed: true });
  }
}
