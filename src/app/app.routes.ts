import { Routes } from '@angular/router';

import { gameConfigGuard } from './core/guards/game-config.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/home/home').then((m) => m.Home),
    title: 'Typester — a keyboard speed-typing game',
  },
  {
    path: 'play/:mode/:difficulty/:duration',
    loadComponent: () => import('./features/game/game').then((m) => m.Game),
    canActivate: [gameConfigGuard],
    title: 'Typester — playing',
  },
  {
    path: 'results',
    loadComponent: () => import('./features/results/results').then((m) => m.Results),
    title: 'Typester — results',
  },
  {
    path: 'settings',
    loadComponent: () => import('./features/settings/settings').then((m) => m.Settings),
    title: 'Typester — settings',
  },
  {
    path: 'help',
    loadComponent: () => import('./features/help/help').then((m) => m.Help),
    title: 'Typester — help & FAQ',
  },
  {
    path: 'privacy',
    loadComponent: () => import('./features/legal/privacy-policy').then((m) => m.PrivacyPolicy),
    title: 'Typester — privacy policy',
  },
  {
    path: 'terms',
    loadComponent: () => import('./features/legal/terms').then((m) => m.Terms),
    title: 'Typester — terms of use',
  },
  {
    path: 'license',
    loadComponent: () => import('./features/legal/license').then((m) => m.License),
    title: 'Typester — license',
  },
  { path: '**', redirectTo: '' },
];
