import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { NoticeBanner } from './notice-banner';

@Component({
  selector: 'app-test-host',
  imports: [NoticeBanner],
  template: `
    <app-notice-banner [visible]="visible()" (dismiss)="dismissCount = dismissCount + 1">
      Stored locally.
    </app-notice-banner>
  `,
})
class TestHost {
  readonly visible = signal(true);
  dismissCount = 0;
}

describe('NoticeBanner', () => {
  it('renders projected content when visible', () => {
    const fixture = TestBed.createComponent(TestHost);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.app-notice-banner__text')?.textContent).toContain(
      'Stored locally.',
    );
  });

  it('renders nothing when not visible', () => {
    const fixture = TestBed.createComponent(TestHost);
    fixture.componentInstance.visible.set(false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.app-notice-banner')).toBeNull();
  });

  it('emits dismiss when the button is clicked', () => {
    const fixture = TestBed.createComponent(TestHost);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('.app-notice-banner__dismiss').click();
    expect(fixture.componentInstance.dismissCount).toBe(1);
  });
});
