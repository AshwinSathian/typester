import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';

import { StorageService } from './storage.service';

export type SoundCue = 'correct' | 'incorrect' | 'combo' | 'timeUp';

interface ToneSpec {
  readonly type: OscillatorType;
  readonly startFreq: number;
  readonly endFreq: number;
  readonly startTime: number;
  readonly duration: number;
  readonly gain?: number;
}

/** Some browsers still only expose the prefixed constructor. */
interface WebkitWindow {
  webkitAudioContext?: typeof AudioContext;
}

/**
 * Every cue is synthesized via the Web Audio API - no shipped audio assets
 * (see ARCHITECTURE.md §D7). Respects the soundEnabled setting, is silent
 * while the tab is backgrounded (Page Visibility API), and never throws -
 * neither AudioContext availability nor synthesis failures should ever be
 * able to interrupt gameplay.
 */
@Injectable({ providedIn: 'root' })
export class SoundService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly storage = inject(StorageService);
  private audioContext: AudioContext | null = null;

  play(cue: SoundCue): void {
    if (!this.isBrowser || !this.storage.settings().soundEnabled) return;
    if (typeof document !== 'undefined' && document.hidden) return;

    const ctx = this.getContext();
    if (!ctx) return;

    try {
      for (const tone of this.tonesFor(cue)) {
        this.playTone(ctx, tone);
      }
    } catch {
      // Synthesis failures must never break gameplay.
    }
  }

  private tonesFor(cue: SoundCue): readonly ToneSpec[] {
    switch (cue) {
      case 'correct':
        return [{ type: 'sine', startFreq: 660, endFreq: 880, startTime: 0, duration: 0.08 }];
      case 'incorrect':
        return [
          { type: 'square', startFreq: 180, endFreq: 180, startTime: 0, duration: 0.1, gain: 0.15 },
        ];
      case 'combo':
        return [660, 880, 1100].map((freq, i) => ({
          type: 'sine' as const,
          startFreq: freq,
          endFreq: freq,
          startTime: i * 0.04,
          duration: 0.04,
        }));
      case 'timeUp':
        return [
          { type: 'sine', startFreq: 440, endFreq: 220, startTime: 0, duration: 0.3, gain: 0.18 },
        ];
    }
  }

  private playTone(ctx: AudioContext, tone: ToneSpec): void {
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    const startAt = ctx.currentTime + tone.startTime;
    const endAt = startAt + tone.duration;

    oscillator.type = tone.type;
    oscillator.frequency.setValueAtTime(tone.startFreq, startAt);
    if (tone.endFreq !== tone.startFreq) {
      oscillator.frequency.exponentialRampToValueAtTime(tone.endFreq, endAt);
    }

    gainNode.gain.setValueAtTime(tone.gain ?? 0.2, startAt);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, endAt);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.start(startAt);
    oscillator.stop(endAt + 0.02);
  }

  private getContext(): AudioContext | null {
    if (this.audioContext) return this.audioContext;

    const ctor =
      typeof window === 'undefined'
        ? undefined
        : (window.AudioContext ?? (window as unknown as WebkitWindow).webkitAudioContext);
    if (!ctor) return null;

    try {
      this.audioContext = new ctor();
      return this.audioContext;
    } catch {
      return null;
    }
  }
}
