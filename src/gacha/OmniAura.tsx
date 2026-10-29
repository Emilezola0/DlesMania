// An equipped Omni card changes the whole site while it's on show (as the icon or the background):
// an aurora drifts behind every page, a rainbow line glows under the header, the logo turns
// gold-and-rainbow, the main buttons and panels catch a golden light — and a mouse leaves a trail of
// sparkles. The player can turn it off (Account page).
import { useEffect, useRef } from 'react';
import { useProgress } from '../store/progress';
import { CARD_BY_ID } from './cards';

const SPARKS = ['#fff1a8', '#ff9ff3', '#9fdcff', '#ffffff', '#ffcd3c'];

/** Whether an Omni card is on show, owned, and its aura wanted. */
export function useOmniAura(): boolean {
  return useProgress((s) => {
    if (s.omniAura === false) return false;
    return [s.avatar, s.backdrop].some((id) => !!id && !!s.cards[id] && CARD_BY_ID.get(id)?.rarity === 'omni');
  });
}

export function OmniAura() {
  const on = useOmniAura();
  const layer = useRef<HTMLDivElement>(null);

  // The site-wide look: one class on the page, the rest is CSS (index.css, .omni-aura).
  useEffect(() => {
    document.documentElement.classList.toggle('omni-aura', on);
    return () => document.documentElement.classList.remove('omni-aura');
  }, [on]);

  // The sparkle trail, for a mouse (not touch), not when motion is reduced.
  useEffect(() => {
    if (!on || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    let last = 0;
    const move = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || !layer.current) return;
      const now = performance.now();
      if (now - last < 35) return;
      last = now;
      const s = document.createElement('span');
      const size = 4 + Math.random() * 5;
      const color = SPARKS[Math.floor(Math.random() * SPARKS.length)];
      s.className = 'omni-spark';
      s.style.cssText = `left:${e.clientX}px;top:${e.clientY}px;width:${size}px;height:${size}px;background:${color};color:${color};--dx:${(Math.random() - 0.5) * 40}px;--dy:${10 + Math.random() * 30}px`;
      layer.current.appendChild(s);
      window.setTimeout(() => s.remove(), 800);
    };
    window.addEventListener('pointermove', move);
    return () => window.removeEventListener('pointermove', move);
  }, [on]);

  return on ? <div ref={layer} className="pointer-events-none fixed inset-0 z-[60] overflow-hidden" aria-hidden /> : null;
}
