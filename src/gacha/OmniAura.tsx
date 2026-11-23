// An equipped Omni card changes the whole site while it's on show (as the icon or the background):
// an aurora drifts behind every page, a line of fire glows under the header, the logo burns crimson
// and white, the main buttons and panels catch an ember light — and a mouse leaves a trail of
// sparks. The player can turn it off (Account page).
import { useEffect, useRef } from 'react';
import { useProgress } from '../store/progress';
import { CARD_BY_ID } from './cards';

const SPARKS = ['#ff3b4e', '#ff7a18', '#ffb38a', '#ffffff'];
/** A Genesis's own: seeds of dawn light, rising from the pointer instead of falling. */
const SEEDS = ['#2dd4bf', '#e879f9', '#f6c453', '#ffffff'];

/** The aura on show: a Genesis's (above all), an Omni's, or none — an owned card on show, the aura wanted. */
export function useAuraKind(): 'genesis' | 'omni' | null {
  return useProgress((s) => {
    if (s.omniAura === false) return null;
    const shown = [s.avatar, s.backdrop].filter((id): id is string => !!id && !!s.cards[id]).map((id) => CARD_BY_ID.get(id)?.rarity);
    return shown.includes('genesis') ? 'genesis' : shown.includes('omni') ? 'omni' : null;
  });
}

/** Whether an Omni (or a Genesis) card is on show, owned, and its aura wanted. */
export function useOmniAura(): boolean {
  return useAuraKind() !== null;
}

export function OmniAura() {
  const kind = useAuraKind();
  const on = kind !== null;
  const genesis = kind === 'genesis';
  const layer = useRef<HTMLDivElement>(null);

  // The site-wide look: one class on the page, the rest is CSS (index.css, .omni-aura, .genesis-aura).
  useEffect(() => {
    document.documentElement.classList.toggle('omni-aura', kind === 'omni');
    document.documentElement.classList.toggle('genesis-aura', genesis);
    return () => document.documentElement.classList.remove('omni-aura', 'genesis-aura');
  }, [kind, genesis]);

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
      const palette = genesis ? SEEDS : SPARKS;
      const color = palette[Math.floor(Math.random() * palette.length)];
      s.className = genesis ? 'omni-spark genesis-seed' : 'omni-spark';
      // An Omni's sparks fall; a Genesis's seeds of light rise, slower.
      const dy = genesis ? -(20 + Math.random() * 40) : 10 + Math.random() * 30;
      s.style.cssText = `left:${e.clientX}px;top:${e.clientY}px;width:${size}px;height:${size}px;background:${color};color:${color};--dx:${(Math.random() - 0.5) * 40}px;--dy:${dy}px`;
      layer.current.appendChild(s);
      window.setTimeout(() => s.remove(), genesis ? 1400 : 800);
    };
    window.addEventListener('pointermove', move);
    return () => window.removeEventListener('pointermove', move);
  }, [on, genesis]);

  if (!on) return null;
  return (
    <>
      {/* The aurora behind every page (index.css, .omni-aurora; a Genesis's dawn colours, .genesis-aurora). */}
      <div className={`omni-aurora omni-aurora-a ${genesis ? 'genesis-aurora' : ''}`} aria-hidden />
      <div className={`omni-aurora omni-aurora-b ${genesis ? 'genesis-aurora' : ''}`} aria-hidden />
      <div ref={layer} className="pointer-events-none fixed inset-0 z-[60] overflow-hidden" aria-hidden />
    </>
  );
}
