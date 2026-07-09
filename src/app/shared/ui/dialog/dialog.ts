import { Component, ElementRef, effect, input, model, viewChild } from '@angular/core';

/**
 * Wraps the native <dialog> element (showModal()) for confirmation/help
 * overlays - free focus-trapping and Escape-to-close from the platform,
 * no custom accessibility reimplementation needed.
 */
@Component({
  selector: 'app-dialog',
  template: `
    <dialog #dialogEl class="app-dialog" (close)="open.set(false)">
      @if (title()) {
        <h2 class="app-dialog__title">{{ title() }}</h2>
      }
      <ng-content />
    </dialog>
  `,
  styleUrl: './dialog.css',
})
export class Dialog {
  readonly open = model.required<boolean>();
  readonly title = input('');

  private readonly dialogEl = viewChild.required<ElementRef<HTMLDialogElement>>('dialogEl');

  constructor() {
    effect(() => {
      const el = this.dialogEl().nativeElement;
      if (this.open()) {
        if (!el.open) el.showModal();
      } else if (el.open) {
        el.close();
      }
    });
  }
}
