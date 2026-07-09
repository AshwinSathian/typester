import { Injectable } from '@angular/core';

export type ShareOutcome = 'shared' | 'copied' | 'failed';

/**
 * Web Share API where available, clipboard-copy fallback otherwise - no
 * image generation, no third-party share/image-rendering service
 * (PLAN-typester.md §Open Questions - resolved: share feature).
 */
@Injectable({ providedIn: 'root' })
export class ShareService {
  async share(text: string): Promise<ShareOutcome> {
    if (typeof navigator === 'undefined') return 'failed';

    if (navigator.share) {
      try {
        await navigator.share({ text });
        return 'shared';
      } catch {
        // User cancelled, or the platform rejected the share - try clipboard.
      }
    }

    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return 'copied';
      } catch {
        return 'failed';
      }
    }

    return 'failed';
  }
}
