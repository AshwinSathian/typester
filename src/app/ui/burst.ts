import { Component, ElementRef, inject, viewChild } from '@angular/core';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
  color: string;
}

const GRAVITY = 0.32;
const LIFE_FRAMES = 42;

/**
 * Keycap confetti: square chips that spray from a finished word and fall.
 * One full-screen canvas, drawn only while chips are alive. Does nothing
 * when motion is reduced.
 */
@Component({
  selector: 'app-burst',
  host: { 'aria-hidden': 'true' },
  template: `<canvas #canvas></canvas>`,
  styles: `
    :host {
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 5;
    }
    canvas {
      width: 100%;
      height: 100%;
    }
  `,
})
export class Burst {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private particles: Particle[] = [];
  private frame = 0;

  /** Spray `count` chips from the centre of `from`. */
  fire(from: Element, count: number, colors: readonly string[]): void {
    if (this.reducedMotion()) return;
    const box = from.getBoundingClientRect();
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height / 2;
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1;
      const speed = 5 + Math.random() * 9;
      this.particles.push({
        x: cx + (Math.random() - 0.5) * box.width * 0.8,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: LIFE_FRAMES + Math.random() * 18,
        size: 5 + Math.random() * 7,
        color: colors[i % colors.length],
      });
    }
    if (!this.frame) this.frame = requestAnimationFrame(() => this.draw());
  }

  /** Reads a CSS custom property, for passing theme colours in. */
  token(name: string): string {
    return getComputedStyle(this.host.nativeElement).getPropertyValue(name).trim();
  }

  private draw(): void {
    const canvas = this.canvas().nativeElement;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== innerWidth * dpr || canvas.height !== innerHeight * dpr) {
      canvas.width = innerWidth * dpr;
      canvas.height = innerHeight * dpr;
    }
    const g = canvas.getContext('2d');
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, innerWidth, innerHeight);

    this.particles = this.particles.filter((p) => --p.life > 0);
    for (const p of this.particles) {
      p.vy += GRAVITY;
      p.vx *= 0.98;
      p.x += p.vx;
      p.y += p.vy;
      g.globalAlpha = Math.min(1, p.life / 16);
      g.fillStyle = p.color;
      g.save();
      g.translate(p.x, p.y);
      g.rotate(p.vx * 0.15);
      g.beginPath();
      g.roundRect(-p.size / 2, -p.size / 2, p.size, p.size, p.size / 4);
      g.fill();
      g.restore();
    }
    this.frame = this.particles.length ? requestAnimationFrame(() => this.draw()) : 0;
  }

  private reducedMotion(): boolean {
    const setting = document.documentElement.dataset['motion'];
    if (setting) return setting === 'reduced';
    return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? true;
  }
}
