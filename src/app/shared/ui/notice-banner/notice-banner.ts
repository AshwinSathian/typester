import { Component, input, output } from '@angular/core';

/**
 * Purely presentational first-visit disclosure banner. No cookies are set
 * by this app (no analytics/tracking, no accounts) - what actually needs
 * disclosing is the local-storage usage, not a cookie consent choice, so
 * this is a transparency notice rather than a legally-required consent gate.
 */
@Component({
  selector: 'app-notice-banner',
  template: `
    @if (visible()) {
      <div class="app-notice-banner" role="note">
        <p class="app-notice-banner__text"><ng-content /></p>
        <button type="button" class="app-notice-banner__dismiss" (click)="dismiss.emit()">
          Got it
        </button>
      </div>
    }
  `,
  styleUrl: './notice-banner.css',
})
export class NoticeBanner {
  readonly visible = input(true);
  readonly dismiss = output<void>();
}
