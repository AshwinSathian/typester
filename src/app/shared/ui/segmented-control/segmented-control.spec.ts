import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { SegmentedControl, SegmentOption } from './segmented-control';

@Component({
  selector: 'app-test-host',
  imports: [SegmentedControl],
  template: `
    <app-segmented-control [options]="options" [(value)]="value" ariaLabel="Difficulty" />
  `,
})
class TestHost {
  options: readonly SegmentOption[] = [
    { value: 'easy', label: 'Easy' },
    { value: 'medium', label: 'Medium' },
    { value: 'hard', label: 'Hard' },
  ];
  value = 'easy';
}

describe('SegmentedControl', () => {
  function buttons(fixture: ReturnType<typeof TestBed.createComponent<TestHost>>) {
    return Array.from(
      fixture.nativeElement.querySelectorAll('button.app-segmented__option'),
    ) as HTMLButtonElement[];
  }

  it('renders one radio button per option and marks the current value checked', () => {
    const fixture = TestBed.createComponent(TestHost);
    fixture.detectChanges();
    const btns = buttons(fixture);

    expect(btns).toHaveLength(3);
    expect(btns[0].getAttribute('aria-checked')).toBe('true');
    expect(btns[1].getAttribute('aria-checked')).toBe('false');
  });

  it('only the selected segment is in the tab order (roving tabindex)', () => {
    const fixture = TestBed.createComponent(TestHost);
    fixture.detectChanges();
    const btns = buttons(fixture);

    expect(btns[0].tabIndex).toBe(0);
    expect(btns[1].tabIndex).toBe(-1);
    expect(btns[2].tabIndex).toBe(-1);
  });

  it('updates the bound value on click', () => {
    const fixture = TestBed.createComponent(TestHost);
    fixture.detectChanges();
    buttons(fixture)[2].click();
    fixture.detectChanges();

    expect(fixture.componentInstance.value).toBe('hard');
  });

  it('moves selection with ArrowRight/ArrowLeft, wrapping at the ends', () => {
    const fixture = TestBed.createComponent(TestHost);
    fixture.detectChanges();

    buttons(fixture)[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    fixture.detectChanges();
    expect(fixture.componentInstance.value).toBe('hard'); // wraps backward from first

    buttons(fixture)[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    fixture.detectChanges();
    expect(fixture.componentInstance.value).toBe('easy'); // wraps forward from last
  });

  it('jumps to the first/last option on Home/End', () => {
    const fixture = TestBed.createComponent(TestHost);
    fixture.detectChanges();

    buttons(fixture)[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }));
    fixture.detectChanges();
    expect(fixture.componentInstance.value).toBe('hard');

    buttons(fixture)[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'Home' }));
    fixture.detectChanges();
    expect(fixture.componentInstance.value).toBe('easy');
  });
});
