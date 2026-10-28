// What a run draws its rooms from: the franchises the player picked (every franchise of the
// kinds of work ticked — video games, anime, movies — or a hand-picked list), and the kinds of
// room they want.
import { HL_DECKS, type HlDeck } from '../arcade/higherLower';
import { NAME_LISTS } from '../arcade/lists';
import { SORT_DECKS, type SortDeck } from '../arcade/quickSort';
import { WHO_UNIVERSES } from '../arcade/whoAmI';
import { connectionThemes, type ThemeBank } from '../data';
import { BOSSES } from '../data/bosses';
import type { Domain } from '../types';
import type { ChallengeKind } from './run';

/** The kinds of work an Expedition can be made of. */
export const MEDIA: { id: Domain; label: string; icon: string }[] = [
  { id: 'games', label: 'Video games', icon: '🎮' },
  { id: 'anime', label: 'Anime', icon: '🌸' },
  { id: 'cinema', label: 'Movies', icon: '🎬' },
];

export const ALL_MEDIA: Domain[] = MEDIA.map((m) => m.id);
export const ALL_ROOMS: ChallengeKind[] = ['portrait', 'higherlower', 'odd', 'whoami', 'sort', 'name5'];

/** A franchise rooms can be drawn from. `works:<domain>` is every title of a kind (the release-year decks). */
export interface Franchise {
  key: string;
  label: string;
  domain: Domain;
}

/** Sources that go by another id than their franchise's. */
const SAME: Record<string, string> = { dbz: 'dragonball', marvel: 'mcu' };
const canon = (id: string) => SAME[id] ?? id;

/** A deck's franchise (decks of every title have none: their cards have a kind of work instead). */
const DECK_KEY: Record<string, string> = {
  bounty: 'onepiece',
  height: 'onepiece',
  boxoffice: 'mcu',
  'mcu-films': 'mcu',
  'lol-year': 'lol',
  'genshin-version': 'genshin',
  'lol-range': 'lol',
  'wow-faction': 'wow',
  'genshin-rarity': 'genshin',
  'marvel-status': 'mcu',
  'op-bounty': 'onepiece',
};

/** Name lists go by franchise name: the boss franchises, plus the whole-roster lists. */
const LIST_KEY: Record<string, string> = {
  ...Object.fromEntries(BOSSES.map((b) => [b.franchise, canon(b.id)])),
  'Genshin Impact': 'genshin',
  'League of Legends': 'lol',
  'Marvel Cinematic Universe': 'mcu',
};

const WORKS_LABEL = 'Release years (every title)';

/** Every franchise with something to play, grouped by kind of work. */
export const FRANCHISES: Franchise[] = (() => {
  const out = new Map<string, Franchise>();
  const add = (key: string, label: string, domain: Domain) => !out.has(key) && out.set(key, { key, label, domain });
  for (const b of BOSSES) add(canon(b.id), b.franchise, b.domain);
  for (const t of connectionThemes) add(canon(t.id), t.theme, t.domain);
  for (const u of WHO_UNIVERSES) add(canon(u.id), u.label, u.domain);
  for (const d of ALL_MEDIA) add(`works:${d}`, WORKS_LABEL, d);
  return [...out.values()].sort((a, b) => ALL_MEDIA.indexOf(a.domain) - ALL_MEDIA.indexOf(b.domain) || (a.key.startsWith('works:') ? 1 : 0) - (b.key.startsWith('works:') ? 1 : 0) || a.label.localeCompare(b.label));
})();

export const franchise = (key: string) => FRANCHISES.find((f) => f.key === key);

/** Every franchise of these kinds of work. */
export const keysFor = (media: Domain[]) => FRANCHISES.filter((f) => media.includes(f.domain)).map((f) => f.key);
export const ALL_KEYS = keysFor(ALL_MEDIA);

/** The kinds of work a set of franchises covers. */
export const mediaOfKeys = (keys: string[]) => ALL_MEDIA.filter((d) => keys.some((k) => franchise(k)?.domain === d));

/** A deck of every title keeps only the picked kinds' cards; it needs this many left to be played. */
const MIN_MIXED = 15;

export const universesFor = (keys: string[]) => WHO_UNIVERSES.filter((u) => keys.includes(canon(u.id)));

export function hlDecksFor(keys: string[]): HlDeck[] {
  return HL_DECKS.flatMap((d) => {
    if (d.domain !== 'mixed') return keys.includes(DECK_KEY[d.id]) ? [d] : [];
    const items = d.items.filter((x) => x.domain && keys.includes(`works:${x.domain}`));
    return items.length >= MIN_MIXED ? [{ ...d, items }] : [];
  });
}

export function sortDecksFor(keys: string[]): SortDeck[] {
  return SORT_DECKS.flatMap((d) => {
    if (d.domain !== 'mixed') return keys.includes(DECK_KEY[d.id]) ? [d] : [];
    const cards = d.cards.filter((x) => x.domain && keys.includes(`works:${x.domain}`));
    // Both sides must show up, or the deck is a giveaway.
    return cards.length >= MIN_MIXED && cards.some((c) => c.side === 'left') && cards.some((c) => c.side === 'right') ? [{ ...d, cards }] : [];
  });
}

/** Odd One Out boards from the picked franchises' themes. */
export const themeFilter = (keys: string[]) => (t: ThemeBank) => keys.includes(canon(t.id));

export const listsFor = (keys: string[]) => NAME_LISTS.filter((l) => l.answers.length >= 10 && keys.includes(LIST_KEY[l.franchise]));

export const bossesFor = (keys: string[]) => BOSSES.filter((b) => keys.includes(canon(b.id)));

/** The kinds of room these franchises can fill. */
function roomsWith(keys: string[]): ChallengeKind[] {
  const has: Record<ChallengeKind, boolean> = {
    portrait: universesFor(keys).length > 0,
    whoami: universesFor(keys).length > 0,
    higherlower: hlDecksFor(keys).length > 0,
    sort: sortDecksFor(keys).length > 0,
    odd: connectionThemes.some(themeFilter(keys)),
    name5: listsFor(keys).length > 0,
  };
  return ALL_ROOMS.filter((k) => has[k]);
}

/** The challenges a run can hold: the rooms asked for that the franchises can fill. */
export const challengesFor = (keys: string[], rooms: ChallengeKind[] = ALL_ROOMS) => roomsWith(keys).filter((k) => rooms.includes(k));

/** The rooms one franchise feeds (for its chip in the picker), and whether it has a guardian. */
export const roomsOf = (key: string) => roomsWith([key]);
export const hasBoss = (key: string) => bossesFor([key]).length > 0;
