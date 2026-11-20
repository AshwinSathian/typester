import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Back-to-home link and page title, shared by the quieter pages. */
@Component({
  selector: 'app-page-header',
  imports: [RouterLink],
  template: `
    <a class="back tap" routerLink="/">Back to Typester</a>
    <h1>{{ title() }}</h1>
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--space-4);
      margin-bottom: var(--space-8);
    }
    .back {
      justify-self: start;
      color: var(--ink-soft);
      font-weight: 600;
      text-decoration: none;
    }
    .back:hover {
      color: var(--ink);
      text-decoration: underline;
    }
    h1 {
      margin: 0;
      font-variation-settings: var(--casual);
      font-size: var(--text-2xl);
      font-weight: 900;
      line-height: 1.1;
    }
  `,
})
export class PageHeader {
  readonly title = input.required<string>();
}
