import { DOCUMENT } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Meta } from '@angular/platform-browser';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';

import { Store } from './core/store';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
})
export class App {
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly meta = inject(Meta);
  private readonly store = inject(Store);

  constructor() {
    // index.html applies these before first paint; this keeps them in step
    // when Settings changes them.
    effect(() => {
      const { theme, motion } = this.store.settings();
      const root = this.document.documentElement;
      if (theme === 'system') root.removeAttribute('data-theme');
      else root.setAttribute('data-theme', theme);
      if (motion === 'system') root.removeAttribute('data-motion');
      else root.setAttribute('data-motion', motion);
    });

    // The router sets <title>; this copies each route's description into
    // the meta tags that link previews read.
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.syncMeta());
  }

  private syncMeta(): void {
    let route = this.route;
    while (route.firstChild) route = route.firstChild;
    const description = route.snapshot.data['description'] as string | undefined;
    if (description) {
      this.meta.updateTag({ name: 'description', content: description });
      this.meta.updateTag({ property: 'og:description', content: description });
      this.meta.updateTag({ name: 'twitter:description', content: description });
    }
    this.meta.updateTag({ property: 'og:title', content: this.document.title });
    this.meta.updateTag({ name: 'twitter:title', content: this.document.title });
  }
}
