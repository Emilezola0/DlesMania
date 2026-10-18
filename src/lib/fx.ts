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
