import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

import { Button } from '../../shared/ui/button/button';

interface FaqItem {
  readonly question: string;
  readonly answer: string;
}

@Component({
  selector: 'app-help',
  imports: [Button],
  templateUrl: './help.html',
  styleUrl: './help.css',
})
export class Help {
  private readonly router = inject(Router);

  protected readonly faqs: readonly FaqItem[] = [
    {
      question: 'What is Typester?',
      answer:
        'A keyboard speed-typing game. A word appears, you type it and press Enter, and your score climbs against a clock.',
    },
    {
      question: "What's the difference between Quick Play and Game Modes?",
      answer:
        'Quick Play is a fixed 90-second round with a set mix of 4 easy, 4 medium, and 2 hard words. Game Modes let you choose a single difficulty (easy/medium/hard) and a duration (30/60/120s) yourself.',
    },
    {
      question: 'How is my score calculated?',
      answer:
        'Each word is worth 1, 2, or 3 points depending on its difficulty tier. A 5-word correct streak applies a x1.5 multiplier, a 10-word streak applies x2. Roughly 1 in 8 words is a "power word" worth double points. Finishing a round before time runs out adds a small time bonus.',
    },
    {
      question: 'Where do the words come from?',
      answer:
        'Fresh words are fetched for every round from a public word database, so rounds vary session to session. If that request fails or you are offline, Typester falls back to a bundled word list so a round can always be played.',
    },
    {
      question: 'Is my data stored anywhere else?',
      answer:
        'No. Settings, stats, and best scores are stored only in this browser via local storage - see the Privacy Policy for details.',
    },
    {
      question: 'Does it work offline?',
      answer:
        'Yes. Once loaded, Typester can be installed and played offline; word variety falls back to the bundled list without a network connection.',
    },
    {
      question: 'What keyboard shortcuts are there?',
      answer:
        'Tab/Shift+Tab moves between controls, Enter submits the current word or confirms a focused button, and Escape closes toasts and dialogs.',
    },
  ];

  goToMenu(): void {
    void this.router.navigate(['/']);
  }
}
