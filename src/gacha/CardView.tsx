import { memo, useEffect, useRef, useState, type CSSProperties, type SyntheticEvent } from 'react';
import { fromKey } from '../lib/date';
import { shownName } from '../lib/french';
import { useProgress } from '../store/progress';
import { CardClip, type ClipSound } from './CardClip';
import { COLLECTIBLE, RARITY_INFO, RARITY_LIGHT, setSize, type Card, type Rarity } from './cards';
import { GradeEmblem } from './GradeEmblem';
import { elementOf, gradeOf, type ElementId } from './grades';
import { ANOMALIES, scrambled, shownRarity, type AnomalyId } from './anomalies';

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

/**
 * An omni's form: its awakened one, from the moment it's pulled (the owner's call, 12 November 2026: the awakened
 * pictures and clips are the ones to show). It used to wait for its guardian beaten on Hard or Hell; `bosses` is kept
 * so the callers stay as they are.
 */
export const isAwake = (card: Card, _bosses?: Record<string, { wins: number }>) => !!card.awaken;

export function useCardForm(card: Card): { image: string; title?: string; description: string; awakened: boolean; clip?: string; clipLight?: boolean; cutout?: boolean; opaque?: boolean } {
  const awake = useProgress((s) => isAwake(card, s.bosses));
  return awake && card.awaken
    ? { image: card.awaken.image, title: card.awaken.title, description: card.awaken.line, awakened: true, clip: card.awaken.clip, clipLight: card.awaken.clipLight, cutout: card.awaken.cutout, opaque: card.awaken.opaque }
    : { image: card.image, title: card.title, description: card.description, awakened: false, clip: card.clip, clipLight: card.clipLight, cutout: card.cutout, opaque: card.opaque };
}

/**
 * An opaque picture filling its frame (cover), on its subject. A framed picture's zoom (measured for a whole
 * picture) is kept only for what goes beyond filling the frame.
 */
function useFill(focus: Card['focus'] | undefined) {
  const [cover, setCover] = useState(1);
  const onLoad = (e: SyntheticEvent<HTMLImageElement>) => {
    const i = e.currentTarget;
    if (!i.naturalWidth || !i.offsetWidth || !i.offsetHeight) return;
    const a = i.naturalWidth / i.naturalHeight;
    const b = i.offsetWidth / i.offsetHeight;
    setCover(Math.max(a / b, b / a));
  };
  const x = focus?.x ?? 50;
  const y = focus?.y ?? 20;
  const extra = focus ? focus.zoom / cover : 1;
  const style: CSSProperties = { objectPosition: `${x}% ${y}%`, ...(extra > 1.02 ? { transform: `scale(${extra})`, transformOrigin: `${x}% ${y}%` } : {}) };
  return { style, onLoad };
}

/** The embers floating around an Omni up close: where, and how far off the card (px). */
/**
 * An omni's two rings of fire, tilted around the card up close. A ring crosses the card: half of it behind, half in front.
 * Chrome sorts that out in 3D (`full`: the whole ring). Firefox doesn't: it paints the card's flat layers first and
 * every 3D-turned one over them, whole rings included. So for Firefox (index.css picks) each ring is also cut in two
 * along its tilted plane: the far half (the top one, tilted away) inside a flat layer before the card — painted with
 * it, so under it — and the near half in 3D after it. Each turns inside its cut.
 */
function OmniRings({ half }: { half: 'full' | 'back' | 'front' }) {
  const rings = [1, 2].map((n) => (
    <div key={n} className={`card-omni-ring-tilt card-omni-ring-${n} card-omni-ring-${half}`} aria-hidden>
      <i className="card-omni-ring" />
    </div>
  ));
  return half === 'back' ? <div className="card-omni-ring-flat">{rings}</div> : <>{rings}</>;
}

/**
 * Firefox's rings, around a card up close (the big view puts them beside the card, in its turning 3D space): there the
 * card's face is flat (it loses what stands out of a 3D face), so rings inside it would be painted on it and turn
 * with it, not float around it. `under` goes before the card (a flat layer, painted under it), `over` after it (in 3D,
 * over it). Seen from the front, the far half of each ring is its top one (tilted away); seen from behind (`flipped`),
 * its bottom one — so the halves swap layers when the card is turned round.
 */
