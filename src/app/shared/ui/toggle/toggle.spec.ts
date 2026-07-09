import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { Toggle } from './toggle';

@Component({
  selector: 'app-test-host',
  imports: [Toggle],
  template: `<app-toggle [(checked)]="checked" ariaLabel="Sound" />`,
})
class TestHost {
  readonly checked = signal(true);
}

describe('Toggle', () => {
  it('reflects the checked input via aria-checked', () => {
    const fixture = TestBed.createComponent(TestHost);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(button.getAttribute('aria-checked')).toBe('true');
    expect(button.getAttribute('role')).toBe('switch');
    expect(button.getAttribute('aria-label')).toBe('Sound');
  });

  it('flips the model on click', () => {
    const fixture = TestBed.createComponent(TestHost);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    button.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.checked()).toBe(false);
    expect(button.getAttribute('aria-checked')).toBe('false');
  });
});
