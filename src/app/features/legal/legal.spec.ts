import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { License } from './license';
import { PrivacyPolicy } from './privacy-policy';
import { Terms } from './terms';

describe('Legal pages', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  it('renders the privacy policy with a contact link', () => {
    const fixture = TestBed.createComponent(PrivacyPolicy);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Privacy Policy');
    expect(fixture.nativeElement.querySelector('a[href^="mailto:"]')).not.toBeNull();
  });

  it('renders terms of use with a link to the privacy policy and license', () => {
    const fixture = TestBed.createComponent(Terms);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Terms of Use');
    expect(fixture.nativeElement.querySelector('a[href="/privacy"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('a[href="/license"]')).not.toBeNull();
  });

  it('renders the MIT license text', () => {
    const fixture = TestBed.createComponent(License);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('MIT License');
    expect(fixture.nativeElement.textContent).toContain('Ashwin Sathian');
  });
});
