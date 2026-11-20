import { Routes } from '@angular/router';

import { modeGuard } from './core/modes';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/home/home').then((m) => m.Home),
    title: 'Typester, a typing game',
    data: {
      description:
        'A typing game where every word buys time. Build a combo, beat your best, play the Daily.',
    },
  },
  {
    path: 'play/:mode',
    loadComponent: () => import('./features/play/play').then((m) => m.Play),
    canActivate: [modeGuard],
    title: 'Typester',
    data: { description: 'A Typester run.' },
  },
  {
    path: 'stats',
    loadComponent: () => import('./features/stats/stats').then((m) => m.Stats),
    title: 'Your stats, Typester',
    data: { description: 'Your Typester bests, streak, recent runs, and the keys you miss.' },
  },
  {
    path: 'settings',
    loadComponent: () => import('./features/settings/settings').then((m) => m.Settings),
    title: 'Settings, Typester',
    data: { description: 'Theme, motion and sound for Typester.' },
  },
  {
    path: 'privacy',
    loadComponent: () => import('./features/legal/privacy-policy').then((m) => m.PrivacyPolicy),
    title: 'Privacy, Typester',
    data: { description: 'What Typester stores and where.' },
  },
  {
    path: 'terms',
    loadComponent: () => import('./features/legal/terms').then((m) => m.Terms),
    title: 'Terms, Typester',
    data: { description: 'The terms that apply to using Typester.' },
  },
  {
    path: 'license',
    loadComponent: () => import('./features/legal/license').then((m) => m.License),
    title: 'License, Typester',
    data: { description: 'Typester is MIT licensed.' },
  },
  { path: '**', redirectTo: '' },
];
