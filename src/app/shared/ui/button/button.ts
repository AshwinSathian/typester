import { Component, input, output } from '@angular/core';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

@Component({
  selector: 'app-button',
  template: `
    <button
      class="app-button"
      [class.app-button--primary]="variant() === 'primary'"
      [class.app-button--secondary]="variant() === 'secondary'"
      [class.app-button--ghost]="variant() === 'ghost'"
      [class.app-button--full]="fullWidth()"
      [type]="type()"
      [disabled]="disabled()"
      (click)="pressed.emit($event)"
    >
      <ng-content />
    </button>
  `,
  styleUrl: './button.css',
})
export class Button {
  readonly variant = input<ButtonVariant>('primary');
  readonly type = input<'button' | 'submit'>('button');
  readonly disabled = input(false);
  readonly fullWidth = input(false);
  readonly pressed = output<MouseEvent>();
}
