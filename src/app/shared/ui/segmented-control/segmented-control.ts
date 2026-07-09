import { NgTemplateOutlet } from '@angular/common';
import { Component, ElementRef, TemplateRef, inject, input, model } from '@angular/core';

export interface SegmentOption<T extends string = string> {
  readonly value: T;
  readonly label: string;
}

/**
 * Keyboard-first radio group: arrow keys move focus and selection together
 * (WAI-ARIA APG radiogroup pattern), Enter/Space activates the focused
 * segment natively since each segment is a real <button>.
 *
 * `variant="card"` + `optionTemplate` renders each segment as a taller
 * icon-and-label card instead of a compact pill (still the same accessible
 * radiogroup underneath) - for pickers where an icon materially helps
 * scanning (e.g. Settings' Theme/Motion), not a default worth reaching for
 * everywhere a segmented control is used.
 */
@Component({
  selector: 'app-segmented-control',
  imports: [NgTemplateOutlet],
  template: `
    <div
      class="app-segmented"
      [class.app-segmented--card]="variant() === 'card'"
      role="radiogroup"
      [attr.aria-label]="ariaLabel()"
    >
      @for (option of options(); track option.value; let i = $index) {
        <button
          #segment
          type="button"
          role="radio"
          class="app-segmented__option"
          [class.app-segmented__option--card]="variant() === 'card'"
          [class.app-segmented__option--selected]="option.value === value()"
          [attr.aria-checked]="option.value === value()"
          [tabindex]="option.value === value() ? 0 : -1"
          (click)="select(option.value)"
          (keydown)="onKeydown($event, i)"
        >
          @if (optionTemplate(); as tpl) {
            <ng-container *ngTemplateOutlet="tpl; context: { $implicit: option }" />
          } @else {
            {{ option.label }}
          }
        </button>
      }
    </div>
  `,
  styleUrl: './segmented-control.css',
})
export class SegmentedControl<T extends string = string> {
  readonly options = input.required<readonly SegmentOption<T>[]>();
  readonly value = model.required<T>();
  readonly ariaLabel = input('');
  readonly variant = input<'pill' | 'card'>('pill');
  readonly optionTemplate = input<TemplateRef<{ $implicit: SegmentOption<T> }> | undefined>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  select(value: T): void {
    this.value.set(value);
  }

  onKeydown(event: KeyboardEvent, currentIndex: number): void {
    const opts = this.options();
    let nextIndex: number | null = null;

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        nextIndex = (currentIndex + 1) % opts.length;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        nextIndex = (currentIndex - 1 + opts.length) % opts.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = opts.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    this.value.set(opts[nextIndex].value);
    queueMicrotask(() => {
      const buttons =
        this.host.nativeElement.querySelectorAll<HTMLButtonElement>('.app-segmented__option');
      buttons[nextIndex!]?.focus();
    });
  }
}
