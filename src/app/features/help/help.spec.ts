import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { Help } from './help';

describe('Help', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  it('renders one disclosure per FAQ item', () => {
    const fixture = TestBed.createComponent(Help);
    fixture.detectChanges();
    const items = fixture.nativeElement.querySelectorAll('.help__item');
    expect(items.length).toBe(fixture.componentInstance['faqs'].length);
    expect(items.length).toBeGreaterThan(0);
  });

  it('navigates home on Back to Menu', () => {
    const fixture = TestBed.createComponent(Help);
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.detectChanges();

    fixture.nativeElement.querySelector('app-button button').click();

    expect(navigateSpy).toHaveBeenCalledWith(['/']);
  });
});