export function OmniRingsAround({ layer, flipped }: { layer: 'under' | 'over'; flipped?: boolean }) {
  const half = (layer === 'under') !== !!flipped ? 'back' : 'front';
  return (
    <div className={`omni-rings-around pointer-events-none absolute inset-0 ${layer === 'over' ? '[transform-style:preserve-3d]' : ''}`}>
      {[1, 2].map((n) => (
        <div key={n} className={`card-omni-ring-tilt card-omni-ring-${n} card-omni-ring-${half}`} aria-hidden>
          <i className="card-omni-ring" />
        </div>
      ))}
    </div>
  );
}

/**
 * Firefox's raised parts of a card up close: the Omni crown and its embers, standing out of the card in 3D. Firefox
 * doesn't draw what is lifted (translateZ) inside the card face itself — hidden behind its plane (found with
 * scripts/firefox-check.mjs: a lifted square showed one level up, never inside the face) — so the face stays flat there
 * and these go beside it, lifted, in the card's turning space. Each hides its back (seen from behind, the card's back
 * shows alone). Chrome draws the face's own (hidden here by CSS: .card-lifts is Firefox's only).
 */
export function CardLifts({ card }: { card: Card }) {
  // Its sizes follow the card's width, measured: a size container (cqw, as on the face) isn't drawn at all in 3D there.
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.offsetWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  if (card.rarity !== 'omni') return null;
  const cq = (n: number) => `${(w * n) / 100}px`;
  return (
    <div ref={ref} className="card-lifts pointer-events-none absolute inset-0 [transform-style:preserve-3d]" aria-hidden>
      <span
        className="card-omni-crown absolute left-1/2 whitespace-nowrap rounded-full font-display font-black tracking-[0.3em] shadow-lg [backface-visibility:hidden]"
        style={{ top: cq(-4.5), padding: `${cq(1.2)} ${cq(4.5)}`, fontSize: cq(5.2), transform: 'translateX(-50%) translateZ(50px)', visibility: w ? undefined : 'hidden' }}
      >
        ✪ OMNI
      </span>
      {EMBERS.map((e, i) => (
        <span key={i} className="card-omni-ember [backface-visibility:hidden]" style={{ left: `${e.x}%`, top: `${e.y}%`, transform: `translateZ(${e.z}px)`, animationDelay: `${i * -0.6}s` }} />
      ))}
    </div>
  );
}

const EMBERS = [
  { x: 6, y: 18, z: 70 },
  { x: 90, y: 12, z: 110 },
  { x: 14, y: 72, z: 130 },
  { x: 84, y: 64, z: 60 },
  { x: 48, y: 92, z: 95 },
  { x: 94, y: 88, z: -40 },
  { x: 3, y: 46, z: -60 },
];

