import { Component, computed, input, model } from '@angular/core';

/**
 * A switch, not a restyled checkbox - checkboxes keep their native square/
 * tick affordance even with heavy CSS, which reads as "system form control"
 * regardless of color. A button with role="switch" gets Enter/Space for
 * free and needs no native element to look distinct from the OS.
 *
 * Optionally renders as a full label+description row (the switch trailing,
 * text leading) rather than a bare switch, for settings-list usage where a
 * one-word label alone doesn't explain what the setting does.
 */
@Component({
  selector: 'app-toggle',
  template: `
    <button
      type="button"
      role="switch"
      class="app-toggle-row"
      [class.app-toggle-row--bare]="!label() && !description()"
      [attr.aria-checked]="checked()"
      [attr.aria-label]="computedAriaLabel() || null"
      (click)="toggle()"
    >
      @if (label() || description()) {
        <span class="app-toggle-row__text">
          @if (label()) {
            <span class="app-toggle-row__label">{{ label() }}</span>
          }
          @if (description()) {
            <span class="app-toggle-row__description">{{ description() }}</span>
          }
        </span>
      }
      <span class="app-toggle" [class.app-toggle--on]="checked()">
        <span class="app-toggle__thumb"></span>
      </span>
    </button>
  `,
  styleUrl: './toggle.css',
})
export class Toggle {
  readonly checked = model.required<boolean>();
  readonly ariaLabel = input('');
  readonly label = input('');
  readonly description = input('');

  protected readonly computedAriaLabel = computed(() => {
    if (this.label() || this.description()) {
      return [this.label(), this.description()].filter(Boolean).join('. ');
    }
    return this.ariaLabel();
  });

  toggle(): void {
    this.checked.set(!this.checked());
  }
}
