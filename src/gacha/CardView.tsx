import { useEffect, useRef, useState } from 'react';
import { shownName } from '../lib/french';
import { bossKey, useProgress } from '../store/progress';
import { RARITY_INFO, setSize, type Card, type Rarity } from './cards';
import { GradeEmblem } from './GradeEmblem';
import { gradeOf } from './grades';

/** Each rarity's frame, glow, the tint behind the picture, and its text colour. */
export const RARITY_STYLE: Record<Rarity, { frame: string; glow: string; tint: string; text: string }> = {
  common: { frame: 'linear-gradient(145deg,#cbd5e1,#64748b 55%,#94a3b8)', glow: '0 4px 14px rgba(15,23,42,.35)', tint: 'radial-gradient(circle at 50% 35%,#475569,#1e293b)', text: '#e2e8f0' },
  rare: { frame: 'linear-gradient(145deg,#7dd3fc,#2563eb 55%,#38bdf8)', glow: '0 6px 22px rgba(37,99,235,.45)', tint: 'radial-gradient(circle at 50% 35%,#1d4ed8,#0b1a3f)', text: '#dbeafe' },
  epic: { frame: 'linear-gradient(145deg,#f0abfc,#7c3aed 55%,#c084fc)', glow: '0 8px 30px rgba(124,58,237,.55)', tint: 'radial-gradient(circle at 50% 35%,#7e22ce,#1e0a3c)', text: '#f3e8ff' },
  legendary: {
    frame: 'linear-gradient(145deg,#fff7c2,#f59e0b 30%,#fde047 50%,#b45309 70%,#fef08a)',
    glow: '0 10px 40px rgba(245,158,11,.65), 0 0 0 1px rgba(255,236,150,.6)',
    tint: 'radial-gradient(circle at 50% 30%,#fcd34d,#b45309 45%,#2a1203)',
    text: '#fef3c7',
  },
  // The mythic's frame and background are drawn by its classes (card-mythic-*): this is the fallback.
  mythic: {
    frame: 'conic-gradient(#ff4fd8,#ffcd3c,#3cff9e,#3cc7ff,#a855f7,#ff4fd8)',
    glow: '0 12px 48px rgba(240,171,252,.6), 0 0 28px rgba(60,199,255,.35)',
    tint: 'radial-gradient(circle at 50% 30%,#4c1d95,#0b0820 70%)',
    text: '#fdf4ff',
  },
  // The omni's look is all classes (card-omni-*): a cosmos, a crown, a living frame. This is the fallback.
  omni: {
    frame: 'conic-gradient(#fff1a8,#ff4fd8,#3cc7ff,#fff1a8)',
    glow: '0 0 0 2px rgba(255,241,168,.8), 0 14px 60px rgba(255,241,168,.55), 0 0 40px rgba(255,79,216,.45)',
    tint: 'radial-gradient(circle at 50% 30%,#fde68a55,#0b0820 70%)',
    text: '#fffbeb',
  },
};

/** An omni's form: its second (awakened) once its franchise's guardian has been beaten on Hard (or Hell). */
/** Whether an omni has woken: its guardian beaten on Hard or Hell. */
export const isAwake = (card: Card, bosses: Record<string, { wins: number }>) => !!card.awaken && ((bosses[bossKey(card.set, 'hard')]?.wins ?? 0) > 0 || (bosses[bossKey(card.set, 'hell')]?.wins ?? 0) > 0);

export function useCardForm(card: Card): { image: string; title?: string; description: string; awakened: boolean; clip?: string; clipLight?: boolean } {
  const awake = useProgress((s) => isAwake(card, s.bosses));
  return awake && card.awaken
    ? { image: card.awaken.image, title: card.awaken.title, description: card.awaken.line, awakened: true, clip: card.awaken.clip, clipLight: card.awaken.clipLight }
    : { image: card.image, title: card.title, description: card.description, awakened: false, clip: card.clip, clipLight: card.clipLight };
}

