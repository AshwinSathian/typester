import { TestBed } from '@angular/core/testing';

import { Summary } from './engine';
import { DEFAULT_DATA, Store, liveStreak, nextStreak } from './store';

const run = (over: Partial<Summary> = {}): Summary => ({
  score: 500,
  wpm: 60,
  accuracy: 95,
  level: 3,
  words: 20,
  bestCombo: 40,
  durationMs: 30_000,
  wordTimes: [1_000, 2_000],
  hits: { a: 10 },
  misses: { a: 1, q: 2 },
  ...over,
});

describe('Store', () => {
  beforeEach(() => localStorage.clear());

  const store = () => TestBed.inject(Store);

  it('starts from defaults with nothing saved', () => {
    expect(store().data()).toEqual(DEFAULT_DATA);
  });

  it('falls back to defaults on unreadable data', () => {
    localStorage.setItem('typester', '{not json');
    expect(store().data()).toEqual(DEFAULT_DATA);
  });

  it('carries settings over from the 2.x app', () => {
    localStorage.setItem(
      'typester:v1:settings',
      JSON.stringify({ theme: 'dark', motion: 'reduced', soundEnabled: false }),
    );
    expect(store().settings()).toEqual({ theme: 'dark', motion: 'reduced', sound: false });
  });

  it('records a best only when it beats the last one', () => {
    const s = store();
    expect(s.record('rush', run(), '2026-11-20').isBest).toBe(true);
    const second = s.record('rush', run({ score: 400 }), '2026-11-20');
    expect(second).toEqual({
      isBest: false,
      previousBest: expect.objectContaining({ score: 500 }),
    });
    expect(s.data().best.rush?.wordTimes).toEqual([1_000, 2_000]);
  });

  it('keeps Daily scores per date, apart from the mode bests', () => {
    const s = store();
    s.record('daily', run(), '2026-11-20');
    expect(s.data().daily['2026-11-20'].score).toBe(500);
    expect(s.data().best.daily).toBeUndefined();
  });

  it('adds up per-key hits and misses', () => {
    const s = store();
    s.record('sprint', run(), '2026-11-20');
    s.record('sprint', run(), '2026-11-20');
    expect(s.data().keys).toEqual({ a: [20, 2], q: [0, 4] });
  });

  it('does not count a run with no words', () => {
    const s = store();
    s.record('rush', run({ words: 0, score: 0 }), '2026-11-20');
    expect(s.data().totals.runs).toBe(0);
    expect(s.data().streak.days).toBe(0);
  });

  it('persists across instances and survives a reset with settings intact', () => {
    store().updateSettings({ theme: 'dark' });
    store().record('rush', run(), '2026-11-20');
    TestBed.resetTestingModule();
    expect(store().data().best.rush?.score).toBe(500);
    store().reset();
    expect(store().data().best).toEqual({});
    expect(store().settings().theme).toBe('dark');
  });
});

describe('streaks', () => {
  const none = { days: 0, last: '', longest: 0 };

  it('grows on consecutive days and restarts after a gap', () => {
    let s = nextStreak(none, '2026-11-01');
    s = nextStreak(s, '2026-11-02');
    s = nextStreak(s, '2026-11-02');
    expect(s).toEqual({ days: 2, last: '2026-11-02', longest: 2 });
    s = nextStreak(s, '2026-11-05');
    expect(s).toEqual({ days: 1, last: '2026-11-05', longest: 2 });
  });

  it('stays alive until a whole day is missed', () => {
    const s = { days: 4, last: '2026-11-02', longest: 4 };
    expect(liveStreak(s, '2026-11-03')).toBe(4);
    expect(liveStreak(s, '2026-11-04')).toBe(0);
  });
});
