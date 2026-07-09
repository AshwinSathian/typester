import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { Home } from './home';

describe('Home', () => {
  beforeEach(() => {
    window.localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  it('navigates to a quick play round using the settings-configured duration', () => {
    const fixture = TestBed.createComponent(Home);
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.detectChanges();

    fixture.nativeElement.querySelectorAll('app-button')[0].querySelector('button').click();

    expect(navigateSpy).toHaveBeenCalledWith(['/play', 'quick', 'mixed', 90]);
  });

  it('reveals the difficulty/duration picker when Game Modes is pressed', () => {
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#mode-picker')).toBeNull();

    fixture.nativeElement.querySelectorAll('app-button')[1].querySelector('button').click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#mode-picker')).not.toBeNull();
  });

  it('navigates to a timed round with the chosen difficulty and duration', () => {
    const fixture = TestBed.createComponent(Home);
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.detectChanges();

    fixture.nativeElement.querySelectorAll('app-button')[1].querySelector('button').click();
    fixture.detectChanges();

    const difficultyButtons = fixture.nativeElement
      .querySelectorAll('#mode-picker app-segmented-control')[0]
      .querySelectorAll('button');
    difficultyButtons[2].click(); // hard
    fixture.detectChanges();

    const durationButtons = fixture.nativeElement
      .querySelectorAll('#mode-picker app-segmented-control')[1]
      .querySelectorAll('button');
    durationButtons[1].click(); // 60s
    fixture.detectChanges();

    const startButton = fixture.nativeElement.querySelector(
      '#mode-picker app-button:last-of-type button',
    );
    startButton.click();

    expect(navigateSpy).toHaveBeenCalledWith(['/play', 'timed', 'hard', '60']);
  });

  it('navigates to help and settings', () => {
    const fixture = TestBed.createComponent(Home);
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('app-button');
    buttons[2].querySelector('button').click();
    expect(navigateSpy).toHaveBeenCalledWith(['/help']);

    buttons[3].querySelector('button').click();
    expect(navigateSpy).toHaveBeenCalledWith(['/settings']);
  });
});
