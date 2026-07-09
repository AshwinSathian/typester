import { Component, input, model } from '@angular/core';

/**
 * A switch, not a restyled checkbox - checkboxes keep their native square/
 * tick affordance even with heavy CSS, which reads as "system form control"
 * regardless of color. A button with role="switch" gets Enter/Space for
 * free and needs no native element to look distinct from the OS.
 */
@Component({
  selector: 'app-toggle',
  template: `
    <button
      type="button"
      role="switch"
      class="app-toggle"
      [class.app-toggle--on]="checked()"
      [attr.aria-checked]="checked()"
      [attr.aria-label]="ariaLabel() || null"
      (click)="toggle()"
    >
      <span class="app-toggle__thumb"></span>
    </button>
  `,
  styleUrl: './toggle.css',
})
export class Toggle {
  readonly checked = model.required<boolean>();
  readonly ariaLabel = input('');

  toggle(): void {
    this.checked.set(!this.checked());
  }
}
