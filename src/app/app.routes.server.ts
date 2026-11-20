import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // A run is all client state; prerendering it would only produce a shell.
  { path: 'play/:mode', renderMode: RenderMode.Client },
  { path: '**', renderMode: RenderMode.Prerender },
];
