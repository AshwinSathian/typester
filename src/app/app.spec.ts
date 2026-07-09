import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { StorageService } from './core/services/storage.service';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    window.localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('renders a skip-to-content link before the router outlet', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('a.skip-link')?.getAttribute('href')).toBe('#main-content');
  });

  it('reflects the theme setting as a data-theme attribute on <html>', async () => {
    const storage = TestBed.inject(StorageService);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();

    storage.updateSettings({ theme: 'dark' });
    fixture.detectChanges();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    storage.updateSettings({ theme: 'system' });
    fixture.detectChanges();
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('removes the notice banner from the DOM entirely once dismissed, reclaiming its space', async () => {
    const storage = TestBed.inject(StorageService);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('.app-notice-banner')).not.toBeNull();

    storage.updateSettings({ localStorageNoticeDismissed: true });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.app-notice-banner')).toBeNull();
  });
});
