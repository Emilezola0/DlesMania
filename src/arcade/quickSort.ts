import { WORKS, domainInfo } from '../data';
import { ONE_PIECE, formatBounty } from '../specialist/data';
import { GENSHIN } from '../specialist/genshin';
import { LOL } from '../specialist/lol';
import { MARVEL } from '../specialist/marvel';
import { WOW } from '../specialist/wow';
import type { Domain } from '../types';
import { JLPT_THEMES, shortMeaning } from './jlpt';
import { kanjiPicture } from '../lib/kanji';

/** Something to sort: which side it goes, and what shows once it's sorted. */
export interface SortCard {
  id: string;
  name: string;
  image?: string;
  side: 'left' | 'right';
  /** The fact behind its side ("Ranged", "Released 1998"...). */
  fact: string;
  /** In a deck of every kind of work: which kind this one is. */
  domain?: Domain;
}

export interface SortDeck {
  id: string;
  label: string;
  icon: string;
  left: string;
  right: string;
  /** What the deck is about ("mixed": every kind of work, see each card's own). */
  domain: Domain | 'mixed';
  cards: SortCard[];
}

const BOUNTY_LINE = 500_000_000;
const YEAR_LINE = 2000;

/**
 * JLPT: the list's words (N5 to N3) from two of its theme decks — which side is each? Once sorted, a word
 * shows its reading and meaning. A word in both themes is left out.
 */
const JLPT_SORTS: [string, string, string][] = [
  ['animals', 'food', '🐾'],
  ['body', 'nature', '🫀'],
  ['family', 'places', '👪'],
  ['time', 'school', '📅'],
];
function jlptSort(a: string, b: string, icon: string): SortDeck {
  const [ta, tb] = [a, b].map((id) => JLPT_THEMES.find((t) => t.id === `theme-${id}`)!);
  const keep = (e: { level: string }) => e.level === 'N5' || e.level === 'N4' || e.level === 'N3';
  const inB = new Set(tb.entries.map((e) => e.text));
  const inA = new Set(ta.entries.map((e) => e.text));
  const seen = new Set<string>();
  const card = (side: 'left' | 'right') => (e: (typeof ta.entries)[number]) =>
    seen.has(e.text) || !seen.add(e.text) ? [] : [{ id: e.id, name: e.text, image: kanjiPicture(`kanji:${e.text}`), side, fact: `${e.reading} · ${shortMeaning(e.meaning, 2)}` }];
  return {
    id: `jlpt-${a}-${b}`,
    domain: 'anime',
    label: `JLPT: ${ta.label.toLowerCase()} or ${tb.label.toLowerCase()}?`,
    icon,
    left: ta.label,
    right: tb.label,
    cards: [...ta.entries.filter((e) => keep(e) && !inB.has(e.text)).flatMap(card('left')), ...tb.entries.filter((e) => keep(e) && !inA.has(e.text)).flatMap(card('right'))],
  };
}

export const SORT_DECKS: SortDeck[] = [
  {
    id: 'lol-range',
    domain: 'games',
    label: 'League: melee or ranged?',
    icon: '⚔️',
    left: 'Melee',
    right: 'Ranged',
    cards: LOL.champions.filter((c) => c.range === 'Melee' || c.range === 'Ranged').map((c) => ({ id: c.id, name: c.name, image: c.image, side: c.range === 'Melee' ? 'left' : 'right', fact: c.range })),
  },
  {
    id: 'wow-faction',
    domain: 'games',
    label: 'Warcraft: Horde or Alliance?',
    icon: '🐉',
    left: 'Horde',
    right: 'Alliance',
    cards: WOW.characters
      .filter((c) => c.faction === 'Horde' || c.faction === 'Alliance')
      .map((c) => ({ id: c.id, name: c.name, image: c.image, side: c.faction === 'Horde' ? 'left' : 'right', fact: c.faction })),
  },
  {
    id: 'genshin-rarity',
    domain: 'games',
    label: 'Genshin: 4★ or 5★?',
    icon: '✨',
    left: '4★',
    right: '5★',
    cards: GENSHIN.characters.map((c) => ({ id: c.id, name: c.name, image: c.image, side: c.rarity === 5 ? 'right' : 'left', fact: `${c.rarity}★` })),
  },
  {
    id: 'marvel-status',
    domain: 'cinema',
    label: 'MCU: alive or dead?',
    icon: '🦸',
    left: 'Alive',
    right: 'Deceased',
    cards: MARVEL.characters
      .slice(0, 120)
      .filter((c) => c.status === 'Alive' || c.status === 'Deceased')
      .map((c) => ({ id: c.id, name: c.name, image: c.image, side: c.status === 'Alive' ? 'left' : 'right', fact: c.status })),
  },
  {
    id: 'op-bounty',
    domain: 'anime',
    label: 'One Piece: bounty under or over 500M?',
    icon: '💰',
    left: 'Under 500M',
    right: 'Over 500M',
    cards: ONE_PIECE.characters
      .filter((c) => c.bounty > 0)
      .map((c) => ({ id: c.id, name: c.name, image: c.image, side: c.bounty >= BOUNTY_LINE ? 'right' : 'left', fact: `${formatBounty(c.bounty)} berries` })),
  },
  {
    id: 'works-year',
    domain: 'mixed',
    label: `Released before or after ${YEAR_LINE}?`,
    icon: '📅',
    left: `Before ${YEAR_LINE}`,
    right: `${YEAR_LINE} or later`,
    cards: WORKS.filter((w) => w.cover?.image).map((w) => ({
      id: w.id,
      name: w.name,
      image: w.cover!.image,
      side: w.year >= YEAR_LINE ? 'right' : 'left',
      fact: `${domainInfo(w.domain).noun} · ${w.year}`,
      domain: w.domain,
    })),
  },
  ...JLPT_SORTS.map(([a, b, icon]) => jlptSort(a, b, icon)),
];

export const sortDeck = (id: string | undefined) => SORT_DECKS.find((d) => d.id === id);

export const SORT_LIVES = 3;
/** Seconds per card: from the first to the floor, a little less after each sort. */
export const sortSeconds = (sorted: number) => Math.max(1.3, 3.5 - sorted * 0.06);
