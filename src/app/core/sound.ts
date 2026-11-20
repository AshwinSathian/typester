import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID, Service, inject } from '@angular/core';

import { Store } from './store';

/** C major pentatonic across two octaves. Any run of these sounds fine,
 *  which is what lets every keystroke be a note. */
const SCALE = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0];

interface Note {
  readonly freq: number;
  readonly at?: number;
  readonly length: number;
  readonly type?: OscillatorType;
  readonly gain?: number;
  readonly slideTo?: number;
}

/**
 * Typing plays a tune: each correct letter is the next note of a
 * pentatonic scale, pitched up as the multiplier climbs. Everything is
 * synthesized with Web Audio, so no audio files ship. Silent when sound
 * is off or the tab is hidden, and it never throws into gameplay.
 */
@Service()
export class Sound {
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly store = inject(Store);
  private ctx: AudioContext | null = null;

  /** `step` walks the scale; `multiplier` (1-5) lifts it. */
  hit(step: number, multiplier: number): void {
    const freq = SCALE[step % SCALE.length] * (multiplier >= 3 ? 2 : 1);
    this.play([{ freq, length: 0.07, type: 'triangle', gain: 0.07 }]);
  }

  word(multiplier: number, gold: boolean): void {
    const root = SCALE[multiplier % 5] * 2;
    this.play([
      { freq: root, length: 0.12, gain: 0.05 },
      { freq: root * 1.5, length: 0.12, gain: 0.04 },
      ...(gold ? [{ freq: root * 2, at: 0.05, length: 0.18, gain: 0.05 }] : []),
    ]);
  }

  miss(): void {
    this.play([{ freq: 140, slideTo: 90, length: 0.09, type: 'square', gain: 0.05 }]);
  }

  multiplierUp(multiplier: number): void {
    this.play(
      [0, 2, 4, 5].map((n, i) => ({
        freq: SCALE[(n + multiplier) % SCALE.length] * 2,
        at: i * 0.045,
        length: 0.08,
        gain: 0.05,
      })),
    );
  }

  levelUp(): void {
    this.play([{ freq: 392, slideTo: 1046, length: 0.25, type: 'sine', gain: 0.05 }]);
  }

  over(): void {
    this.play(
      [659.25, 523.25, 392, 261.63].map((freq, i) => ({ freq, at: i * 0.09, length: 0.16 })),
    );
  }

  private play(notes: readonly Note[]): void {
    if (!this.browser || !this.store.settings().sound || document.hidden) return;
    try {
      const ctx = (this.ctx ??= new AudioContext());
      if (ctx.state === 'suspended') void ctx.resume();
      for (const note of notes) {
        const start = ctx.currentTime + (note.at ?? 0);
        const end = start + note.length;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = note.type ?? 'sine';
        osc.frequency.setValueAtTime(note.freq, start);
        if (note.slideTo) osc.frequency.exponentialRampToValueAtTime(note.slideTo, end);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(note.gain ?? 0.06, start + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.0001, end);
        osc.connect(gain).connect(ctx.destination);
        osc.start(start);
        osc.stop(end + 0.02);
      }
    } catch {
      // No Web Audio, or the browser refused: play on in silence.
    }
  }
}
