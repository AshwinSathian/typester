import { TestBed } from '@angular/core/testing';

import { StorageService } from './storage.service';
import { SoundService } from './sound.service';

class MockAudioParam {
  setValueAtTime = vi.fn();
  exponentialRampToValueAtTime = vi.fn();
}

class MockOscillator {
  type = 'sine';
  frequency = new MockAudioParam();
  connect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
}

class MockGain {
  gain = new MockAudioParam();
  connect = vi.fn();
}

class MockAudioContext {
  static instances: MockAudioContext[] = [];
  currentTime = 0;
  destination = {};
  oscillators: MockOscillator[] = [];

  constructor() {
    MockAudioContext.instances.push(this);
  }

  createOscillator(): MockOscillator {
    const osc = new MockOscillator();
    this.oscillators.push(osc);
    return osc;
  }

  createGain(): MockGain {
    return new MockGain();
  }
}

describe('SoundService', () => {
  beforeEach(() => {
    window.localStorage.clear();
    MockAudioContext.instances = [];
  });

  afterEach(() => {
    delete (window as unknown as { AudioContext?: unknown }).AudioContext;
  });

  it('never throws when AudioContext is unavailable (the real jsdom test environment)', () => {
    expect(typeof (window as unknown as { AudioContext?: unknown }).AudioContext).toBe('undefined');
    const service = TestBed.inject(SoundService);
    expect(() => service.play('correct')).not.toThrow();
  });

  it('synthesizes an oscillator per tone when sound is enabled and AudioContext exists', () => {
    (window as unknown as { AudioContext: unknown }).AudioContext = MockAudioContext;
    const service = TestBed.inject(SoundService);

    service.play('correct');
    expect(MockAudioContext.instances).toHaveLength(1);
    expect(MockAudioContext.instances[0].oscillators).toHaveLength(1);

    service.play('combo');
    expect(MockAudioContext.instances[0].oscillators).toHaveLength(4); // 1 correct + 3 combo notes
  });

  it('does not synthesize anything when the sound setting is disabled', () => {
    (window as unknown as { AudioContext: unknown }).AudioContext = MockAudioContext;
    const storage = TestBed.inject(StorageService);
    storage.updateSettings({ soundEnabled: false });

    const service = TestBed.inject(SoundService);
    service.play('correct');
    expect(MockAudioContext.instances).toHaveLength(0);
  });

  it('does not synthesize anything while the tab is hidden', () => {
    (window as unknown as { AudioContext: unknown }).AudioContext = MockAudioContext;
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);

    const service = TestBed.inject(SoundService);
    service.play('correct');
    expect(MockAudioContext.instances).toHaveLength(0);
  });
});
