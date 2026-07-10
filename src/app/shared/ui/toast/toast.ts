import { Component, effect, input, output } from '@angular/core';

/**
 * Non-blocking transient message. The parent controls existence (typically
 * via @if bound to a signal) - this component only owns the auto-dismiss
 * timer and the manual-dismiss interactions.
 */
@Component({
  selector: 'app-toast',
  template: `
    <div
      class="app-toast"
      role="status"
      aria-live="polite"
      tabindex="0"
      (click)="dismiss()"
      (document:keydown.escape)="dismiss()"
    >
      {{ message() }}
    </div>
  `,
  styleUrl: './toast.css',
})
export class Toast {
  readonly message = input.required<string>();
  readonly duration = input(3000);
  readonly dismissed = output<void>();

  constructor() {
    effect((onCleanup) => {
      this.message();
      const id = setTimeout(() => this.dismissed.emit(), this.duration());
      onCleanup(() => clearTimeout(id));
    });
  }

  dismiss(): void {
    this.dismissed.emit();
  }
}
