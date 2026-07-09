import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { Difficulty } from '../../core/models/difficulty';
import { StorageService } from '../../core/services/storage.service';
import { WordSourceService } from '../../core/services/word-source.service';
import { Game } from './game';

class FakeWordSource {
  async getWords(difficulty: Difficulty): Promise<readonly string[]> {
    return difficulty === 'easy' ? ['cat', 'dog'] : [];
  }
}

class FakeWordSourceFourWords {
  async getWords(difficulty: Difficulty): Promise<readonly string[]> {
    return difficulty === 'easy' ? ['cat', 'dog', 'sun', 'run'] : [];
  }
}

describe('Game', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: WordSourceService, useClass: FakeWordSource }],
    });

    // jsdom doesn't implement <dialog>'s showModal()/close() - polyfill with
    // the same real-browser semantics (toggling the `open` attribute) the
    // Dialog component's own spec uses.
    if (!HTMLDialogElement.prototype.showModal) {
      HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement): void {
        this.setAttribute('open', '');
      };
    }
    if (!HTMLDialogElement.prototype.close) {
      HTMLDialogElement.prototype.close = function (this: HTMLDialogElement): void {
        this.removeAttribute('open');
        this.dispatchEvent(new Event('close'));
      };
    }
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function createGame(duration = '30') {
    const fixture = TestBed.createComponent(Game);
    fixture.componentRef.setInput('mode', 'timed');
    fixture.componentRef.setInput('difficulty', 'easy');
    fixture.componentRef.setInput('duration', duration);
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
    return fixture;
  }

  it('loads words and transitions from loading to playing', async () => {
    const fixture = await createGame();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.game__loading')).toBeNull();
    expect(el.querySelector('.game__word')).not.toBeNull();
    expect(el.querySelector('.game__input')).not.toBeNull();
  });

  it('an incorrect submission does not advance the word or the score', async () => {
    const fixture = await createGame();
    const el = fixture.nativeElement as HTMLElement;
    const wordBefore = el.querySelector('.game__word')?.textContent?.trim();
    const input = el.querySelector('.game__input') as HTMLInputElement;

    input.value = 'zzz-not-a-word';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    fixture.detectChanges();

    expect(el.querySelector('.game__word')?.textContent?.trim()).toBe(wordBefore);
    expect(el.querySelector('.app-stat-badge__value')?.textContent?.trim()).toBe('0');
  });

  it('clears the input after an incorrect submission, identically to a correct one', async () => {
    const fixture = await createGame();
    const el = fixture.nativeElement as HTMLElement;
    const input = el.querySelector('.game__input') as HTMLInputElement;

    input.value = 'zzz-not-a-word';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    fixture.detectChanges();

    expect(input.value).toBe('');

    // A second wrong attempt right after, with no manual clear in between.
    input.value = 'still-wrong';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    fixture.detectChanges();

    expect(input.value).toBe('');
  });

  it('shows a near-miss (not full-incorrect) treatment for a single-character typo', async () => {
    const fixture = await createGame();
    const el = fixture.nativeElement as HTMLElement;
    const word = el.querySelector('.game__word')?.textContent?.trim() ?? '';
    const input = el.querySelector('.game__input') as HTMLInputElement;

    input.value = `${word.slice(0, -1)}x`; // one character off
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    fixture.detectChanges();

    expect(el.querySelector('.game__word--near')).not.toBeNull();
    expect(el.querySelector('.game__word--incorrect')).toBeNull();
  });

  it('a correct submission clears the input, advances, and scores', async () => {
    const fixture = await createGame();
    const el = fixture.nativeElement as HTMLElement;
    const word = el.querySelector('.game__word')?.textContent?.trim() ?? '';
    const input = el.querySelector('.game__input') as HTMLInputElement;

    input.value = word;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    fixture.detectChanges();

    expect(input.value).toBe('');
    const scoreBadge = el.querySelectorAll('.app-stat-badge__value')[0];
    expect(scoreBadge.textContent?.trim()).toBe('1');
  });

  it('navigates to /results with the round result once every word is typed', async () => {
    const fixture = await createGame();
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    for (let i = 0; i < 2; i++) {
      const el = fixture.nativeElement as HTMLElement;
      const word = el.querySelector('.game__word')?.textContent?.trim() ?? '';
      const input = el.querySelector('.game__input') as HTMLInputElement;
      input.value = word;
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      fixture.detectChanges();
    }

    expect(navigateSpy).toHaveBeenCalledWith(
      ['/results'],
      expect.objectContaining({
        state: expect.objectContaining({
          result: expect.objectContaining({ wordsCorrect: 2 }),
        }),
      }),
    );
  });

  it('live WPM converges to the Results-screen value at round end', async () => {
    const fixture = await createGame('30');
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    for (let i = 0; i < 2; i++) {
      const el = fixture.nativeElement as HTMLElement;
      const word = el.querySelector('.game__word')?.textContent?.trim() ?? '';
      const input = el.querySelector('.game__input') as HTMLInputElement;
      await vi.advanceTimersByTimeAsync(1_000);
      input.value = word;
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      fixture.detectChanges();
    }

    const finalLiveWpm = fixture.componentInstance['liveWpm']();
    const resultWpm = (navigateSpy.mock.calls[0][1] as { state: { result: { wpm: number } } }).state
      .result.wpm;
    expect(finalLiveWpm).toBe(resultWpm);
  });

  it('ends the round and navigates when the timer runs out', async () => {
    const fixture = await createGame('30');
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    await vi.advanceTimersByTimeAsync(31_000);
    fixture.detectChanges();

    expect(navigateSpy).toHaveBeenCalledWith(
      ['/results'],
      expect.objectContaining({ state: expect.anything() }),
    );
  });

  it('opens the exit-confirm dialog from the corner button', async () => {
    const fixture = await createGame();
    const el = fixture.nativeElement as HTMLElement;

    el.querySelector<HTMLButtonElement>('.game__exit')!.click();
    fixture.detectChanges();

    expect(el.querySelector('dialog')?.hasAttribute('open')).toBe(true);
  });

  it('opens the exit-confirm dialog on Escape while playing', async () => {
    const fixture = await createGame();
    const el = fixture.nativeElement as HTMLElement;

    el.querySelector('.game__input')!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    fixture.detectChanges();

    expect(el.querySelector('dialog')?.hasAttribute('open')).toBe(true);
  });

  it('pauses the countdown while the exit-confirm dialog is open', async () => {
    const fixture = await createGame('30');
    const el = fixture.nativeElement as HTMLElement;

    el.querySelector<HTMLButtonElement>('.game__exit')!.click();
    fixture.detectChanges();

    await vi.advanceTimersByTimeAsync(10_000);
    fixture.detectChanges();
    const remainingWhilePaused = fixture.componentInstance['remainingSeconds']();

    await vi.advanceTimersByTimeAsync(10_000);
    fixture.detectChanges();

    expect(fixture.componentInstance['remainingSeconds']()).toBe(remainingWhilePaused);
  });

  it('"Keep playing" resumes without saving or discarding', async () => {
    const fixture = await createGame();
    const el = fixture.nativeElement as HTMLElement;
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    el.querySelector<HTMLButtonElement>('.game__exit')!.click();
    fixture.detectChanges();

    const keepPlayingButton = Array.from(el.querySelectorAll('app-button button')).find(
      (b) => b.textContent?.trim() === 'Keep playing',
    ) as HTMLButtonElement;
    keepPlayingButton.click();
    fixture.detectChanges();

    expect(el.querySelector('dialog')?.hasAttribute('open')).toBe(false);
    expect(navigateSpy).not.toHaveBeenCalled();
    expect(fixture.componentInstance['phase']()).toBe('playing');
  });

  it('"Discard & exit" leaves without recording a result', async () => {
    const fixture = await createGame();
    const el = fixture.nativeElement as HTMLElement;
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    // Score a word first so there'd be something to lose by discarding.
    const word = el.querySelector('.game__word')?.textContent?.trim() ?? '';
    const input = el.querySelector('.game__input') as HTMLInputElement;
    input.value = word;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    fixture.detectChanges();

    el.querySelector<HTMLButtonElement>('.game__exit')!.click();
    fixture.detectChanges();
    const discardButton = Array.from(el.querySelectorAll('app-button button')).find(
      (b) => b.textContent?.trim() === 'Discard & exit',
    ) as HTMLButtonElement;
    discardButton.click();
    fixture.detectChanges();

    expect(navigateSpy).toHaveBeenCalledWith(['/']);
    const storage = TestBed.inject(StorageService);
    expect(storage.stats().roundsPlayed).toBe(0);
  });

  it('"Save score & exit" records the partial result and goes to Results', async () => {
    const fixture = await createGame();
    const el = fixture.nativeElement as HTMLElement;
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    const word = el.querySelector('.game__word')?.textContent?.trim() ?? '';
    const input = el.querySelector('.game__input') as HTMLInputElement;
    input.value = word;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    fixture.detectChanges();

    el.querySelector<HTMLButtonElement>('.game__exit')!.click();
    fixture.detectChanges();
    const saveButton = Array.from(el.querySelectorAll('app-button button')).find(
      (b) => b.textContent?.trim() === 'Save score & exit',
    ) as HTMLButtonElement;
    saveButton.click();
    fixture.detectChanges();

    expect(navigateSpy).toHaveBeenCalledWith(
      ['/results'],
      expect.objectContaining({
        state: expect.objectContaining({ result: expect.objectContaining({ wordsCorrect: 1 }) }),
      }),
    );
    const storage = TestBed.inject(StorageService);
    expect(storage.stats().roundsPlayed).toBe(1);
  });
});

