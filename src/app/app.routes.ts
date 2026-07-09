import { Routes } from '@angular/router';

import { gameConfigGuard } from './core/guards/game-config.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/home/home').then((m) => m.Home),
    title: 'Typester — a keyboard speed-typing game',
    data: {
      description:
        'Type fast, beat the clock, and chase your best score in Typester — a free, installable, keyboard-first typing speed game.',
    },
  },
  {
    path: 'play/:mode/:difficulty/:duration',
    loadComponent: () => import('./features/game/game').then((m) => m.Game),
    canActivate: [gameConfigGuard],
    title: 'Typester — playing',
    data: { description: 'A live round of Typester.' },
  },
  {
    path: 'results',
    loadComponent: () => import('./features/results/results').then((m) => m.Results),
    title: 'Typester — results',
    data: { description: 'Your Typester round results: score, WPM, and accuracy.' },
  },
  {
    path: 'settings',
    loadComponent: () => import('./features/settings/settings').then((m) => m.Settings),
    title: 'Typester — settings',
    data: { description: 'Theme, sound, motion, and Quick Play preferences for Typester.' },
  },
  {
    path: 'help',
    loadComponent: () => import('./features/help/help').then((m) => m.Help),
    title: 'Typester — help & FAQ',
    data: { description: 'How scoring, word variety, and offline play work in Typester.' },
  },
  {
    path: 'privacy',
    loadComponent: () => import('./features/legal/privacy-policy').then((m) => m.PrivacyPolicy),
    title: 'Typester — privacy policy',
    data: { description: 'What Typester stores, where, and the one network request it makes.' },
  },
  {
    path: 'terms',
    loadComponent: () => import('./features/legal/terms').then((m) => m.Terms),
    title: 'Typester — terms of use',
    data: { description: 'The terms that apply to using Typester.' },
  },
  {
    path: 'license',
    loadComponent: () => import('./features/legal/license').then((m) => m.License),
    title: 'Typester — license',
    data: { description: 'Typester is MIT licensed.' },
  },
  { path: '**', redirectTo: '' },
];
