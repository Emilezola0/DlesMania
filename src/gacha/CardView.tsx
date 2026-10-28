import { useRef, useState } from 'react';
import { shownName } from '../lib/french';
import { RARITY_INFO, setSize, type Card, type Rarity } from './cards';

/** Each rarity's frame, glow and the tint behind the picture. */
export const RARITY_STYLE: Record<Rarity, { frame: string; glow: string; tint: string; text: string }> = {
  common: { frame: 'linear-gradient(145deg,#cbd5e1,#64748b 55%,#94a3b8)', glow: '0 4px 14px rgba(15,23,42,.35)', tint: 'radial-gradient(circle at 50% 35%,#475569,#1e293b)', text: '#e2e8f0' },
  rare: { frame: 'linear-gradient(145deg,#7dd3fc,#2563eb 55%,#38bdf8)', glow: '0 6px 22px rgba(37,99,235,.45)', tint: 'radial-gradient(circle at 50% 35%,#1d4ed8,#0b1a3f)', text: '#dbeafe' },
  epic: { frame: 'linear-gradient(145deg,#f0abfc,#7c3aed 55%,#c084fc)', glow: '0 8px 30px rgba(124,58,237,.55)', tint: 'radial-gradient(circle at 50% 35%,#7e22ce,#1e0a3c)', text: '#f3e8ff' },
  legendary: { frame: 'linear-gradient(145deg,#fef08a,#f59e0b 40%,#fde047 60%,#b45309)', glow: '0 10px 40px rgba(245,158,11,.65)', tint: 'radial-gradient(circle at 50% 35%,#f59e0b,#451a03)', text: '#fef3c7' },
};

/**
 * A card, front side. Its text is sized to its own width (container units), so the same card
 * reads at album size and in the big view. It tilts toward the pointer, the shine following.
 */
export function CardFace({ card, count = 0, tilt = true, isNew }: { card: Card; count?: number; tilt?: boolean; isNew?: boolean }) {
  const st = RARITY_STYLE[card.rarity];
  const ref = useRef<HTMLDivElement>(null);
  const [t, setT] = useState({ x: 0, y: 0, mx: 50, my: 50 });
  const move = (e: React.PointerEvent) => {
    if (!tilt || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    setT({ x: (0.5 - py) * 16, y: (px - 0.5) * 18, mx: px * 100, my: py * 100 });
  };
  return (
    <div
      ref={ref}
      onPointerMove={move}
      onPointerLeave={() => setT({ x: 0, y: 0, mx: 50, my: 50 })}
      className="relative aspect-[5/7] w-full rounded-[7%] p-[3%] transition-transform duration-150 ease-out [container-type:inline-size]"
      style={{ background: st.frame, boxShadow: st.glow, transform: `perspective(700px) rotateX(${t.x}deg) rotateY(${t.y}deg)` }}
    >
      <div className="relative flex size-full flex-col overflow-hidden rounded-[5%] bg-[#0f0d16]" style={{ color: st.text }}>
        {/* Name and rarity. */}
        <div className="flex items-center justify-between gap-[2cqw] px-[4cqw] py-[2.5cqw]">
          <p className="truncate font-display text-[7.5cqw] font-bold leading-tight">{shownName(card.name)}</p>
          <span className="shrink-0 text-[5.5cqw]" title={RARITY_INFO[card.rarity].name}>
            {RARITY_INFO[card.rarity].gem}
          </span>
        </div>
        {/* The picture, whole (renders, items and portraits all fit), on the rarity's tint. */}
        <div className="relative mx-[3cqw] h-[56%] overflow-hidden rounded-[3cqw]" style={{ background: st.tint }}>
          <img src={card.image} alt="" draggable={false} loading="lazy" className="size-full object-contain drop-shadow-[0_6px_10px_rgba(0,0,0,.5)]" />
        </div>
        <div className="flex items-center justify-between px-[4cqw] pt-[2.5cqw] text-[4.6cqw] font-semibold opacity-80">
          <span className="truncate">{card.franchise}</span>
          <span className="shrink-0 tabular-nums">
            {card.no}/{setSize(card.set)}
          </span>
        </div>
        <p className="line-clamp-3 px-[4cqw] pt-[1.5cqw] text-[4.6cqw] leading-snug opacity-90">{card.description}</p>
        {/* The shine: epic and legendary cards move theirs with the pointer, the legendary in rainbow. */}
        {card.rarity !== 'common' && (
          <div
            className={`pointer-events-none absolute inset-0 ${card.rarity === 'legendary' ? 'card-holo' : card.rarity === 'epic' ? 'card-sheen' : ''}`}
            style={{
              background:
                card.rarity === 'rare'
                  ? `radial-gradient(circle at ${t.mx}% ${t.my}%, rgba(255,255,255,.18), transparent 45%)`
                  : `radial-gradient(circle at ${t.mx}% ${t.my}%, rgba(255,255,255,.28), transparent 50%)`,
            }}
          />
        )}
      </div>
      {count > 1 && <span className="absolute -left-[4cqw] -top-[4cqw] grid min-w-[16cqw] place-items-center rounded-full bg-ink px-[3cqw] py-[1cqw] font-display text-[7cqw] font-bold text-paper shadow">×{count}</span>}
      {isNew && <span className="absolute -right-[4cqw] -top-[4cqw] animate-pop rounded-full bg-coral px-[3cqw] py-[1cqw] font-display text-[6.5cqw] font-bold text-white shadow">NEW</span>}
    </div>
  );
}

/** A card face down: the Omnidle back, coloured by rarity once it's known (the glow gives it away a moment early). */
export function CardBack({ rarity }: { rarity?: Rarity }) {
  return (
    <div
      className="relative grid aspect-[5/7] w-full place-items-center rounded-[7%] border-[3px] border-[#a78bfa] bg-[#1b1530] [container-type:inline-size]"
      style={{ boxShadow: rarity ? RARITY_STYLE[rarity].glow : undefined, backgroundImage: 'repeating-linear-gradient(45deg, rgba(167,139,250,.12) 0 6px, transparent 6px 12px)' }}
    >
      <span className="font-display text-[22cqw] font-bold text-[#c4b5fd]">✦</span>
      <span className="absolute bottom-[6cqw] font-display text-[7cqw] font-bold tracking-[0.3em] text-[#c4b5fd]">OMNIDLE</span>
    </div>
  );
}

/** A card not collected yet: its outline and number only. */
export function CardMissing({ card }: { card: Card }) {
  return (
    <div className="grid aspect-[5/7] w-full place-items-center rounded-[7%] border-2 border-dashed border-rule-strong bg-tile/50 text-center text-ink-faint [container-type:inline-size]">
      <div>
        <p className="font-display text-[16cqw] font-bold">?</p>
        <p className="text-[6cqw] font-semibold">
          {card.franchise} · {card.no}/{setSize(card.set)}
        </p>
      </div>
    </div>
  );
}
