import { useEffect, useRef } from 'react';
import { COSMETIC_BY_ID } from '../casino/cosmetics';
import { useProgress } from '../store/progress';
import { SETS } from './cards';
import type { Pack } from './packs';

/**
 * A pack's wrapper: its colours, a torn top edge, a shine — and for a franchise pack, its guardian. A golden
 * pack (every so many packs, see GOLDEN) is wrapped in gold foil, a light sweeping across it. The player's wrapper
 * (the Casino's Boutique) dresses the others: `wrapper` shows a given one instead (its preview).
 */
export function PackArt({ pack, className = '', shine = false, golden = false, wrapper }: { pack: Pack; className?: string; shine?: boolean; golden?: boolean; wrapper?: string }) {
  const set = pack.boss ? SETS.find((s) => s.id === pack.boss) : undefined;
  const mine = useProgress((s) => s.wrapper);
  const wrap = golden ? undefined : COSMETIC_BY_ID.get(wrapper ?? mine ?? '');
  const box = useRef<HTMLDivElement>(null);
  useHoloTilt(box, wrap?.opening === 'holofoil');
  return (
    <div
      ref={box}
      className={`relative grid aspect-[3/4] w-full place-items-center overflow-hidden rounded-lg text-white shadow-xl [container-type:inline-size] ${wrap?.className ?? ''} ${className}`}
      style={{ background: golden ? 'linear-gradient(160deg, #7c4a03, #f59e0b 30%, #fde68a 50%, #d97706 70%, #78350f)' : `linear-gradient(160deg, ${pack.colors[0]}, ${pack.colors[1]})`, clipPath: 'polygon(0 4%, 5% 0, 10% 4%, 15% 0, 20% 4%, 25% 0, 30% 4%, 35% 0, 40% 4%, 45% 0, 50% 4%, 55% 0, 60% 4%, 65% 0, 70% 4%, 75% 0, 80% 4%, 85% 0, 90% 4%, 95% 0, 100% 4%, 100% 100%, 0 100%)' }}
    >
      {wrap && <div className="pack-wrap-layer pointer-events-none absolute inset-0" aria-hidden />}
      {set?.guardian.image ? <img src={set.guardian.image} alt="" draggable={false} className="absolute inset-0 size-full object-cover opacity-40 mix-blend-luminosity" /> : null}
      <div className="relative text-center">
        <p className="text-[26cqw] leading-none drop-shadow">{pack.icon}</p>
        <p className="mt-[4cqw] px-[6cqw] font-display text-[10cqw] font-bold leading-tight drop-shadow">{pack.name.replace(' pack', '')}</p>
        <p className="mt-[2cqw] font-display text-[6cqw] font-semibold tracking-[0.3em] opacity-80">{golden ? '★ GOLDEN ★' : '5 CARDS'}</p>
      </div>
      <div className="card-sheen pointer-events-none absolute inset-0" />
      {golden && <div className="golden-foil pointer-events-none" aria-hidden />}
      {/* A foil's shine, following the pointer (the pack being torn sets --sx / --sy). */}
      {shine && <div className="pack-shine pointer-events-none absolute inset-0" aria-hidden />}
    </div>
  );
}

/**
 * The Holo Foil wrapper: the pack tilts toward the pointer and its rainbow follows the light (--hx / --hy; see
 * .pack-wrap-holofoil in index.css). The pointer anywhere on the page counts, so a pack cut in two (being torn)
 * tilts as one. Still for reduced motion and without a mouse.
 */
function useHoloTilt(box: React.RefObject<HTMLDivElement | null>, on: boolean) {
  useEffect(() => {
    const el = box.current;
    if (!on || !el || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    let frame = 0;
    let at = { x: 0, y: 0 };
    const draw = () => {
      frame = 0;
      const r = el.getBoundingClientRect();
      if (!r.width) return;
      // Where the pointer is, from the pack's centre: -1 to 1 within about two packs' size around it.
      const nx = Math.max(-1, Math.min(1, (at.x - (r.left + r.width / 2)) / r.width));
      const ny = Math.max(-1, Math.min(1, (at.y - (r.top + r.height / 2)) / r.height));
      el.style.setProperty('--hx', `${50 + nx * 50}%`);
      el.style.setProperty('--hy', `${50 + ny * 50}%`);
      el.style.transform = `perspective(700px) rotateY(${nx * 14}deg) rotateX(${-ny * 14}deg)`;
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
      at = { x: e.clientX, y: e.clientY };
      frame ||= requestAnimationFrame(draw);
    };
    window.addEventListener('pointermove', move, { passive: true });
    return () => {
      window.removeEventListener('pointermove', move);
      cancelAnimationFrame(frame);
      el.style.transform = '';
    };
  }, [box, on]);
}
