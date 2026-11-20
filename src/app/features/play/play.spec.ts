import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Store } from '../../core/store';
import { Play } from './play';

function currentWord(el: HTMLElement): string {
  const label = el.querySelector('#field')!.getAttribute('aria-label')!;
  return label.replace('Type the word: ', '');
}

function type(el: HTMLElement, text: string): void {
  const field = el.querySelector<HTMLInputElement>('#field')!;
  field.value = text;
  field.dispatchEvent(new Event('input'));
}

describe('Play', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  async function setup(mode = 'sprint') {
    const fixture = TestBed.createComponent(Play);
    fixture.componentRef.setInput('mode', mode);
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('advances to the next word once the last letter is typed', async () => {
    const { fixture, el } = await setup();
    const first = currentWord(el);
    type(el, first);
    await fixture.whenStable();
    expect(currentWord(el)).not.toBe(first);
    expect(el.querySelector('.meter__big')!.textContent).toContain(String(first.length * 10));
  });

  it('clears the field after every keystroke batch', async () => {
    const { el } = await setup();
    type(el, currentWord(el).slice(0, 1));
    expect(el.querySelector<HTMLInputElement>('#field')!.value).toBe('');
  });

  it('ends on Escape, records the run and shows results', async () => {
    const { fixture, el } = await setup();
    type(el, currentWord(el));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await fixture.whenStable();
    expect(el.querySelector('app-results')).not.toBeNull();
    expect(TestBed.inject(Store).data().best.sprint?.score).toBeGreaterThan(0);
  });

  it('gives the Daily the same first words every time', async () => {
    const a = await setup('daily');
    const first = currentWord(a.el);
    a.fixture.destroy();
    const b = await setup('daily');
    expect(currentWord(b.el)).toBe(first);
  });
});
