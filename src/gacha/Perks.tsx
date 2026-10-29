// What cards do besides sitting in the album: any card can be the player's icon; a Rare or better
// one can stand behind every page, its glow growing with its rarity (a legendary's shimmers).
import { useProgress } from '../store/progress';
import { CARD_BY_ID, RARITY_LIGHT, type Card, type Rarity } from './cards';
import { useBackdropCue } from './Reactions';

/** Rare or better: a common card isn't one to show off. */
export const canBeBackdrop = (c: Card) => c.rarity !== 'common';

const GLOW: Record<Rarity, number> = { common: 0, rare: 0.1, epic: 0.16, legendary: 0.22, mythic: 0.24, omni: 0.3 };

/** A card as a round icon, ringed in its rarity's colour. */
export function CardAvatar({ card, className = 'size-6' }: { card: Card; className?: string }) {
  return (
    <span className={`block overflow-hidden rounded-full bg-[#0f0d16] ${className}`} style={{ boxShadow: `0 0 0 2px ${RARITY_LIGHT[card.rarity]}` }}>
      <img src={card.image} alt="" draggable={false} className="size-full scale-125 object-cover object-top" />
    </span>
  );
}

/** The chosen card behind the pages: faded into the corner, with its rarity's glow. */
export function CardBackdrop() {
  const id = useProgress((s) => s.backdrop);
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
      <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 85% 90%, ${light}${glow}, transparent 60%)` }} />
      <img
        src={card.image}
        alt=""
        className="absolute -right-[4vw] bottom-0 h-[62vh] max-w-[70vw] object-contain opacity-[0.14] sm:h-[85vh] sm:max-w-[55vw]"
        style={{ maskImage: 'linear-gradient(to left, #000 45%, transparent)', WebkitMaskImage: 'linear-gradient(to left, #000 45%, transparent)' }}
      />
      {card.rarity === 'legendary' && <div className="backdrop-holo absolute inset-0" />}
    </div>
  );
}
