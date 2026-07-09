import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // Gameplay is entirely client-driven (route params + router state) and
  // has zero crawlable content of its own - prerendering would only ever
  // produce an empty shell, so these render at request time on the client.
  { path: 'play/daily/:date', renderMode: RenderMode.Client },
  { path: 'play/:mode/:difficulty/:duration', renderMode: RenderMode.Client },
  { path: 'results', renderMode: RenderMode.Client },
  { path: '**', renderMode: RenderMode.Prerender },
];
