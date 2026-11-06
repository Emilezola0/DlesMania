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

/**
 * A rumble: the element trembles for `duration` ms, in small random jolts that grow from `from` to `to`
 * pixels (an earthquake building up), then settles.
 */
export function rumble(el: HTMLElement | null, duration: number, from = 1, to = 6) {
  if (!el || reducedMotion() || !el.animate) return;
  const steps = Math.max(2, Math.round(duration / 45));
  const frames: Keyframe[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const s = i === steps ? 0 : from + (to - from) * t * t;
    const x = (Math.random() * 2 - 1) * s;
    const y = (Math.random() * 2 - 1) * s * 0.7;
    frames.push({ transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${((Math.random() * 2 - 1) * s * 0.06).toFixed(2)}deg)` });
  }
  el.animate(frames, { duration, easing: 'linear' });
}

/**
 * Jolts an element (screen shake). `strength` is the peak offset in pixels.
 * With `punch` (e.g. 0.03), it's a hit instead: the element swells by that much at once, then settles back
 * in a few quick jolts that die away — punchy, and it lands exactly where it started.
 */
export function shake(el: HTMLElement | null, strength = 8, duration = 420, { punch = 0 }: { punch?: number } = {}) {
  if (!el || reducedMotion() || !el.animate) return;
  const s = strength;
  if (punch > 0) {
    const steps = 7;
    const frames: Keyframe[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const decay = (1 - t) * (1 - t);
      const side = i % 2 ? 1 : -1;
      const x = i === 0 || i === steps ? 0 : side * s * decay * (0.7 + Math.random() * 0.3);
      const y = i === 0 || i === steps ? 0 : (Math.random() * 2 - 1) * s * 0.35 * decay;
      const scale = 1 + punch * (1 - t) ** 3;
      frames.push({ transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${scale.toFixed(4)})` });
    }
    el.animate(frames, { duration, easing: 'cubic-bezier(.2,.7,.3,1)' });
    return;
  }
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
