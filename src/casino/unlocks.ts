// What a player has earned by playing (never by luck): the earned icon frames (src/casino/frames.ts
// EARNED_FRAMES and a frame per full set) and the profile titles. Worked out from the save each time, so
// nothing new is stored: a streak reached stays reached (the best streak), a set completed stays completed
// while its cards are owned.
import { useMemo } from 'react';
import { BOSSES } from '../data/bosses';
import { COLLECTIBLE, SETS } from '../gacha/cards';
import { bossKey, computeStreak, useProgress } from '../store/progress';
import { TITLE_ITEMS } from './cosmetics';
import { FRAMES } from './frames';

type Save = ReturnType<typeof useProgress.getState>;

/** The cards of each set (the ones that count for a full set). */
const SET_CARDS = new Map<string, string[]>();
for (const c of COLLECTIBLE) SET_CARDS.set(c.set, [...(SET_CARDS.get(c.set) ?? []), c.id]);

/** The bosses that count for "every boss on Hard": the franchises' (not the Language tab's). */
const HARD_BOSSES = BOSSES.filter((b) => b.category !== 'language');

export interface Feats {
  bestStreak: number;
  /** Sets completed in the Album. */
  sets: string[];
  packs: number;
  mythic: boolean;
  omni: boolean;
  hardWins: number;
  hardAll: boolean;
  hellWins: number;
  /** Every frame of the machine won (seasonal ones aside). */
  allFrames: boolean;
  /** The Boutique's cosmetics bought (bought titles among them). */
  bought: string[];
}

/** Dev only (the Test lab): localStorage "omnidle-dev-all-feats" = "1" counts every feat as done (titles, earned frames). */
export const DEV_ALL_FEATS = 'omnidle-dev-all-feats';
const allFeats = (): boolean => {
  if (!import.meta.env.DEV) return false;
  try {
    return localStorage.getItem(DEV_ALL_FEATS) === '1';
  } catch {
    return false;
  }
};

export function featsOf(s: Pick<Save, 'days' | 'cards' | 'bosses' | 'packsOpened' | 'frames' | 'cosmetics'>): Feats {
  if (allFeats())
    return { bestStreak: 999, sets: SETS.map((set) => set.id), packs: 9999, mythic: true, omni: true, hardWins: HARD_BOSSES.length, hardAll: true, hellWins: HARD_BOSSES.length, allFrames: true, bought: TITLE_ITEMS.map((t) => t.id) };
  const owned = s.cards ?? {};
  const wonOn = (id: string, d: 'hard' | 'hell') => (s.bosses?.[bossKey(id, d)]?.wins ?? 0) > 0;
  // A win counts for every lower difficulty too: Hell beats Hard.
  const hard = HARD_BOSSES.filter((b) => wonOn(b.id, 'hard') || wonOn(b.id, 'hell'));
  const frames = new Set(s.frames ?? []);
  let mythic = false;
  let omni = false;
  for (const c of COLLECTIBLE) {
    if (!owned[c.id]) continue;
    if (c.rarity === 'mythic') mythic = true;
    if (c.rarity === 'omni') omni = true;
  }
  return {
    bestStreak: computeStreak(s.days ?? {}).best,
    sets: SETS.filter((set) => (SET_CARDS.get(set.id)?.length ?? 0) > 0 && SET_CARDS.get(set.id)!.every((id) => owned[id])).map((set) => set.id),
    packs: s.packsOpened ?? 0,
    mythic,
    omni,
    hardWins: hard.length,
    hardAll: hard.length === HARD_BOSSES.length,
    hellWins: HARD_BOSSES.filter((b) => wonOn(b.id, 'hell')).length,
    allFrames: FRAMES.filter((f) => !f.season).every((f) => frames.has(f.id)),
    bought: s.cosmetics ?? [],
  };
}

/** The earned frames' ids this player has. */
export function earnedFrames(f: Feats): Set<string> {
  const out = new Set<string>();
  if (f.bestStreak >= 7) out.add('streak-7');
  if (f.bestStreak >= 30) out.add('streak-30');
  if (f.bestStreak >= 100) out.add('streak-100');
  if (f.hardAll) out.add('boss-hard');
  for (const id of f.sets) out.add(`album-${id}`);
  return out;
}

/** Profile titles, shown under the player's name: earned by playing, or bought in the Casino's Boutique. */
export const TITLES: { id: string; name: string; how: string; has: (f: Feats) => boolean }[] = [
  { id: 'newcomer', name: 'Newcomer', how: 'Everyone starts here', has: () => true },
  { id: 'regular', name: 'Regular', how: 'A 7-day streak', has: (f) => f.bestStreak >= 7 },
  { id: 'devoted', name: 'Devoted', how: 'A 30-day streak', has: (f) => f.bestStreak >= 30 },
  { id: 'unbroken', name: 'Unbroken', how: 'A 100-day streak', has: (f) => f.bestStreak >= 100 },
  { id: 'pack-rat', name: 'Pack Rat', how: 'Open 100 packs', has: (f) => f.packs >= 100 },
  { id: 'collector', name: 'Collector', how: 'Complete a set in the Album', has: (f) => f.sets.length >= 1 },
  { id: 'archivist', name: 'Archivist', how: 'Complete 5 sets', has: (f) => f.sets.length >= 5 },
  { id: 'mythic-seeker', name: 'Mythic Seeker', how: 'Own a Mythic card', has: (f) => f.mythic },
  { id: 'omni-hunter', name: 'Omni Hunter', how: 'Own an Omni card', has: (f) => f.omni },
  { id: 'boss-slayer', name: 'Boss Slayer', how: 'Beat a boss on Hard', has: (f) => f.hardWins >= 1 },
  { id: 'conqueror', name: 'Conqueror', how: 'Beat every boss on Hard', has: (f) => f.hardAll },
  { id: 'hell-walker', name: 'Hell Walker', how: 'Beat a boss on Hell', has: (f) => f.hellWins >= 1 },
  { id: 'frame-hoarder', name: 'Frame Hoarder', how: "Win every frame in the capsule machine (seasonal ones aside)", has: (f) => f.allFrames },
  ...TITLE_ITEMS.map((t) => ({ id: t.id.slice('title:'.length), name: t.name, how: t.price || t.tokens ? "Sold in the Casino's Boutique" : 'Won at the claw machine', has: (f: Feats) => f.bought.includes(t.id) })),
];
export const TITLE_BY_ID = new Map(TITLES.map((t) => [t.id, t]));

/** This player's feats, kept up to date (worked out again only when what they depend on changes). */
export function useFeats(): Feats {
  const days = useProgress((s) => s.days);
  const cards = useProgress((s) => s.cards);
  const bosses = useProgress((s) => s.bosses);
  const packsOpened = useProgress((s) => s.packsOpened);
  const frames = useProgress((s) => s.frames);
  const cosmetics = useProgress((s) => s.cosmetics);
  return useMemo(() => featsOf({ days, cards, bosses, packsOpened, frames, cosmetics }), [days, cards, bosses, packsOpened, frames, cosmetics]);
}
