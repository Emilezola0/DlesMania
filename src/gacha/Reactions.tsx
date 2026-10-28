// Equipped cards that react to the play: a Legendary or Mythic icon pops up beside the header with
// a word in its franchise's voice (sometimes on a right answer, sometimes on a mistake, always on a
// big moment — a mythic then says its own line), and a Legendary or Mythic background lights up,
// winces or bursts behind the page. Hears every game through the sound cues (lib/sfx onCue);
// the player can turn it off (Account page).
import { useEffect, useRef, useState } from 'react';
import { onCue, type Cue } from '../lib/sfx';
import { useProgress } from '../store/progress';
import { CARD_BY_ID, RARITY_INFO, RARITY_LIGHT, type Card } from './cards';
import { CardAvatar } from './Perks';

/** Lines in each franchise's spirit (written for Omnidle), for a good moment and a bad one. */
export const REACTIONS: Record<string, { good: string[]; bad: string[] }> = {
  lol: { good: ['Outplayed!', "That's how you carry.", 'Clean as a pentakill.'], bad: ['Back to the fountain…', 'That was a misplay.', 'Report the jungler?'] },
  overwatch: { good: ['Play of the game!', 'Nice shot!', "Group up — we've got this."], bad: ['We need healing!', 'Ouch — wrong call.', 'Regroup and push again.'] },
  minecraft: { good: ['Diamonds!', 'Achievement get!', 'Perfectly crafted.'], bad: ['*hiss*… missed.', 'Fell in the lava…', 'Respawn and try again.'] },
  onepiece: { good: ['Shishishi! Nice one!', "That's my nakama!", 'Full speed ahead!'], bad: ['Oi oi, focus!', "The sea's rough today…", "Don't give up, captain!"] },
  dbz: { good: ['Your power level is rising!', "That's a Saiyan's answer!", 'Over nine thousand!'], bad: ['You need more training.', 'Back to the Time Chamber!', 'Your ki slipped…'] },
  naruto: { good: ["That's the ninja way!", 'A real shinobi move!', 'Not bad — for a genin!'], bad: ['Not your best jutsu…', 'Train harder!', 'Never give up — never!'] },
  starwars: { good: ['The Force is with you.', "A Jedi's answer.", 'Strong with knowledge, you are.'], bad: ['A disturbance in the Force…', 'Clouded, your mind is.', 'Trust your instincts.'] },
  harrypotter: { good: ['Ten points to your house!', 'Brilliant!', "That's proper magic."], bad: ['Ten points from your house…', 'Wrong spell!', "Even the best wizards miss a spell."] },
  lotr: { good: ['A fine choice, friend.', 'The Fellowship is proud.', 'Even the smallest can win.'], bad: ['One does not simply… miss.', 'The road goes ever on.', 'Second breakfast, then try again.'] },
  mcu: { good: ['Avengers material!', 'Nailed it.', 'Assemble!'], bad: ['Not this time.', 'Back to the lab.', 'We lost that one — regroup.'] },
  smash: { good: ['GAME!', 'Perfect combo!', 'A new champion!'], bad: ['Self-destruct…', 'Shield break!', 'Off the stage…'] },
  genshin: { good: ['Elemental reaction!', 'Five-star play!', 'Luck is on your side.'], bad: ['Only three stars…', 'Pity counter +1.', 'Out of stamina…'] },
  wow: { good: ['Epic loot!', 'Level up!', 'For Azeroth!'], bad: ['Wipe! Run back…', 'Repair your gear and retry.', 'Pulled too many…'] },
  inazuma: { good: ['GOAL!', "That's teamwork!", 'What a save!'], bad: ['Offside!', 'The keeper got that one…', 'Back to practice!'] },
};

const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
/** Legendary or better, and in the album. */
const showy = (id: string | null, cards: Record<string, number>): Card | undefined => {
  const c = id && cards[id] ? CARD_BY_ID.get(id) : undefined;
  return c && RARITY_INFO[c.rarity].rank >= 3 ? c : undefined;
};

/** The equipped background, if it reacts: the cue to show (kind and a key to replay it). */
export function useBackdropCue(card: Card | undefined): { kind: Cue; key: number } | null {
  const enabled = useProgress((s) => s.cardReactions ?? true);
  const [cue, setCue] = useState<{ kind: Cue; key: number } | null>(null);
  const last = useRef(0);
  useEffect(() => {
    if (!enabled || !card || RARITY_INFO[card.rarity].rank < 3) return;
    let timer = 0;
    const off = onCue((kind) => {
      const now = Date.now();
      if (kind !== 'great' && now - last.current < 700) return;
      last.current = now;
      setCue({ kind, key: now });
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setCue(null), kind === 'great' ? 1600 : 900);
    });
    return () => (off(), window.clearTimeout(timer));
  }, [enabled, card]);
  return cue;
}

/** The icon's reaction: a bubble by the header, the card's face and a word. */
export function CardReactions() {
  const enabled = useProgress((s) => s.cardReactions ?? true);
  const avatar = useProgress((s) => showy(s.avatar, s.cards));
  const [bubble, setBubble] = useState<{ kind: Cue; text: string; key: number } | null>(null);
  const last = useRef(0);
  useEffect(() => {
    if (!enabled || !avatar) return;
    let timer = 0;
    const off = onCue((kind) => {
      const now = Date.now();
      // Big moments always; otherwise now and then, so fast games don't drown in bubbles.
      if (kind !== 'great' && (now - last.current < 6000 || Math.random() > 0.45)) return;
      last.current = now;
      const lines = REACTIONS[avatar.set] ?? { good: ['Nice!'], bad: ['Oops…'] };
      const text = kind === 'great' && avatar.voice ? avatar.voice : pick(kind === 'bad' ? lines.bad : lines.good);
      setBubble({ kind, text, key: now });
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setBubble(null), 2600);
    });
    return () => (off(), window.clearTimeout(timer));
  }, [enabled, avatar]);

  if (!bubble || !avatar) return null;
  const light = RARITY_LIGHT[avatar.rarity];
  return (
    <div key={bubble.key} className="react-in pointer-events-none fixed right-3 top-14 z-40 flex max-w-[16rem] items-center gap-2" aria-live="polite">
      <p className="rounded-2xl rounded-tr-sm border-2 bg-card px-3 py-1.5 text-sm font-bold shadow-xl" style={{ borderColor: bubble.kind === 'bad' ? '#f87171' : light }}>
        <span className={avatar.rarity === 'mythic' && bubble.kind === 'great' ? 'card-mythic-name' : ''}>{bubble.text}</span>
      </p>
      <span className={`react-${bubble.kind} shrink-0 rounded-full`} style={{ ['--glow' as string]: light }}>
        <CardAvatar card={avatar} className="size-12" />
      </span>
    </div>
  );
}