describe('Game — word look-ahead queue', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: WordSourceService, useClass: FakeWordSourceFourWords },
      ],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function createGame() {
    const fixture = TestBed.createComponent(Game);
    fixture.componentRef.setInput('mode', 'timed');
    fixture.componentRef.setInput('difficulty', 'easy');
    fixture.componentRef.setInput('duration', '30');
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
    return fixture;
  }

  it('renders the next two upcoming words, visually distinct from the current one', async () => {
    const fixture = await createGame();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.game__word')).not.toBeNull();
    expect(el.querySelector('.game__word-slot--next')).not.toBeNull();
    expect(el.querySelector('.game__word-slot--next2')).not.toBeNull();
  });

  it('shifts the queue by one slot after each correct submission', async () => {
    const fixture = await createGame();
    const el = fixture.nativeElement as HTMLElement;
    const input = el.querySelector('.game__input') as HTMLInputElement;

    const wordBefore = el.querySelector('.game__word')?.textContent?.trim();
    const nextBefore = el.querySelector('.game__word-slot--next')?.textContent?.trim();
    const next2Before = el.querySelector('.game__word-slot--next2')?.textContent?.trim();

    input.value = wordBefore ?? '';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    fixture.detectChanges();

    expect(el.querySelector('.game__word')?.textContent?.trim()).toBe(nextBefore);
    expect(el.querySelector('.game__word-slot--next')?.textContent?.trim()).toBe(next2Before);
  });
});

