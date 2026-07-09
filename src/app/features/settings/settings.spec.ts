import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { StorageService } from '../../core/services/storage.service';
import { Settings } from './settings';

function radioGroup(el: HTMLElement, ariaLabel: string): HTMLElement {
  return el.querySelector(`[role="radiogroup"][aria-label="${ariaLabel}"]`) as HTMLElement;
}

function radioButton(group: HTMLElement, label: string): HTMLButtonElement {
  return Array.from(group.querySelectorAll('button')).find(
    (b) => b.textContent?.trim() === label,
  ) as HTMLButtonElement;
}

describe('Settings', () => {
  beforeEach(() => {
    window.localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  it('reflects the currently stored settings in each field', () => {
    const storage = TestBed.inject(StorageService);
    storage.updateSettings({ theme: 'dark', soundEnabled: false });
    const fixture = TestBed.createComponent(Settings);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(radioButton(radioGroup(el, 'Theme'), 'Dark').getAttribute('aria-checked')).toBe('true');
    expect(el.querySelector('[role="switch"]')?.getAttribute('aria-checked')).toBe('false');
  });

  it('persists a theme change immediately, with no separate save action', () => {
    const fixture = TestBed.createComponent(Settings);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    radioButton(radioGroup(el, 'Theme'), 'Light').click();
    fixture.detectChanges();

    const storage = TestBed.inject(StorageService);
    expect(storage.settings().theme).toBe('light');
  });

  it('persists a sound toggle change immediately', () => {
    const fixture = TestBed.createComponent(Settings);
    fixture.detectChanges();
    const toggle = fixture.nativeElement.querySelector('[role="switch"]') as HTMLButtonElement;

    toggle.click();
    fixture.detectChanges();

    const storage = TestBed.inject(StorageService);
    expect(storage.settings().soundEnabled).toBe(false);
  });

  it('persists a motion change immediately', () => {
    const fixture = TestBed.createComponent(Settings);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    radioButton(radioGroup(el, 'Motion'), 'Reduced').click();
    fixture.detectChanges();

    const storage = TestBed.inject(StorageService);
    expect(storage.settings().motion).toBe('reduced');
  });

  it('shows a validation error when the quick play duration is out of range', () => {
    const fixture = TestBed.createComponent(Settings);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('#quick-duration') as HTMLInputElement;

    input.value = '999';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.settings__error')).not.toBeNull();
  });

  it('groups fields into labeled sections with an icon per Theme/Motion option', () => {
    const fixture = TestBed.createComponent(Settings);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    const sectionLabels = Array.from(el.querySelectorAll('.settings__section-label')).map((n) =>
      n.textContent?.trim(),
    );
    expect(sectionLabels).toEqual(['Appearance', 'Sound', 'Gameplay']);

    const themeGroup = radioGroup(el, 'Theme');
    for (const button of Array.from(themeGroup.querySelectorAll('button'))) {
      expect(button.querySelector('svg.settings__option-icon')).not.toBeNull();
    }
  });

  it('shows a description alongside the Sound effects toggle label', () => {
    const fixture = TestBed.createComponent(Settings);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.app-toggle-row__label')?.textContent).toBe('Sound effects');
    expect(el.querySelector('.app-toggle-row__description')?.textContent).toContain('cue');
  });

  it('navigates home on Back to Menu', () => {
    const fixture = TestBed.createComponent(Settings);
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.detectChanges();

    fixture.nativeElement.querySelector('app-button button').click();

    expect(navigateSpy).toHaveBeenCalledWith(['/']);
  });
});
