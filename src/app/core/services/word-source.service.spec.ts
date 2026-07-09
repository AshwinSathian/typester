import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { WORD_BANK } from '../../shared/data/word-bank';
import { WordSourceService } from './word-source.service';

describe('WordSourceService', () => {
  let service: WordSourceService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(WordSourceService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  function respondForEasy(wordsByLength: Record<number, string[]>): void {
    for (const length of [3, 4, 5]) {
      const req = httpMock.expectOne(
        (r) => new URL(r.urlWithParams).searchParams.get('sp') === '?'.repeat(length),
      );
      req.flush((wordsByLength[length] ?? []).map((word) => ({ word })));
    }
  }

  it('merges and dedupes a successful multi-length fetch into the difficulty length band', async () => {
    const promise = service.getWords('easy');
    respondForEasy({
      3: ['cat', 'dog', 'sun', 'run', 'top', 'hat', 'red'],
      4: ['blue', 'fast', 'jump', 'pink', 'gold', 'rain', 'wind'],
      5: ['apple', 'grape', 'crane', 'stone', 'quiet', 'plant', 'brave'],
    });

    const words = await promise;
    expect(words.length).toBe(21);
    expect(new Set(words).size).toBe(words.length);
    expect(words.every((w) => w.length >= 3 && w.length <= 5)).toBe(true);
  });

  it('falls back to the curated word bank when the live result is too thin', async () => {
    const promise = service.getWords('easy');
    respondForEasy({ 3: ['cat'], 4: [], 5: [] });

    const words = await promise;
    expect(words).toEqual(WORD_BANK.easy);
  });

  it('falls back to the curated word bank on a malformed API response', async () => {
    const promise = service.getWords('easy');
    for (const length of [3, 4, 5]) {
      const req = httpMock.expectOne(
        (r) => new URL(r.urlWithParams).searchParams.get('sp') === '?'.repeat(length),
      );
      req.flush({ not: 'an array' });
    }

    const words = await promise;
    expect(words).toEqual(WORD_BANK.easy);
  });

  it('falls back to the curated word bank on a network error', async () => {
    const promise = service.getWords('easy');
    for (const length of [3, 4, 5]) {
      const req = httpMock.expectOne(
        (r) => new URL(r.urlWithParams).searchParams.get('sp') === '?'.repeat(length),
      );
      req.error(new ProgressEvent('network error'));
    }

    const words = await promise;
    expect(words).toEqual(WORD_BANK.easy);
  });

  it('falls back to the curated word bank when a request hangs past the fetch timeout', async () => {
    vi.useFakeTimers();
    try {
      const promise = service.getWords('easy');
      // Never flush any of the 3 requests - they hang until the timeout fires.
      const advance = vi.advanceTimersByTimeAsync(3_000);
      const [words] = await Promise.all([promise, advance]);
      expect(words).toEqual(WORD_BANK.easy);

      for (const length of [3, 4, 5]) {
        const req = httpMock.expectOne(
          (r) => new URL(r.urlWithParams).searchParams.get('sp') === '?'.repeat(length),
        );
        expect(req.cancelled).toBe(true);
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it('queries one request per word length across the tier band (7 for hard: 9-15)', async () => {
    const promise = service.getWords('hard');
    for (let length = 9; length <= 15; length++) {
      const req = httpMock.expectOne(
        (r) => new URL(r.urlWithParams).searchParams.get('sp') === '?'.repeat(length),
      );
      req.flush([]);
    }
    await promise;
  });
});
