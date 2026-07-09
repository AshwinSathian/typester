import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { StatBadge } from './stat-badge';

@Component({
  selector: 'app-test-host',
  imports: [StatBadge],
  template: `<app-stat-badge label="Score" [value]="score()" [suffix]="suffix()" />`,
})
class TestHost {
  readonly score = signal(0);
  readonly suffix = signal('');
}

describe('StatBadge', () => {
  it('renders the label and formatted value', () => {
    const fixture = TestBed.createComponent(TestHost);
    fixture.componentInstance.score.set(42);
    fixture.componentInstance.suffix.set(' wpm');
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.app-stat-badge__label')?.textContent).toBe('Score');
    expect(el.querySelector('.app-stat-badge__value')?.textContent?.trim()).toBe('42 wpm');
  });

  it('does not pop on initial render', () => {
    const fixture = TestBed.createComponent(TestHost);
    fixture.componentInstance.score.set(10);
    fixture.detectChanges();

    const value = fixture.nativeElement.querySelector('.app-stat-badge__value') as HTMLElement;
    expect(value.classList.contains('app-stat-badge__value--pop')).toBe(false);
  });

  it('pops when the value changes after initial render', () => {
    const fixture = TestBed.createComponent(TestHost);
    fixture.detectChanges();

    fixture.componentInstance.score.set(5);
    fixture.detectChanges();

    const value = fixture.nativeElement.querySelector('.app-stat-badge__value') as HTMLElement;
    expect(value.classList.contains('app-stat-badge__value--pop')).toBe(true);
  });
});
