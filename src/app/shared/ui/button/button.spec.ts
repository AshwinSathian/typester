import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { Button } from './button';

@Component({
  selector: 'app-test-host',
  imports: [Button],
  template: `
    <app-button
      [variant]="variant"
      [disabled]="disabled"
      [fullWidth]="fullWidth"
      (pressed)="onPressed()"
    >
      Play
    </app-button>
  `,
})
class TestHost {
  variant: 'primary' | 'secondary' | 'ghost' = 'primary';
  disabled = false;
  fullWidth = false;
  pressCount = 0;

  onPressed(): void {
    this.pressCount++;
  }
}

describe('Button', () => {
  it('renders projected content and the primary variant class by default', () => {
    const fixture = TestBed.createComponent(TestHost);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;

    expect(button.textContent?.trim()).toBe('Play');
    expect(button.classList.contains('app-button--primary')).toBe(true);
  });

  it('emits pressed on click', () => {
    const fixture = TestBed.createComponent(TestHost);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;

    button.click();
    expect(fixture.componentInstance.pressCount).toBe(1);
  });

  it('forwards the disabled input to the native button and blocks clicks', () => {
    const fixture = TestBed.createComponent(TestHost);
    fixture.componentInstance.disabled = true;
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;

    expect(button.disabled).toBe(true);
    button.click();
    expect(fixture.componentInstance.pressCount).toBe(0);
  });

  it('applies the full-width and secondary/ghost variant classes', () => {
    const fixture = TestBed.createComponent(TestHost);
    fixture.componentInstance.variant = 'ghost';
    fixture.componentInstance.fullWidth = true;
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;

    expect(button.classList.contains('app-button--ghost')).toBe(true);
    expect(button.classList.contains('app-button--full')).toBe(true);
  });
});
