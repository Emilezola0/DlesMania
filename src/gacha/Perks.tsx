// What cards do besides sitting in the album: any card can be the player's icon; a Rare or better
// one can stand behind every page, its glow growing with its rarity (a legendary's shimmers).
import { useEffect, useState, type CSSProperties } from 'react';
import { useProgress } from '../store/progress';
import { CardClip } from './CardClip';
import { CARD_BY_ID, RARITY_LIGHT, type Card, type Rarity } from './cards';
import { useCardForm } from './CardView';
import { useBackdropCue, useMomentOn } from './Reactions';

/** Rare or better: a common card isn't one to show off. */
export const canBeBackdrop = (c: Card) => c.rarity !== 'common';

const GLOW: Record<Rarity, number> = { common: 0, rare: 0.1, epic: 0.16, legendary: 0.22, mythic: 0.24, omni: 0.3 };

/** A clip that can loop in a corner of the page: an MP4 (not a YouTube or TikTok moment), motion allowed. */
const loops = (clip?: string): clip is string => !!clip && !/^(youtube|tiktok):/.test(clip) && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** The card as the player has it (its awakened form once awake), its clip playing if it has one, else its picture. */
function ShownPicture({ card, className, style, still }: { card: Card; className: string | ((awake: boolean) => string); style?: (awake: boolean) => CSSProperties | undefined; still?: boolean }) {
  const form = useCardForm(card);
  const cls = typeof className === 'string' ? className : className(form.awakened);
  const [failed, setFailed] = useState<string | null>(null);
  if (!still && loops(form.clip) && failed !== form.clip) return <CardClip src={form.clip} poster={form.image} onFail={() => setFailed(form.clip!)} className={cls} />;
  return <img src={form.image} alt="" draggable={false} className={cls} style={style?.(form.awakened)} />;
}

/** A card as a round icon, ringed in its rarity's colour: always its still picture (an icon never moves). */
export function CardAvatar({ card, className = 'size-6' }: { card: Card; className?: string }) {
  // The framing measured for the first form's still picture only.
  const framed = (awake: boolean) => (!awake ? card.focus : undefined);
  return (
    <span className={`block overflow-hidden rounded-full bg-[#0f0d16] ${className}`} style={{ boxShadow: `0 0 0 2px ${RARITY_LIGHT[card.rarity]}` }}>
      <ShownPicture
        card={card}
        still
        className={(awake) => `size-full object-cover ${framed(awake) ? '' : 'scale-125 object-top'}`}
        // A framed picture: its subject in the circle.
        style={(awake) => {
          const f = framed(awake);
          return f ? { objectPosition: `${f.x}% ${f.y}%`, transform: `scale(${Math.max(1.25, f.zoom * 0.7)})`, transformOrigin: `${f.x}% ${f.y}%` } : undefined;
        }}
      />
    </span>
  );
}

/**
 * The background card behind the whole page: its still picture (its video only plays on a win — the owner's rule),
 * covering the screen, on its subject. A cut-out one too (it used to sit in a corner, its clip looping).
 */
function FullBackdrop({ card }: { card: Card }) {
  const form = useCardForm(card);
  const f = !form.awakened ? card.focus : undefined;
  return (
    <img
      src={form.image}
      alt=""
      draggable={false}
      className="absolute inset-0 size-full object-cover opacity-[0.22]"
      style={f ? { objectPosition: `${f.x}% ${f.y}%` } : undefined}
    />
  );
}

/** The chosen card behind the pages: its still picture across the whole screen, with its rarity's glow. */
export function CardBackdrop() {
  // A background changed during a win's moment (by hand or by its rotation) shows once the moment's video is over: never cut.
  const chosen = useProgress((s) => s.backdrop);
  const momentOn = useMomentOn();
  const [id, setId] = useState(chosen);
  useEffect(() => {
    if (!momentOn) setId(chosen);
  }, [chosen, momentOn]);
  const owned = useProgress((s) => (id ? s.cards[id] : 0));
  const card = id ? CARD_BY_ID.get(id) : undefined;
  // A Legendary or Mythic background reacts to the play: it lights up, winces, or bursts.
  const cue = useBackdropCue(owned ? card : undefined);
  if (!card || !owned || !canBeBackdrop(card)) return null;
  const light = RARITY_LIGHT[card.rarity];
  const glow = Math.round(GLOW[card.rarity] * 255)
    .toString(16)
    .padStart(2, '0');
  return (
    <div key={cue?.key} className={`pointer-events-none fixed inset-0 -z-10 overflow-hidden ${cue ? `backdrop-${cue.kind}` : ''}`} style={{ ['--glow' as string]: light }} aria-hidden>
      <FullBackdrop card={card} />
      <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 85% 90%, ${light}${glow}, transparent 60%)` }} />
      {card.rarity === 'legendary' && <div className="backdrop-holo absolute inset-0" />}
    </div>
  );
}
