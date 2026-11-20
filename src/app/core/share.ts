import { DOCUMENT } from '@angular/common';
import { Service, inject } from '@angular/core';

import { ModeId, Summary } from './engine';

export type Shared = 'shared' | 'copied' | 'cancelled' | 'failed';

export interface ShareInput {
  readonly mode: ModeId;
  readonly title: string;
  readonly run: Summary;
}

const W = 1200;
const H = 630;

/** Link that opens Typester with your score as the one to beat. The Daily
 *  needs no score in the link: everyone plays the same words anyway. */
export function challengeUrl(origin: string, mode: ModeId, score: number): string {
  return mode === 'daily' ? `${origin}/play/daily` : `${origin}/?mode=${mode}&vs=${score}`;
}

/**
 * Shares a result as an image card plus a link, falling back to text, then
 * to the clipboard. The card is drawn on a canvas in the browser: no server
 * renders anything.
 */
@Service()
export class Share {
  private readonly document = inject(DOCUMENT);

  async share(input: ShareInput): Promise<Shared> {
    const nav = this.document.defaultView?.navigator;
    const url = challengeUrl(this.document.location.origin, input.mode, input.run.score);
    const text = `${input.run.score.toLocaleString('en')} in ${input.title}, ${input.run.wpm} WPM. Beat it:`;

    try {
      const blob = await this.card(input);
      const files = blob ? [new File([blob], 'typester.png', { type: 'image/png' })] : [];
      if (nav?.share) {
        const withFiles = files.length > 0 && nav.canShare?.({ files });
        await nav.share(withFiles ? { text, url, files } : { text, url });
        return 'shared';
      }
    } catch (error) {
      // The person closed the share sheet: that's an answer, not an error.
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
    }
    try {
      await nav?.clipboard.writeText(`${text} ${url}`);
      return 'copied';
    } catch {
      return 'failed';
    }
  }

  private async card({ title, run }: ShareInput): Promise<Blob | null> {
    const canvas = this.document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const g = canvas.getContext('2d');
    if (!g) return null;
    await this.document.fonts?.ready;

    const css = getComputedStyle(this.document.documentElement);
    const color = (name: string) => css.getPropertyValue(name).trim() || '#000';
    const font = (weight: number, size: number) =>
      `${weight} ${size}px "Recursive Variable", system-ui, sans-serif`;

    g.fillStyle = color('--bg');
    g.fillRect(0, 0, W, H);

    // Word pace, as a filled ridge along the bottom.
    const times = run.wordTimes;
    if (times.length > 2) {
      const end = times[times.length - 1] || 1;
      g.beginPath();
      g.moveTo(0, H);
      times.forEach((t, i) => g.lineTo((t / end) * W, H - 40 - (i / times.length) * 220));
      g.lineTo(W, H);
      g.closePath();
      g.fillStyle = color('--key-side');
      g.fill();
    }

    g.fillStyle = color('--ink-soft');
    g.font = font(600, 40);
    g.fillText(title, 80, 120);

    g.fillStyle = color('--ink');
    g.font = font(900, 200);
    g.fillText(run.score.toLocaleString('en'), 72, 320);

    g.fillStyle = color('--ink-soft');
    g.font = font(600, 44);
    g.fillText(`${run.wpm} WPM   ${run.accuracy}% accuracy   level ${run.level}`, 80, 400);

    g.fillStyle = color('--accent');
    g.font = font(800, 36);
    g.fillText('typester', W - 80 - g.measureText('typester').width, 120);

    return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  }
}
