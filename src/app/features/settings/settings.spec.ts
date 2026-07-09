import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { StorageService } from '../../core/services/storage.service';
import { Settings } from './settings';

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
    expect((el.querySelector('#theme') as HTMLSelectElement).value).toBe('dark');
    expect((el.querySelector('#sound') as HTMLInputElement).checked).toBe(false);
  });

  it('persists a theme change immediately, with no separate save action', () => {
    const fixture = TestBed.createComponent(Settings);
    fixture.detectChanges();
    const select = fixture.nativeElement.querySelector('#theme') as HTMLSelectElement;

    select.value = 'light';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    fixture.detectChanges();

    const storage = TestBed.inject(StorageService);
    expect(storage.settings().theme).toBe('light');
  });

  it('persists a sound toggle change immediately', () => {
    const fixture = TestBed.createComponent(Settings);
    fixture.detectChanges();
    const checkbox = fixture.nativeElement.querySelector('#sound') as HTMLInputElement;

    checkbox.checked = false;
    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
    fixture.detectChanges();

    const storage = TestBed.inject(StorageService);
    expect(storage.settings().soundEnabled).toBe(false);
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

  it('navigates home on Back to Menu', () => {
    const fixture = TestBed.createComponent(Settings);
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.detectChanges();

    fixture.nativeElement.querySelector('app-button button').click();

    expect(navigateSpy).toHaveBeenCalledWith(['/']);
  });
});
