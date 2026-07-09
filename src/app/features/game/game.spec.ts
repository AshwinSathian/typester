import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { Difficulty } from '../../core/models/difficulty';
import { WordSourceService } from '../../core/services/word-source.service';
import { Game } from './game';

class FakeWordSource {
  async getWords(difficulty: Difficulty): Promise<readonly string[]> {
    return difficulty === 'easy' ? ['cat', 'dog'] : [];
  }
}

describe('Game', () => {
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
});