/** A GIF held on its first frame (a canvas: the picture only has to be shown, never read). */
function StillGif({ src, className }: { src: string; className: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const c = ref.current;
      if (!c) return;
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      c.getContext('2d')?.drawImage(img, 0, 0);
    };
    img.src = src;
  }, [src]);
  return <canvas ref={ref} className={className} />;
}

/**
 * A card, front side. Its text is sized to its own width (container units), so the same card
 * reads at album size and in the big view. It tilts toward the pointer — or, given `foil`, takes
 * its light from outside (the big view passes the card's turn) — and the foil follows: a highlight
 * on rare cards, a sweeping sheen on epics, gold leaf and glints on legendaries, and on mythics a
 * prism: rainbow foil and glitter over a starry night, a rainbow frame turning around it all.
 * `depth` lifts the name, badges and text off the card (for the 3D big view). Above grade I, the
 * card wears its grade's emblem and shine (`grade`: the player's own when not given).
 */
export function CardFace({ card, count = 0, tilt = true, isNew, foil, depth, grade: given, animate }: { card: Card; count?: number; tilt?: boolean; isNew?: boolean; foil?: { x: number; y: number }; depth?: boolean; grade?: number; animate?: boolean }) {
  /** A clip that wouldn't play: back to the picture. */
  const [clipFailed, setClipFailed] = useState<string | null>(null);
  const owned = useProgress((s) => gradeOf(s.grades, card.id));
  // The voice line in the names' language (a French dub's when the card has one).
  const voiceLine = useProgress((s) => (s.nameLang === 'fr' && card.voiceFr) || card.voice);
  const grade = given ?? owned;
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
  const mx = foil?.x ?? t.mx;
  const my = foil?.y ?? t.my;
  const mythic = card.rarity === 'mythic';
  const omni = card.rarity === 'omni';
  // Mythics and omnis share the prism; omnis add a cosmos, a crown, and a second form.
  const prism = mythic || omni;
  const form = useCardForm(card);
  const motion = useProgress((s) => s.cardMotion ?? true);
  // A light clip only loads once its card is on screen.
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (animate || !motion || !form.clipLight || !el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { rootMargin: '100px' });
    io.observe(el);
    return () => io.disconnect();
  }, [animate, motion, form.clipLight]);
  const lift = (z: number) => (depth ? { transform: `translateZ(${z}px)` } : undefined);
  return (
    <div
      ref={ref}
      onPointerMove={move}
      onPointerLeave={() => setT({ x: 0, y: 0, mx: 50, my: 50 })}
      className={`relative aspect-[5/7] w-full rounded-[7%] p-[3%] transition-transform duration-150 ease-out [container-type:inline-size] ${omni ? `card-omni-frame ${form.awakened ? 'card-omni-awake' : ''}` : mythic ? 'card-mythic-frame' : ''} ${depth ? '[transform-style:preserve-3d]' : ''}`}
      style={{
        background: prism ? undefined : st.frame,
        boxShadow: st.glow,
        transform: tilt ? `perspective(700px) rotateX(${t.x}deg) rotateY(${t.y}deg)` : undefined,
        ['--mx' as string]: `${mx}%`,
        ['--my' as string]: `${my}%`,
      }}
    >
      <div className={`relative flex size-full flex-col overflow-hidden rounded-[5%] ${omni ? 'card-omni-sky' : mythic ? 'card-mythic-sky' : 'bg-[#0f0d16]'}`} style={{ color: st.text }}>
        {/* Name and rarity (and a mythic's title). */}
        <div className="relative z-10 px-[4cqw] py-[2.5cqw]">
          <div className="flex items-center justify-between gap-[2cqw]">
            <p className={`truncate font-display text-[7.5cqw] font-bold leading-tight ${omni ? 'card-omni-name' : mythic ? 'card-mythic-name' : card.rarity === 'legendary' ? 'card-gold-name' : ''}`}>{shownName(card.name, card.set)}</p>
            <span className="shrink-0 text-[5.5cqw]" title={RARITY_INFO[card.rarity].name}>
              {RARITY_INFO[card.rarity].gem}
            </span>
          </div>
          {form.title && <p className="truncate text-[4.6cqw] font-semibold italic opacity-90">{form.title}</p>}
        </div>
        {/* The picture, whole (renders, items and portraits all fit), on the rarity's tint. */}
        <div className={`relative mx-[3cqw] overflow-hidden rounded-[3cqw] ${form.title ? 'h-[50%]' : 'h-[56%]'}`} style={{ background: omni ? 'radial-gradient(circle at 50% 35%, rgba(255,241,168,.5), rgba(168,85,247,.25) 45%, rgba(15,10,40,.2) 75%)' : mythic ? 'radial-gradient(circle at 50% 35%, rgba(168,85,247,.55), rgba(15,10,40,.2) 70%)' : st.tint }}>
          {/* Up close (`animate`), a mythic's clip loops in place of its picture; elsewhere only a light clip does, once on screen. */}
          {form.clip && clipFailed !== form.clip && (animate || (motion && form.clipLight && inView)) ? (
            <video
              key={form.clip}
              src={form.clip}
              poster={form.image}
              autoPlay
              muted
              loop
              playsInline
              onError={() => setClipFailed(form.clip!)}
              className="size-full object-cover"
            />
          ) : !motion && !animate && /\.gif/i.test(form.image) ? (
            <StillGif src={form.image} className="size-full object-contain" />
          ) : (
          <img
            key={form.image}
            src={form.image}
            alt=""
            draggable={false}
            loading="lazy"
            className="size-full object-contain drop-shadow-[0_6px_10px_rgba(0,0,0,.5)]"
            // A framed picture (group shot, title banner…): zoomed on its subject. Not an omni's other form.
            style={card.focus && !form.awakened ? { transform: `scale(${card.focus.zoom})`, transformOrigin: `${card.focus.x}% ${card.focus.y}%` } : undefined}
          />
          )}
          {grade > 1 && <GradeEmblem grade={grade} className="absolute left-[1.5cqw] top-[1.5cqw] w-[17cqw] drop-shadow-[0_2px_3px_rgba(0,0,0,.6)]" />}
          {card.voice && (
            <p className="card-voice absolute inset-x-[3cqw] bottom-[2.5cqw] rounded-[2cqw] px-[2.5cqw] py-[1.2cqw] text-center text-[4.4cqw] font-bold italic leading-tight text-white">
              “{voiceLine}”
            </p>
          )}
        </div>
        <div className="relative z-10 flex items-center justify-between px-[4cqw] pt-[2.5cqw] text-[4.6cqw] font-semibold opacity-80">
          <span className="truncate">{card.franchise}</span>
          <span className="shrink-0 tabular-nums">{omni ? '✪' : mythic ? '✦' : `${card.no}/${setSize(card.set)}`}</span>
        </div>
        <p className="relative z-10 line-clamp-3 px-[4cqw] pt-[1.5cqw] text-[4.6cqw] leading-snug opacity-90">{form.description}</p>

        {/* The foil, under the pointer (or the light of the turn). */}
        {card.rarity === 'rare' && <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(circle at var(--mx) var(--my), rgba(255,255,255,.18), transparent 45%)' }} />}
        {card.rarity === 'epic' && <div className="card-sheen pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(circle at var(--mx) var(--my), rgba(255,255,255,.26), transparent 50%)' }} />}
        {card.rarity === 'legendary' && (
          <>
            <div className="card-gold-foil pointer-events-none absolute inset-0" />
            <div className="card-glints pointer-events-none absolute inset-0" />
          </>
        )}
        {prism && (
          <>
            <div className="card-prism pointer-events-none absolute inset-0" />
            <div className="card-glitter pointer-events-none absolute inset-0" />
            {/* Sparks drifting up through the card. */}
            <div className={`card-sparks pointer-events-none absolute inset-0 ${omni ? 'card-sparks-gold' : ''}`} />
          </>
        )}
        {/* The grade's shine: an edge of its metal, then a passing gleam, then specks of light. */}
        {grade > 1 && <div className={`card-grade-fx card-grade-${grade} pointer-events-none absolute inset-0`} />}
      </div>
      {/* Gold and Radiant: a light running round the frame, and a halo. */}
      {grade >= 4 && (
        <>
          <div className={`card-grade-orbit card-grade-orbit-${grade} pointer-events-none absolute inset-0 rounded-[7%]`} />
          <div className={`card-grade-halo card-grade-halo-${grade} pointer-events-none absolute inset-0 rounded-[7%]`} />
        </>
      )}

      {mythic && (
        <span className="card-mythic-ribbon absolute left-1/2 top-[-3.5cqw] -translate-x-1/2 rounded-full px-[4cqw] py-[1cqw] font-display text-[5cqw] font-black tracking-[0.3em] text-white shadow-lg" style={lift(40)}>
          ✦ MYTHIC
        </span>
      )}
      {omni && (
        <span className="card-omni-crown absolute left-1/2 top-[-4.5cqw] -translate-x-1/2 whitespace-nowrap rounded-full px-[4.5cqw] py-[1.2cqw] font-display text-[5.2cqw] font-black tracking-[0.3em] shadow-lg" style={lift(50)}>
          ✪ {form.awakened ? 'AWAKENED' : 'OMNI'}
        </span>
      )}
      {/* Above the name bar (z-10) and the grade sheen (z-5), which they overlap at the corners. */}
      {count > 1 && (
        <span className="absolute -left-[4cqw] -top-[4cqw] z-20 grid min-w-[16cqw] place-items-center rounded-full bg-ink px-[3cqw] py-[1cqw] font-display text-[7cqw] font-bold text-paper shadow" style={lift(30)}>
          ×{count}
        </span>
      )}
      {isNew && (
        <span className="absolute -right-[4cqw] -top-[4cqw] z-20 animate-pop rounded-full bg-coral px-[3cqw] py-[1cqw] font-display text-[6.5cqw] font-bold text-white shadow" style={lift(30)}>
          NEW
        </span>
      )}
    </div>
  );
}

/** A card face down: the Omnidle back, coloured by rarity once it's known (the glow gives it away a moment early). */
export function CardBack({ rarity }: { rarity?: Rarity }) {
  return (
    <div
      className={`relative grid aspect-[5/7] w-full place-items-center rounded-[7%] border-[3px] bg-[#1b1530] [container-type:inline-size] ${rarity === 'mythic' || rarity === 'omni' ? 'card-mythic-back border-transparent' : 'border-[#a78bfa]'}`}
      style={{ boxShadow: rarity ? RARITY_STYLE[rarity].glow : undefined, backgroundImage: rarity === 'mythic' || rarity === 'omni' ? undefined : 'repeating-linear-gradient(45deg, rgba(167,139,250,.12) 0 6px, transparent 6px 12px)' }}
    >
      <span className="font-display text-[22cqw] font-bold text-[#c4b5fd]">✦</span>
      <span className="absolute bottom-[6cqw] font-display text-[7cqw] font-bold tracking-[0.3em] text-[#c4b5fd]">OMNIDLE</span>
    </div>
  );
}

/** A card not collected yet: its outline and number only (a mythic's or an omni's sparkles faintly). */
export function CardMissing({ card }: { card: Card }) {
  const mythic = card.rarity === 'mythic' || card.rarity === 'omni';
  const omni = card.rarity === 'omni';
  return (
    <div className={`grid aspect-[5/7] w-full place-items-center rounded-[7%] border-2 border-dashed text-center text-ink-faint [container-type:inline-size] ${mythic ? 'border-[#f0abfc]/60 bg-[#f0abfc]/5' : 'border-rule-strong bg-tile/50'}`}>
      <div>
        <p className="font-display text-[16cqw] font-bold">{omni ? '✪' : mythic ? '✦' : '?'}</p>
        <p className="text-[6cqw] font-semibold">
          {card.franchise} · {omni ? 'Omni' : mythic ? 'Mythic' : `${card.no}/${setSize(card.set)}`}
        </p>
      </div>
    </div>
  );
}
