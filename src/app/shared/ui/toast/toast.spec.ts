import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { Toast } from './toast';

@Component({
  selector: 'app-test-host',
  imports: [Toast],
  template: `<app-toast [message]="message" [duration]="duration" (dismissed)="onDismissed()" />`,
})
class TestHost {
  message = 'Settings saved';
  duration = 3000;
  dismissCount = 0;

  onDismissed(): void {
    this.dismissCount++;
  }
}

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the message with a polite live region', () => {
    const fixture = TestBed.createComponent(TestHost);
    fixture.detectChanges();
    const el = fixture.nativeElement.querySelector('.app-toast') as HTMLElement;

    expect(el.textContent?.trim()).toBe('Settings saved');
    expect(el.getAttribute('role')).toBe('status');
    expect(el.getAttribute('aria-live')).toBe('polite');
  });

  it('auto-dismisses after the given duration', () => {
    const fixture = TestBed.createComponent(TestHost);
    fixture.detectChanges();

    vi.advanceTimersByTime(3000);
    expect(fixture.componentInstance.dismissCount).toBe(1);
  });

  it('dismisses immediately on click', () => {
    const fixture = TestBed.createComponent(TestHost);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.app-toast') as HTMLElement).click();

    expect(fixture.componentInstance.dismissCount).toBe(1);
  });

  it('dismisses on Escape', () => {
    const fixture = TestBed.createComponent(TestHost);
    fixture.detectChanges();
    const el = fixture.nativeElement.querySelector('.app-toast') as HTMLElement;
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(fixture.componentInstance.dismissCount).toBe(1);
  });

  it('dismisses on Escape even when focus never moved to the toast itself', () => {
    // The toast never receives focus automatically (it's a passive
    // role="status" region, not a modal) - a keyboard user dismissing it
    // presses Escape from wherever focus already is (e.g. the button that
    // triggered it), not from the toast. The dismiss listener must be
    // document-level, not scoped to the toast element, or Escape silently
    // does nothing in that (the actual, common) case.
    const fixture = TestBed.createComponent(TestHost);
    fixture.detectChanges();
    expect(document.activeElement).not.toBe(fixture.nativeElement.querySelector('.app-toast'));

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(fixture.componentInstance.dismissCount).toBe(1);
  });
});
