import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';

import { DailyChallenge } from '../models/daily-challenge';
import { GameResult } from '../models/game-result';

export interface ShareCardInput {
  readonly result: GameResult;
  readonly dailyChallenge: DailyChallenge | null;
}

const CARD_WIDTH = 1200;
const CARD_HEIGHT = 630;
/** Bestreak dots cap at the x2 multiplier threshold - enough visual texture
 *  to be recognizable at a glance, not a full chart (DESIGN §Share card). */
const MAX_STREAK_DOTS = 10;

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Client-side <canvas> rasterization of a shareable result PNG - no
 * server-side rendering, no third-party image API (ARCHITECTURE.md: the
 * rejection is of a *service* dependency, not of client-side canvas use).
 * Reads the current theme's design tokens so the card matches whatever the
 * player is actually looking at.
 */
@Injectable({ providedIn: 'root' })
export class ShareCardService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  async generate(input: ShareCardInput): Promise<Blob | null> {
    if (!this.isBrowser) return null;

    try {
      await document.fonts?.ready;
    } catch {
      // Font-loading readiness is a nicety, not a requirement - paint anyway.
    }

    const canvas = document.createElement('canvas');
    canvas.width = CARD_WIDTH;
    canvas.height = CARD_HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    this.paint(ctx, input);

    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/png');
    });
  }

  private paint(ctx: CanvasRenderingContext2D, { result, dailyChallenge }: ShareCardInput): void {
    const root = document.documentElement;
    const styles = getComputedStyle(root);
    const token = (name: string, fallback: string): string =>
      styles.getPropertyValue(name).trim() || fallback;

    const isDark =
      root.getAttribute('data-theme') === 'dark' ||
      (root.getAttribute('data-theme') !== 'light' &&
        window.matchMedia?.('(prefers-color-scheme: dark)').matches);

    const surface = token('--color-surface', isDark ? '#1e2230' : '#ffffff');
    const border = token('--color-border', isDark ? '#3a3f52' : '#e2e4ea');
    const accent = token('--color-accent', '#2a3f9d');
    const textColor = token('--color-text', isDark ? '#f5f6fa' : '#1a1c26');
    const textMuted = token('--color-text-muted', '#6b6f80');
    const energy = token('--color-energy', '#b5540f');

    ctx.fillStyle = surface;
    ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
    this.paintTexture(ctx, border, isDark);

    ctx.textBaseline = 'alphabetic';

    ctx.fillStyle = accent;
    ctx.font = '700 128px "JetBrains Mono Variable", "JetBrains Mono", monospace';
    ctx.fillText(`${result.totalScore} pts`, 72, 240);

    ctx.fillStyle = textColor;
    ctx.font = '600 52px "JetBrains Mono Variable", "JetBrains Mono", monospace';
    const accuracyPercent = Math.round(result.accuracy * 100);
    ctx.fillText(`${result.wpm} WPM  ·  ${accuracyPercent}% accuracy`, 72, 312);

    ctx.fillStyle = textMuted;
    ctx.font = '500 36px "Inter Variable", "Inter", system-ui, sans-serif';
    const secondary = dailyChallenge
      ? `Typester Daily #${dailyChallenge.dayNumber}`
      : `${capitalize(result.config.mode)} · ${capitalize(String(result.config.difficulty))} · ${result.config.durationSeconds}s`;
    ctx.fillText(secondary, 72, 366);

    this.paintStreakDots(ctx, result.bestStreak, energy, border, 72, 440);

    // Wordmark, bottom-right corner - the one existing piece of custom
    // identity, reused here per DESIGN §Share card.
    ctx.fillStyle = textColor;
    ctx.font = '700 40px "JetBrains Mono Variable", "JetBrains Mono", monospace';
    const wordmark = 'T';
    const wordmarkWidth = ctx.measureText(wordmark).width;
    const caretX = CARD_WIDTH - 72 - 14;
    ctx.fillText(wordmark, caretX - wordmarkWidth - 6, CARD_HEIGHT - 64);
    ctx.fillStyle = accent;
    ctx.fillRect(caretX, CARD_HEIGHT - 64 - 30, 12, 34);
  }

  private paintTexture(ctx: CanvasRenderingContext2D, border: string, isDark: boolean): void {
    ctx.save();
    ctx.strokeStyle = border;
    ctx.fillStyle = border;
    ctx.globalAlpha = isDark ? 0.35 : 0.5;

    if (isDark) {
      // Faint horizontal scanlines - matches the dark-theme background
      // texture used app-wide (DESIGN §Dark mode personality).
      for (let y = 0; y < CARD_HEIGHT; y += 4) {
        ctx.fillRect(0, y, CARD_WIDTH, 1);
      }
    } else {
      // Faint dot grid - matches the light-theme background texture.
      for (let y = 12; y < CARD_HEIGHT; y += 24) {
        for (let x = 12; x < CARD_WIDTH; x += 24) {
          ctx.beginPath();
          ctx.arc(x, y, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  private paintStreakDots(
    ctx: CanvasRenderingContext2D,
    bestStreak: number,
    energy: string,
    border: string,
    x: number,
    y: number,
  ): void {
    const filled = Math.max(0, Math.min(MAX_STREAK_DOTS, bestStreak));
    const radius = 12;
    const gap = 32;

    for (let i = 0; i < MAX_STREAK_DOTS; i++) {
      ctx.beginPath();
      ctx.arc(x + i * gap, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = i < filled ? energy : border;
      ctx.fill();
    }
  }
}
