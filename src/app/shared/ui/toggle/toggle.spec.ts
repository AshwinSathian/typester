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

@Component({
  selector: 'app-test-row-host',
  imports: [Toggle],
  template: `
    <app-toggle
      [(checked)]="checked"
      label="Sound effects"
      description="Play a cue for correct and incorrect answers"
    />
  `,
})
class RowTestHost {
  readonly checked = signal(true);
}

describe('Toggle with label/description', () => {
  it('renders the label and description as visible text', () => {
    const fixture = TestBed.createComponent(RowTestHost);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.app-toggle-row__label')?.textContent).toBe('Sound effects');
    expect(el.querySelector('.app-toggle-row__description')?.textContent).toBe(
      'Play a cue for correct and incorrect answers',
    );
  });

  it('combines label and description into the accessible name', () => {
    const fixture = TestBed.createComponent(RowTestHost);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;

    expect(button.getAttribute('aria-label')).toBe(
      'Sound effects. Play a cue for correct and incorrect answers',
    );
  });
});