/** Singularity's motes of light: where each one starts round the card, and when. */
const MOTES = Array.from({ length: 12 }, (_, i) => ({ a: i * 30, delay: -i * 0.53 }));

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
/** Time-Lost: every few seconds, for an instant, another character of the card's set (one with a picture). */
function useTimeLost(card: Card, on: boolean): Card | null {
  const [lost, setLost] = useState<Card | null>(null);
  useEffect(() => {
    setLost(null);
    if (!on || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const faces = COLLECTIBLE.filter((c) => c.set === card.set && c.id !== card.id && c.name !== card.name && c.image && !c.place && !c.technique);
    if (!faces.length) return;
    let t: number;
    const loop = () =>
      (t = window.setTimeout(() => {
        setLost(faces[Math.floor(Math.random() * faces.length)]);
        t = window.setTimeout(() => (setLost(null), loop()), 1300);
      }, 4500 + Math.random() * 4500));
    loop();
    return () => window.clearTimeout(t);
  }, [card, on]);
  return lost;
}

/** A name that scrambles for an instant every few seconds (a Corrupted card's). */
function useScramble(name: string, on: boolean) {
  const [shown, setShown] = useState(name);
  useEffect(() => {
    setShown(name);
    if (!on || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    let t: number;
    const burst = (left: number) => {
      setShown(left > 0 ? scrambled(name) : name);
      t = window.setTimeout(() => (left > 0 ? burst(left - 1) : loop()), left > 0 ? 60 : 0);
    };
    const loop = () => (t = window.setTimeout(() => burst(6), 2500 + Math.random() * 3500));
    loop();
    return () => window.clearTimeout(t);
  }, [name, on]);
  return shown;
}

export const CardFace = memo(function CardFace({ card, count = 0, tilt = true, isNew, foil, cssLight, depth, grade: given, animate, clipHeld, clipSound, onClipPlaying, still, calm, hoverHero, hero, anomaly: anomalyGiven, element: elementGiven }: { card: Card; count?: number; tilt?: boolean; isNew?: boolean; foil?: { x: number; y: number }; /** No foil given: its light (--mx/--my) comes from around it, animated in CSS (the big view's sway). */ cssLight?: boolean; depth?: boolean; grade?: number; animate?: boolean; /** Up close, its clip waits (a video, started by a tap; a YouTube one gets ready unseen meanwhile). */ clipHeld?: boolean; /** Its clip heard, once through. */ clipSound?: ClipSound; /** Its clip has started (up close). */ onClipPlaying?: () => void; /** No light clip of its own (many cards at once): only up close or under the mouse. */ still?: boolean; /** Hundreds at once (a big opening's summary): no scrambling name either. */ calm?: boolean; hoverHero?: boolean; hero?: boolean; anomaly?: AnomalyId | null; element?: ElementId }) {
  // A card back from a black hole: the player's own anomaly on it, unless one is given (null: none).
  const ownAnomaly = useProgress((s) => s.anomalies?.[card.id]);
  const anomalyId = anomalyGiven === undefined ? ownAnomaly : anomalyGiven;
  const anomaly = anomalyId ? ANOMALIES[anomalyId] : undefined;
  // What the card looks like: a Fake Rarity passes for a Mythic.
  const look = shownRarity(card.rarity, anomalyId);
  // Time-Lost: now and then another face of its set, for an instant.
  const lost = useTimeLost(card, !!anomaly?.timeLost && !calm);
  const scrambledName = useScramble(lost ? shownName(lost.name, lost.set) : shownName(card.name, card.set), !!anomaly?.scramble && !calm);
  const name = anomaly?.mirror ? [...scrambledName].reverse().join('') : scrambledName;
  // A mythic or omni comes to life: under the mouse (`hoverHero`), or when told to (`hero`: a first tap on a phone).
  const [hovered, setHovered] = useState(false);
  const heroOn = (hero || (hoverHero && hovered)) && (look === 'mythic' || look === 'omni') && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  /** A clip that wouldn't play: back to the picture. */
  const [clipFailed, setClipFailed] = useState<string | null>(null);
  const owned = useProgress((s) => gradeOf(s.grades, card.id));
  const engraving = useProgress((s) => s.engraved?.[card.id]);
  // The voice line in the names' language (a French dub's when the card has one).
  const voiceLine = useProgress((s) => (s.nameLang === 'fr' && card.voiceFr) || card.voice);
  const grade = given ?? owned;
  // Elemental (VIII): the element's colours on Celestial's look, or on Singularity's for Darkness.
  const ownElement = useProgress((s) => s.elements?.[card.id]);
  const el = elementOf(grade, elementGiven ?? ownElement);
  /** The grade whose look the card wears. */
  const fx = el ? (el.look === 'singularity' ? 7 : 6) : grade;
  const singularity = fx === 7;
  const st = RARITY_STYLE[look];
  // A calm card (a big summary) keeps still: its moving lights only come on under the mouse.
  const live = !calm || hovered;
  const ref = useRef<HTMLDivElement>(null);
  const [t, setT] = useState({ x: 0, y: 0, mx: 50, my: 50 });
  const move = (e: React.PointerEvent) => {
    if (!tilt || !ref.current || e.pointerType !== 'mouse') return;
    const r = ref.current.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    // An omni tilts further: more depth to it.
    const k = look === 'omni' ? 1.7 : 1;
    setT({ x: (0.5 - py) * 16 * k, y: (px - 0.5) * 18 * k, mx: px * 100, my: py * 100 });
  };
  const mx = foil?.x ?? t.mx;
  const my = foil?.y ?? t.my;
  const mythic = look === 'mythic';
  const omni = look === 'omni';
  // Mythics and omnis share the prism; omnis add a cosmos, a crown, and a second form.
  const prism = mythic || omni;
  const form = useCardForm(card);
  const fill = useFill(form.awakened ? undefined : card.focus);
  const motion = useProgress((s) => s.cardMotion ?? true);
  // A light clip only loads once its card is on screen.
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (animate || still || !motion || !form.clipLight || !el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { rootMargin: '100px' });
    io.observe(el);
    return () => io.disconnect();
  }, [animate, still, motion, form.clipLight]);
  const clipOn = !lost && !!form.clip && clipFailed !== form.clip && (animate || heroOn || (!still && motion && !!form.clipLight && inView));
  const lift = (z: number) => (depth ? { transform: `translateZ(${z}px)` } : undefined);
  const tilted = depth || t.x !== 0 || t.y !== 0;
  const hop = heroOn ? ' translateY(-5%) scale(1.1)' : '';
  return (
    <div
      ref={ref}
      onPointerMove={move}
      onPointerEnter={(e) => (hoverHero || calm) && e.pointerType === 'mouse' && setHovered(true)}
      onPointerLeave={() => (setT({ x: 0, y: 0, mx: 50, my: 50 }), setHovered(false))}
      className={`relative aspect-[5/7] w-full rounded-[7%] p-[3%] transition-transform duration-150 ease-out [container-type:inline-size] ${anomaly?.className ?? ''} ${live ? '' : 'card-calm'} ${omni ? `card-omni-frame ${form.awakened ? 'card-omni-awake' : ''}` : mythic ? 'card-mythic-frame' : ''} ${depth ? 'card-3d [transform-style:preserve-3d]' : fx >= 6 ? 'isolate' : ''} ${el ? `card-element card-element-${el.id}` : ''}`}
      style={{
        background: singularity ? '#05030a' : prism ? undefined : st.frame,
        boxShadow: st.glow,
        transform: tilt && tilted ? `perspective(700px) rotateX(${t.x}deg) rotateY(${t.y}deg)${hop}` : hop ? hop.trim() : undefined,
        zIndex: heroOn ? 20 : undefined,
        ...(cssLight && !foil ? {} : { ['--mx' as string]: `${mx}%`, ['--my' as string]: `${my}%` }),
        ...(el ? { ['--e1' as string]: el.colors[0], ['--e2' as string]: el.colors[1], ['--e3' as string]: el.colors[2] } : {}),
      }}
    >
      {/* Up close, an omni's rings of fire: their far halves first, behind the card (see the near halves below). */}
      {omni && depth && <OmniRings half="back" />}
      {/* A mythic's or omni's frame: its rainbow turning (a layer turned whole, so the card isn't redrawn each frame). */}
      {prism && !singularity && (
        <div className="card-frame-turn pointer-events-none absolute inset-0 overflow-hidden rounded-[7%]" aria-hidden>
          <i className={omni ? 'card-frame-turn-omni' : 'card-frame-turn-mythic'} />
        </div>
      )}
      {/* An omni's glow, pulsing (under everything, as the card's own shadow was). */}
      {omni && <div className="card-omni-pulse pointer-events-none absolute inset-0 -z-20 rounded-[7%]" aria-hidden />}
      <div className={`relative flex size-full flex-col overflow-hidden rounded-[5%] ${omni ? 'card-omni-sky' : mythic ? 'card-mythic-sky' : 'bg-[#0f0d16]'}`} style={{ color: st.text }}>
        {/* Name and rarity (and a mythic's title). */}
        <div className="relative z-10 px-[4cqw] py-[2.5cqw]">
          <div className="flex items-center justify-between gap-[2cqw]">
            <p className={`truncate font-display text-[7.5cqw] font-bold leading-tight ${omni ? 'card-omni-name' : mythic ? 'card-mythic-name' : card.rarity === 'legendary' ? 'card-gold-name' : ''}`}>{name}</p>
            {/* A Fake Rarity shows a Mythic's gem: it passes for one. */}
            <span className="shrink-0 text-[5.5cqw]" title={anomaly?.posesAsMythic ? undefined : RARITY_INFO[card.rarity].name}>
              {RARITY_INFO[look].gem}
            </span>
          </div>
          {form.title && <p className="truncate text-[4.6cqw] font-semibold italic opacity-90">{form.title}</p>}
        </div>
        {/* The picture, whole (renders, items and portraits all fit), on the rarity's tint. */}
        <div className={`card-picture relative mx-[3cqw] overflow-hidden rounded-[3cqw] ${form.title ? 'h-[50%]' : 'h-[56%]'}`} style={{ background: omni ? 'radial-gradient(circle at 50% 35%, rgba(255,255,255,.35), rgba(255,59,78,.35) 40%, rgba(10,5,8,.3) 75%)' : mythic ? 'radial-gradient(circle at 50% 35%, rgba(168,85,247,.55), rgba(15,10,40,.2) 70%)' : st.tint }}>
          {/* A mythic's or omni's background moves: light turning behind the picture. */}
          {prism && <div className={`card-backdrop ${omni ? 'card-backdrop-omni' : 'card-backdrop-mythic'} ${motion || animate || heroOn ? '' : 'card-backdrop-still'}`} />}
          {lost ? (
            <img key={`lost-${lost.id}`} src={lost.image} alt="" draggable={false} className="card-timelost-shift relative size-full object-contain drop-shadow-[0_6px_10px_rgba(0,0,0,.5)]" />
          ) : !motion && !animate && /\.gif/i.test(form.image) ? (
            <StillGif src={form.image} className="relative size-full object-contain" />
          ) : (
          <img
            key={form.image}
            src={form.image}
            alt=""
            draggable={false}
            loading="lazy"
            // An opaque picture (a rectangle) fills the frame; a cut-out one shows whole, on the rarity's tint.
            className={`relative size-full ${form.opaque ? 'object-cover' : `object-contain drop-shadow-[0_6px_10px_rgba(0,0,0,.5)] ${prism && !form.cutout ? 'card-feather' : ''}`} ${singularity ? (depth ? 'card-singularity-warp' : 'card-singularity-picture') : ''}`}
            onLoad={form.opaque ? fill.onLoad : undefined}
            // A framed picture (group shot, title banner…): zoomed on its subject. Not an omni's other form.
            style={form.opaque ? fill.style : card.focus && !form.awakened ? { transform: `scale(${card.focus.zoom})`, transformOrigin: `${card.focus.x}% ${card.focus.y}%` } : undefined}
          />
          )}
          {/* Its clip (up close, or a light clip once on screen) takes the picture's place as soon as it plays; until then, or if it can't, the picture stays. */}
          {clipOn && (
            <div className="absolute inset-0 overflow-hidden">
              <CardClip src={form.clip!} onFail={() => setClipFailed(form.clip!)} className="size-full object-cover" sound={animate ? clipSound : undefined} hold={animate && clipHeld} onPlaying={animate ? onClipPlaying : undefined} />
            </div>
          )}
          {grade > 1 && <GradeEmblem grade={grade} element={el?.id} className="absolute left-[1.5cqw] top-[1.5cqw] w-[17cqw] drop-shadow-[0_2px_3px_rgba(0,0,0,.6)]" />}
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
        {look === 'rare' && <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(circle at var(--mx) var(--my), rgba(255,255,255,.18), transparent 45%)' }} />}
        {look === 'epic' && <div className="card-sheen pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(circle at var(--mx) var(--my), rgba(255,255,255,.26), transparent 50%)' }} />}
        {look === 'legendary' && (
          <>
            <div className="card-gold-foil pointer-events-none absolute inset-0" />
            <div className="card-glints pointer-events-none absolute inset-0" />
          </>
        )}
        {prism && (
          <>
            <div className={`${omni ? 'card-omni-foil' : 'card-prism'} pointer-events-none absolute inset-0`} />
            {live && <div className="card-glitter pointer-events-none absolute inset-0" />}
            {/* Sparks drifting up through the card. */}
            {live && <div className={`card-sparks pointer-events-none absolute inset-0 ${omni ? 'card-sparks-gold' : ''}`} />}
          </>
        )}
        {/* The grade's shine: an edge of its metal, then a passing gleam, then specks of light. */}
        {grade > 1 && (
          <div className={`card-grade-fx card-grade-${fx} ${live ? '' : 'card-grade-calm'} pointer-events-none absolute inset-0`}>
            {fx >= 3 && fx <= 6 && (
              <>
                {live && <i className="card-grade-gleam" />}
                <i className="card-grade-edge" />
              </>
            )}
          </div>
        )}
        {/* Singularity: motes of light spiralling into the middle, and who took it there. */}
        {singularity && live && (
          <div className="card-singularity-motes pointer-events-none absolute inset-0 z-[6]" aria-hidden>
            {MOTES.map((m) => (
              <i key={m.a} style={{ ['--a' as string]: `${m.a}deg`, animationDelay: `${m.delay}s` }} />
            ))}
          </div>
        )}
        {(singularity || el) && engraving && (
          <p className="card-singularity-engraving absolute inset-x-[3cqw] bottom-[1.2cqw] z-[7] truncate text-center text-[3.5cqw] font-semibold">
            {engraving.by ? `${engraving.by} · ` : ''}
            {fromKey(engraving.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        )}
      </div>
      {/* Singularity: a disc of light bending round the card, the page going dark around it; cracks of light in its frame. */}
      {singularity && (
        <div className="pointer-events-none absolute inset-0 -z-10" style={lift(-12)}>
          <div className="card-singularity-disc">
            <div className="card-singularity-ring">
              <i />
            </div>
          </div>
        </div>
      )}
      {singularity && (
        <svg viewBox="0 0 100 140" preserveAspectRatio="none" className="card-singularity-cracks pointer-events-none absolute inset-0 size-full" aria-hidden>
          <path d="M0 22 L6 26 L4 34 L9 39 M6 26 L11 24 M16 0 L13 5 L19 9 L17 14 M100 58 L94 62 L96 71 L90 75 L92 82 M96 71 L100 74 M84 140 L87 134 L81 129 L83 123 M0 104 L5 100 L3 93 L8 89 M60 0 L58 4 L63 7 M100 118 L95 116 L92 122 L87 121 M30 140 L33 135 L28 131 L31 126" fill="none" vectorEffect="non-scaling-stroke" />
        </svg>
      )}
      {/* Earth: veins of gold glowing through the frame. */}
      {el?.overlay === 'veins' && (
        <svg viewBox="0 0 100 140" preserveAspectRatio="none" className="card-element-veins pointer-events-none absolute inset-0 size-full" aria-hidden>
          <path d="M0 30 L7 33 L9 41 L15 44 M7 33 L12 28 M22 0 L20 7 L26 11 M100 46 L93 50 L95 58 L89 63 M95 58 L100 61 M76 140 L78 132 L72 127 L75 120 M0 112 L6 108 L5 100 L11 96 M48 0 L50 5 L46 9 M100 124 L94 121 L90 127 M18 140 L21 134 L17 129" fill="none" vectorEffect="non-scaling-stroke" />
        </svg>
      )}
      {/* Up close, the picture itself bends. */}
      {singularity && depth && (
        <svg className="absolute size-0" aria-hidden>
          <filter id="card-singularity-warp" x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves={2} seed={7} />
            <feDisplacementMap in="SourceGraphic" xChannelSelector="R" yChannelSelector="G" scale="10">
              <animate attributeName="scale" values="4;26;4" dur="6s" repeatCount="indefinite" />
            </feDisplacementMap>
          </filter>
        </svg>
      )}
      {/* Celestial: rays of light turning behind the card. */}
      {fx === 6 && live && (
        <div className="pointer-events-none absolute inset-0 -z-10" style={lift(-12)}>
          <div className="card-grade-crown" />
        </div>
      )}
      {/* Gold and up: a light running round the frame, and a halo. */}
      {fx >= 4 && live && (
        <>
          <div className={`card-grade-orbit card-grade-orbit-${fx} pointer-events-none absolute inset-0 rounded-[7%]`}>
            <i />
          </div>
          <div className={`card-grade-halo card-grade-halo-${fx} pointer-events-none absolute inset-0 rounded-[7%]`} />
        </>
      )}

      {mythic && (
        <span className="card-mythic-ribbon absolute left-1/2 top-[-3.5cqw] -translate-x-1/2 rounded-full px-[4cqw] py-[1cqw] font-display text-[5cqw] font-black tracking-[0.3em] text-white shadow-lg" style={lift(40)}>
          <i aria-hidden />✦ MYTHIC
        </span>
      )}
      {/* A Fake Rarity: its true colours showing through at the edges of the mythic frame. */}
      {anomaly?.posesAsMythic && <div className="card-anomaly-remnant pointer-events-none absolute inset-0 z-[8] rounded-[7%]" style={{ background: RARITY_STYLE[card.rarity].frame }} />}
      {/* Corrupted: a scanline glitch running over the card. */}
      {anomaly?.scramble && live && <div className="card-anomaly-glitch pointer-events-none absolute inset-0 z-[9] rounded-[7%]" />}
      {/* Void-Touched: the dark over it all, but for a light — under the mouse, or wandering on its own. */}
      {anomaly?.void && (
        <div
          className={`card-void-veil pointer-events-none absolute inset-[3%] z-[9] rounded-[5%] ${!live ? 'card-void-calm' : mx === 50 && my === 50 ? 'card-void-wander' : ''}`}
          style={mx === 50 && my === 50 ? undefined : { ['--vx' as string]: `${mx}%`, ['--vy' as string]: `${my}%` }}
          aria-hidden
        />
      )}
      {/* Coming to life: light turning behind the card, and a cut-out picture stepping out of the frame. */}
      {heroOn && <div className="card-hero-rays pointer-events-none absolute -inset-[16%] -z-10 rounded-full" style={{ ['--glow' as string]: RARITY_LIGHT[look] }} />}
      {heroOn && form.cutout && <img src={form.image} alt="" draggable={false} className="card-hero-pop pointer-events-none absolute -left-[8%] -top-[16%] z-[15] h-[86%] w-[116%] max-w-none object-contain object-bottom" />}
      {/* Up close, in 3D: the near halves of the rings, in front of the card, and embers at every depth. */}
      {omni && depth && (
        <>
          <OmniRings half="full" />
          <OmniRings half="front" />
          {EMBERS.map((e, i) => (
            <span key={i} className="card-omni-ember" style={{ left: `${e.x}%`, top: `${e.y}%`, transform: `translateZ(${e.z}px)`, animationDelay: `${i * -0.6}s` }} />
          ))}
        </>
      )}
      {omni && (
        <span className="card-omni-crown absolute left-1/2 top-[-4.5cqw] -translate-x-1/2 whitespace-nowrap rounded-full px-[4.5cqw] py-[1.2cqw] font-display text-[5.2cqw] font-black tracking-[0.3em] shadow-lg" style={lift(50)}>
          ✪ OMNI
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
});

/** A card face down: the Omnidle back, coloured by rarity once it's known (the glow gives it away a moment early). */
export function CardBack({ rarity }: { rarity?: Rarity }) {
  return (
    <div
      className={`relative grid aspect-[5/7] w-full place-items-center rounded-[7%] border-[3px] bg-[#1b1530] [container-type:inline-size] ${rarity === 'omni' ? 'card-omni-back border-transparent' : rarity === 'mythic' ? 'card-mythic-back border-transparent' : 'border-[#a78bfa]'}`}
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
