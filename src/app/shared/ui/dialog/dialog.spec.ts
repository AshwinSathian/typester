import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { Dialog } from './dialog';

@Component({
  selector: 'app-test-host',
  imports: [Dialog],
  template: `
    <app-dialog [open]="open()" (openChange)="open.set($event)" title="How to play">
      <p>Type the word and press Enter.</p>
    </app-dialog>
  `,
})
class TestHost {
  readonly open = signal(false);
}

describe('Dialog', () => {
  // jsdom doesn't implement the <dialog> element's showModal()/close() at
  // all (unlike, say, a no-op stub) - polyfill them the same way a real
  // browser's semantics work (toggling the `open` attribute) so the
  // component under test can be exercised, and so we can assert on calls.
  beforeEach(() => {
    if (!HTMLDialogElement.prototype.showModal) {
      HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement): void {
        this.setAttribute('open', '');
      };
    }
    if (!HTMLDialogElement.prototype.close) {
      HTMLDialogElement.prototype.close = function (this: HTMLDialogElement): void {
        this.removeAttribute('open');
        this.dispatchEvent(new Event('close'));
      };
    }
  });

  it('renders the title and projected content', () => {
    const fixture = TestBed.createComponent(TestHost);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.app-dialog__title')?.textContent).toBe('How to play');
    expect(el.querySelector('p')?.textContent).toContain('Type the word');
  });

  it('calls showModal() when open becomes true', () => {
    const fixture = TestBed.createComponent(TestHost);
    fixture.detectChanges();
    const dialogEl = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    const showModalSpy = vi.spyOn(dialogEl, 'showModal');

    fixture.componentInstance.open.set(true);
    fixture.detectChanges();

    expect(showModalSpy).toHaveBeenCalled();
    expect(dialogEl.hasAttribute('open')).toBe(true);
  });

  it('calls close() when open becomes false', () => {
    const fixture = TestBed.createComponent(TestHost);
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    const dialogEl = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    const closeSpy = vi.spyOn(dialogEl, 'close');

    fixture.componentInstance.open.set(false);
    fixture.detectChanges();

    expect(closeSpy).toHaveBeenCalled();
    expect(dialogEl.hasAttribute('open')).toBe(false);
  });

  it('syncs the model back to false when the dialog fires its native close event', () => {
    const fixture = TestBed.createComponent(TestHost);
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    const dialogEl = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;

    dialogEl.close();
    fixture.detectChanges();

    expect(fixture.componentInstance.open()).toBe(false);
  });
});