describe('Game — Endless/Survival mode', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: WordSourceService, useClass: FakeWordSource }],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function createEndlessGame(lives = '2') {
    const fixture = TestBed.createComponent(Game);
    fixture.componentRef.setInput('mode', 'endless');
    fixture.componentRef.setInput('difficulty', 'easy');
    fixture.componentRef.setInput('duration', lives); // reused as mistakes-allowed
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
    return fixture;
  }

  it('shows a lives-remaining dot row instead of the TimerRing', async () => {
    const fixture = await createEndlessGame();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('app-timer-ring')).toBeNull();
    expect(el.querySelectorAll('.game__life-dot')).toHaveLength(2);
    expect(el.querySelectorAll('.game__life-dot--spent')).toHaveLength(0);
  });

  it('marks a life spent on each mistake and ends the round on the last one', async () => {
    const fixture = await createEndlessGame('2');
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const el = fixture.nativeElement as HTMLElement;
    const input = el.querySelector('.game__input') as HTMLInputElement;

    input.value = 'zzz-wrong';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    fixture.detectChanges();
    expect(el.querySelectorAll('.game__life-dot--spent')).toHaveLength(1);
    expect(navigateSpy).not.toHaveBeenCalled();

    input.value = 'zzz-wrong-again';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    fixture.detectChanges();

    expect(navigateSpy).toHaveBeenCalledWith(['/results'], expect.objectContaining({}));
  });

  it('does not end the round from the clock - only mistakes/exhaustion matter', async () => {
    const fixture = await createEndlessGame('2');
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    await vi.advanceTimersByTimeAsync(120_000);
    fixture.detectChanges();

    expect(navigateSpy).not.toHaveBeenCalled();
  });
});
