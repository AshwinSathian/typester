import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { StorageService } from '../../core/services/storage.service';
import { Home } from './home';

describe('Home', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows no stats teaser for a first-time visitor', () => {
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.home__teaser')).toBeNull();
  });

  it('shows a day-streak and best-score chip for a returning player', () => {
    const storage = TestBed.inject(StorageService);
    storage.recordResult({
      config: { mode: 'timed', difficulty: 'easy', durationSeconds: 30 },
      wordsCorrect: 10,
      wordsIncorrect: 0,
      baseScore: 10,
      timeBonus: 5,
      totalScore: 15,
      wpm: 40,
      accuracy: 1,
      bestStreak: 10,
      achievementsUnlocked: [],
      finishedAt: new Date().toISOString(),
    });

    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();

    const teaser = fixture.nativeElement.querySelector('.home__teaser');
    expect(teaser).not.toBeNull();
    expect(teaser.textContent).toContain('Best 15 pts');
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
      .querySelectorAll('#mode-picker app-segmented-control')[1]
      .querySelectorAll('button');
    difficultyButtons[2].click(); // hard
    fixture.detectChanges();

    const durationButtons = fixture.nativeElement
      .querySelectorAll('#mode-picker app-segmented-control')[2]
      .querySelectorAll('button');
    durationButtons[1].click(); // 60s
    fixture.detectChanges();

    const startButton = fixture.nativeElement.querySelector(
      '#mode-picker app-button:last-of-type button',
    );
    startButton.click();

    expect(navigateSpy).toHaveBeenCalledWith(['/play', 'timed', 'hard', '60'], {
      queryParams: {},
    });
  });

  it('navigates to an endless round with the chosen lives count once Endless is selected', () => {
    const fixture = TestBed.createComponent(Home);
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.detectChanges();

    fixture.nativeElement.querySelectorAll('app-button')[1].querySelector('button').click();
    fixture.detectChanges();

    const modeButtons = fixture.nativeElement
      .querySelectorAll('#mode-picker app-segmented-control')[0]
      .querySelectorAll('button');
    modeButtons[1].click(); // endless
    fixture.detectChanges();

    const livesButtons = fixture.nativeElement
      .querySelectorAll('#mode-picker app-segmented-control')[2]
      .querySelectorAll('button');
    livesButtons[0].click(); // 3 lives
    fixture.detectChanges();

    const startButton = fixture.nativeElement.querySelector(
      '#mode-picker app-button:last-of-type button',
    );
    startButton.click();

    expect(navigateSpy).toHaveBeenCalledWith(['/play', 'endless', 'easy', '3'], {
      queryParams: {},
    });
  });

  it('includes a pack query param when a non-default word pack is chosen', () => {
    const fixture = TestBed.createComponent(Home);
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.detectChanges();

    fixture.nativeElement.querySelectorAll('app-button')[1].querySelector('button').click();
    fixture.detectChanges();

    const packButtons = fixture.nativeElement
      .querySelectorAll('#mode-picker app-segmented-control')[3]
      .querySelectorAll('button');
    packButtons[1].click(); // first real pack after "Default"
    fixture.detectChanges();

    const startButton = fixture.nativeElement.querySelector(
      '#mode-picker app-button:last-of-type button',
    );
    startButton.click();

    expect(navigateSpy).toHaveBeenCalledWith(['/play', 'timed', 'easy', '60'], {
      queryParams: { pack: 'movies-tv' },
    });
  });

  it('navigates to help, settings, and stats', () => {
    const fixture = TestBed.createComponent(Home);
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('app-button');
    buttons[2].querySelector('button').click();
    expect(navigateSpy).toHaveBeenCalledWith(['/help']);

    buttons[3].querySelector('button').click();
    expect(navigateSpy).toHaveBeenCalledWith(['/settings']);

    buttons[4].querySelector('button').click();
    expect(navigateSpy).toHaveBeenCalledWith(['/stats']);
  });

  it("starts the daily challenge for today's UTC date", () => {
    const fixture = TestBed.createComponent(Home);
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.detectChanges();

    fixture.nativeElement.querySelector('.home__daily-cta').click();

    expect(navigateSpy).toHaveBeenCalledWith([
      '/play',
      'daily',
      fixture.componentInstance['todayUtc'],
    ]);
  });

  it('shows the challenge-link landing state instead of the standard hero when valid params are present', () => {
    const fixture = TestBed.createComponent(Home);
    fixture.componentRef.setInput('mode', 'timed');
    fixture.componentRef.setInput('difficulty', 'hard');
    fixture.componentRef.setInput('duration', '60');
    fixture.componentRef.setInput('score', '412');
    fixture.componentRef.setInput('wpm', '88');
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.home__challenge')).not.toBeNull();
    expect(el.querySelector('.home__hero')).toBeNull();
    expect(el.querySelector('.home__challenge-copy')?.textContent).toContain('412 pts');
    expect(el.querySelector('.home__challenge-copy')?.textContent).toContain('88 WPM');
  });

  it('accepting a challenge link navigates straight into that exact config', () => {
    const fixture = TestBed.createComponent(Home);
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.componentRef.setInput('mode', 'timed');
    fixture.componentRef.setInput('difficulty', 'hard');
    fixture.componentRef.setInput('duration', '60');
    fixture.componentRef.setInput('score', '412');
    fixture.componentRef.setInput('wpm', '88');
    fixture.detectChanges();

    const acceptButton = Array.from(fixture.nativeElement.querySelectorAll('app-button')).find(
      (btn) => (btn as HTMLElement).textContent?.trim() === 'Accept Challenge',
    ) as HTMLElement;
    acceptButton.querySelector('button')!.dispatchEvent(new Event('click'));

    expect(navigateSpy).toHaveBeenCalledWith(['/play', 'timed', 'hard', 60]);
  });

  it('shows the standard hero when challenge-link params are absent or invalid', () => {
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.home__hero')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.home__challenge')).toBeNull();
  });

  it('auto-types the hero preview one character at a time', async () => {
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();

    // The first character is set synchronously at construction, before any
    // timer fires - each subsequent PREVIEW_TYPE_MS tick reveals one more.
    const afterOneChar = fixture.nativeElement.querySelector('.home__preview-text')?.textContent;
    expect(afterOneChar?.length).toBe(1);

    await vi.advanceTimersByTimeAsync(90);
    fixture.detectChanges();
    const afterTwoChars = fixture.nativeElement.querySelector('.home__preview-text')?.textContent;
    expect(afterTwoChars?.length).toBe(2);
    expect(afterTwoChars?.startsWith(afterOneChar ?? '')).toBe(true);
  });

  it('freezes the preview on the first full word under reduced motion, without looping', async () => {
    const storage = TestBed.inject(StorageService);
    storage.updateSettings({ motion: 'reduced' });

    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();
    const initialText = fixture.nativeElement.querySelector('.home__preview-text')?.textContent;

    await vi.advanceTimersByTimeAsync(5_000);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.home__preview-text')?.textContent).toBe(
      initialText,
    );
  });

  it('marks the preview as decorative and keeps the same copy available to screen readers', () => {
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.home__preview')?.getAttribute('aria-hidden')).toBe('true');
    expect(el.querySelector('.sr-only')?.textContent).toContain('Type fast');
  });
});
