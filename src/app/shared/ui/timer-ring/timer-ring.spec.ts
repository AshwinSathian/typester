import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { TimerRing } from './timer-ring';

@Component({
  selector: 'app-test-host',
  imports: [TimerRing],
  template: `<app-timer-ring [remainingSeconds]="remaining" [totalSeconds]="total" />`,
})
class TestHost {
  remaining = 30;
  total = 30;
}

describe('TimerRing', () => {
  function svg(fixture: ReturnType<typeof TestBed.createComponent<TestHost>>) {
    return fixture.nativeElement.querySelector('svg') as SVGElement;
  }

  it('is at full progress (zero dashoffset) when time is full', () => {
    const fixture = TestBed.createComponent(TestHost);
    fixture.detectChanges();
    const progress = svg(fixture).querySelector('.app-timer-ring__progress') as SVGCircleElement;
    expect(Number(progress.getAttribute('stroke-dashoffset'))).toBeCloseTo(0, 5);
  });

  it('is at near-full dashoffset (empty ring) when time has run out', () => {
    const fixture = TestBed.createComponent(TestHost);
    fixture.componentInstance.remaining = 0;
    fixture.detectChanges();
    const progress = svg(fixture).querySelector('.app-timer-ring__progress') as SVGCircleElement;
    const circumference = 2 * Math.PI * 42;
    expect(Number(progress.getAttribute('stroke-dashoffset'))).toBeCloseTo(circumference, 5);
  });

  it('applies the warning class at 20% or less remaining', () => {
    const fixture = TestBed.createComponent(TestHost);
    fixture.componentInstance.remaining = 6; // 20% of 30
    fixture.detectChanges();
    expect(svg(fixture).classList.contains('app-timer-ring--warning')).toBe(true);
    expect(svg(fixture).classList.contains('app-timer-ring--danger')).toBe(false);
  });

  it('applies the danger class at 10% or less remaining', () => {
    const fixture = TestBed.createComponent(TestHost);
    fixture.componentInstance.remaining = 3; // 10% of 30
    fixture.detectChanges();
    expect(svg(fixture).classList.contains('app-timer-ring--danger')).toBe(true);
  });

  it('exposes remaining time via an aria-label for screen readers', () => {
    const fixture = TestBed.createComponent(TestHost);
    fixture.componentInstance.remaining = 12.4;
    fixture.detectChanges();
    expect(svg(fixture).getAttribute('aria-label')).toBe('13 seconds remaining');
  });
});
