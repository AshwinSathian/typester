import { Component, input, output } from '@angular/core';

/**
 * Purely presentational first-visit disclosure banner. No cookies are set
 * by this app (no analytics/tracking, no accounts) - what actually needs
 * disclosing is the local-storage usage, not a cookie consent choice, so
 * this is a transparency notice rather than a legally-required consent gate.
 *
 * Renders in normal document flow at the top of the page (see app.html),
 * not as a `position: fixed` overlay - a fixed bottom bar occupies the same
 * screen region regardless of scroll, which can end up covering (and
 * intercepting clicks on) a page's last interactive element no matter how
 * much layout space is reserved for it. An in-flow banner can only ever
 * push content down, never cover it, and its space is reclaimed for free
 * the instant it's removed from the DOM on dismiss - no permanent
 * reservation, no overlap, no measurement needed.
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
