import { TestBed } from '@angular/core/testing';

import { ShareService } from './share.service';

describe('ShareService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses navigator.share when available', async () => {
    const shareFn = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, share: shareFn });

    const service = TestBed.inject(ShareService);
    const outcome = await service.share('hello');

    expect(shareFn).toHaveBeenCalledWith({ text: 'hello' });
    expect(outcome).toBe('shared');
  });

  it('falls back to clipboard when navigator.share is unavailable', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', {
      ...navigator,
      share: undefined,
      clipboard: { writeText },
    });

    const service = TestBed.inject(ShareService);
    const outcome = await service.share('hello');

    expect(writeText).toHaveBeenCalledWith('hello');
    expect(outcome).toBe('copied');
  });

  it('falls back to clipboard when navigator.share rejects (e.g. user cancels)', async () => {
    const shareFn = vi.fn().mockRejectedValue(new Error('cancelled'));
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, share: shareFn, clipboard: { writeText } });

    const service = TestBed.inject(ShareService);
    const outcome = await service.share('hello');

    expect(outcome).toBe('copied');
  });

  it('reports failed when neither API is available', async () => {
    vi.stubGlobal('navigator', { ...navigator, share: undefined, clipboard: undefined });

    const service = TestBed.inject(ShareService);
    const outcome = await service.share('hello');

    expect(outcome).toBe('failed');
  });
});
