import confetti from 'canvas-confetti';

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const COLORS = ['#818cf8', '#f472b6', '#facc15', '#34d399', '#60a5fa'];

/** Small burst for a solved round. */
export function celebrate() {
  if (reducedMotion()) return;
  void confetti({ particleCount: 70, spread: 70, startVelocity: 38, origin: { y: 0.7 }, colors: COLORS, disableForReducedMotion: true });
}

/** Two-sided shower for a finished daily challenge. */
export function celebrateBig() {
  if (reducedMotion()) return;
  const end = Date.now() + 1400;
  const frame = () => {
    void confetti({ particleCount: 6, angle: 60, spread: 60, origin: { x: 0, y: 0.75 }, colors: COLORS });
    void confetti({ particleCount: 6, angle: 120, spread: 60, origin: { x: 1, y: 0.75 }, colors: COLORS });
    if (Date.now() < end) requestAnimationFrame(frame);
  };
  frame();
}

/** Jolts an element (screen shake). `strength` is the peak offset in pixels. */
export function shake(el: HTMLElement | null, strength = 8, duration = 420) {
  if (!el || reducedMotion() || !el.animate) return;
  const s = strength;
  el.animate(
    [
      { transform: 'translate(0, 0)' },
      { transform: `translate(${-s}px, ${s * 0.4}px) rotate(-0.4deg)` },
      { transform: `translate(${s * 0.8}px, ${-s * 0.5}px) rotate(0.4deg)` },
      { transform: `translate(${-s * 0.5}px, ${s * 0.3}px)` },
      { transform: `translate(${s * 0.3}px, 0)` },
      { transform: 'translate(0, 0)' },
    ],
    { duration, easing: 'ease-out' },
  );
}

/** A full-screen-ish colour flash over `el` (hit = light, hurt = red). */
export function flash(el: HTMLElement | null, color: string, duration = 380) {
  if (!el || reducedMotion() || !el.animate) return;
  el.style.background = color;
  el.animate([{ opacity: 0.55 }, { opacity: 0 }], { duration, easing: 'ease-out' });
}
