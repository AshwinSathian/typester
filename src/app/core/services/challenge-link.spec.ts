import { GameConfig } from '../models/game-config';
import { decodeChallengeLinkParams, encodeChallengeLinkParams } from './challenge-link';

describe('encodeChallengeLinkParams / decodeChallengeLinkParams', () => {
  it('round-trips a timed config with score and WPM', () => {
    const config: GameConfig = { mode: 'timed', difficulty: 'hard', durationSeconds: 60 };
    const params = encodeChallengeLinkParams(config, 412, 88);
    const decoded = decodeChallengeLinkParams(params);

    expect(decoded).toEqual({ config, score: 412, wpm: 88 });
  });

  it('round-trips a quick-play config', () => {
    const config: GameConfig = { mode: 'quick', difficulty: 'mixed', durationSeconds: 90 };
    const decoded = decodeChallengeLinkParams(encodeChallengeLinkParams(config, 100, 50));
    expect(decoded?.config).toEqual(config);
  });

  it('rounds fractional score/wpm to whole numbers when encoding', () => {
    const config: GameConfig = { mode: 'timed', difficulty: 'easy', durationSeconds: 30 };
    const params = encodeChallengeLinkParams(config, 10.6, 42.4);
    expect(params['score']).toBe('11');
    expect(params['wpm']).toBe('42');
  });

  it('returns null when any field is missing', () => {
    expect(
      decodeChallengeLinkParams({ mode: 'timed', difficulty: 'easy', duration: '30' }),
    ).toBeNull();
  });

  it('returns null for an invalid game config', () => {
    expect(
      decodeChallengeLinkParams({
        mode: 'timed',
        difficulty: 'bogus',
        duration: '30',
        score: '10',
        wpm: '20',
      }),
    ).toBeNull();
  });

  it('returns null for a negative or non-numeric score/wpm', () => {
    expect(
      decodeChallengeLinkParams({
        mode: 'timed',
        difficulty: 'easy',
        duration: '30',
        score: '-5',
        wpm: '20',
      }),
    ).toBeNull();
    expect(
      decodeChallengeLinkParams({
        mode: 'timed',
        difficulty: 'easy',
        duration: '30',
        score: 'nope',
        wpm: '20',
      }),
    ).toBeNull();
  });
});
