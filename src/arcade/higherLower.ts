import { WORKS, domainInfo } from '../data';
import { ONE_PIECE, formatBounty } from '../specialist/data';
import { GENSHIN } from '../specialist/genshin';
import { LOL } from '../specialist/lol';
import { MARVEL } from '../specialist/marvel';
import { DRAGON_BALL, HARRY_POTTER, MINECRAFT, NARUTO, STAR_WARS, formatKi } from '../specialist/extra';
import { SIMPLE } from '../specialist/simple';
import type { Domain } from '../types';

/** Something to compare: its number, and how that number reads. */
export interface HlItem {
  id: string;
  name: string;
  image?: string;
  /** Under the name: what it is ("Game · 1998"...), never the value itself. */
  detail?: string;
  value: number;
  shown: string;
  /** In a deck of every kind of work: which kind this one is. */
  domain?: Domain;
}

export interface HlDeck {
  id: string;
  label: string;
  /** "Who has the higher bounty?" */
  question: string;
  /** Button words: what "higher" and "lower" mean here. */
  higher: string;
  lower: string;
  icon: string;
  /** What the deck is about ("mixed": every kind of work, see each item's own). */
  domain: Domain | 'mixed';
  items: HlItem[];
}

/** "$1.405 billion" → 1405 (millions); the first amount wins when the field has more. */
function boxOffice(text: string): number {
  const m = text.match(/\$([\d.,]+)\s*(million|billion)/i);
  if (!m) return 0;
  const n = Number(m[1].replace(/,/g, ''));
  return Math.round(m[2].toLowerCase() === 'billion' ? n * 1000 : n);
}

/** The first number in a field ("250", "225 (+50 armor)"). */
const firstNumber = (s: string | undefined) => Number(/\d+(?:\.\d+)?/.exec(s ?? '')?.[0] ?? 0);
const versionValue = (v: string) => v.split('.').map(Number).reduce((n, x, i) => n + x * (i ? 1 : 100), 0);

export const HL_DECKS: HlDeck[] = [
  {
    id: 'bounty',
    domain: 'anime',
    label: 'One Piece bounties',
    question: 'Whose bounty is higher?',
    higher: 'Higher bounty',
    lower: 'Lower bounty',
    icon: '💰',
    items: ONE_PIECE.characters.filter((c) => c.bounty > 0).map((c) => ({ id: c.id, name: c.name, image: c.image, detail: c.affiliation, value: c.bounty, shown: `${formatBounty(c.bounty)} berries` })),
  },
  {
    id: 'height',
    domain: 'anime',
    label: 'One Piece heights',
    question: 'Who is taller?',
    higher: 'Taller',
    lower: 'Shorter',
    icon: '📏',
    items: ONE_PIECE.characters.filter((c) => c.height > 0).map((c) => ({ id: c.id, name: c.name, image: c.image, detail: c.affiliation, value: c.height, shown: `${c.height} cm` })),
  },
  {
    id: 'boxoffice',
    domain: 'cinema',
    label: 'MCU box office',
    question: 'Which film made more at the box office?',
    higher: 'More',
    lower: 'Less',
    icon: '🎟️',
    items: MARVEL.films
      .map((f) => ({ id: f.id, name: f.name, image: f.poster, detail: `Phase ${f.phase} · ${f.year}`, value: boxOffice(f.boxOffice ?? ''), shown: '' }))
      .filter((f) => f.value > 0)
      .map((f) => ({ ...f, shown: f.value >= 1000 ? `$${(f.value / 1000).toFixed(2)} billion` : `$${f.value} million` })),
  },
  {
    id: 'mcu-films',
    domain: 'cinema',
    label: 'MCU appearances',
    question: 'Who is in more MCU films?',
    higher: 'More films',
    lower: 'Fewer films',
    icon: '🎬',
    items: MARVEL.characters.map((c) => ({ id: c.id, name: c.name, image: c.image, detail: c.team, value: c.films, shown: `${c.films} film${c.films === 1 ? '' : 's'}` })),
  },
  {
    id: 'lol-year',
    domain: 'games',
    label: 'League release years',
    question: 'Which champion came out later?',
    higher: 'Later',
    lower: 'Earlier',
    icon: '🗓️',
    items: LOL.champions.filter((c) => c.year > 0).map((c) => ({ id: c.id, name: c.name, image: c.image, detail: c.title, value: c.year, shown: `Released ${c.year}` })),
  },
  {
    id: 'genshin-version',
    domain: 'games',
    label: 'Genshin release versions',
    question: 'Which character came out later?',
    higher: 'Later',
    lower: 'Earlier',
    icon: '✨',
    items: GENSHIN.characters.map((c) => ({ id: c.id, name: c.name, image: c.image, detail: `${c.element} · ${c.region}`, value: versionValue(c.version), shown: `Version ${c.version}` })),
  },
  {
    id: 'hp-wand',
    domain: 'cinema',
    label: 'Harry Potter wands',
    question: 'Whose wand is longer?',
    higher: 'Longer',
    lower: 'Shorter',
    icon: '🪄',
    items: HARRY_POTTER.filter((c) => c.wandLength > 0).map((c) => ({ id: c.id, name: c.name, image: c.image || undefined, detail: c.house || c.role || c.species, value: c.wandLength, shown: `${c.wandLength} inches` })),
  },
  {
    id: 'sw-height',
    domain: 'cinema',
    label: 'Star Wars heights',
    question: 'Who is taller?',
    higher: 'Taller',
    lower: 'Shorter',
    icon: '📏',
    items: STAR_WARS.filter((c) => c.height > 0).map((c) => ({ id: c.id, name: c.name, image: c.image || undefined, detail: [c.species, c.homeworld].filter(Boolean).join(' · '), value: c.height, shown: `${(c.height / 100).toFixed(2)} m` })),
  },
  {
    id: 'naruto-height',
    domain: 'anime',
    label: 'Naruto heights',
    question: 'Who is taller (Part II)?',
    higher: 'Taller',
    lower: 'Shorter',
    icon: '🍥',
    items: NARUTO.filter((c) => c.height > 0).map((c) => ({ id: c.id, name: c.name, image: c.image, detail: c.village, value: c.height, shown: `${c.height} cm` })),
  },
  {
    id: 'dbz-ki',
    domain: 'anime',
    label: 'Dragon Ball max ki',
    question: 'Whose ki is higher at its peak?',
    higher: 'Higher',
    lower: 'Lower',
    icon: '💥',
    items: DRAGON_BALL.filter((c) => c.maxKiValue > 0).map((c) => ({ id: c.id, name: c.name, image: c.image, detail: c.race, value: c.maxKiValue, shown: `${formatKi(c.maxKiValue)} ki` })),
  },
  {
    id: 'ow-health',
    domain: 'games',
    label: 'Overwatch hero health',
    question: 'Which hero has more health?',
    higher: 'More',
    lower: 'Less',
    icon: '🎯',
    items: SIMPLE.overwatch.characters.filter((c) => firstNumber(c.traits.Health) > 0).map((c) => ({ id: c.id, name: c.name, image: c.image || undefined, detail: c.traits.Role, value: firstNumber(c.traits.Health), shown: `${firstNumber(c.traits.Health)} health` })),
  },
  {
    id: 'fh-health',
    domain: 'games',
    label: 'For Honor hero health',
    question: 'Which hero has more health?',
    higher: 'More',
    lower: 'Less',
    icon: '🛡️',
    items: SIMPLE.forhonor.characters.filter((c) => firstNumber(c.traits.Health) > 0).map((c) => ({ id: c.id, name: c.name, image: c.image || undefined, detail: `${c.traits.Faction} · ${c.traits.Class}`, value: firstNumber(c.traits.Health), shown: `${firstNumber(c.traits.Health)} health` })),
  },
  {
    id: 'mc-food',
    domain: 'games',
    label: 'Minecraft foods',
    question: 'Which food fills more hunger?',
    higher: 'More',
    lower: 'Less',
    icon: '🍗',
    items: MINECRAFT.foods.map((f) => ({ id: f.id, name: f.name, image: f.image, detail: 'Food', value: f.hunger, shown: `${f.hunger} hunger points` })),
  },
  {
    id: 'mc-hardness',
    domain: 'games',
    label: 'Minecraft block hardness',
    question: 'Which block is harder to break?',
    higher: 'Harder',
    lower: 'Softer',
    icon: '⛏️',
    items: MINECRAFT.blocks.map((b) => ({ id: b.id, name: b.name, image: b.image, detail: 'Block', value: b.hardness, shown: `Hardness ${b.hardness}` })),
  },
  {
    id: 'works-year',
    domain: 'mixed',
    label: 'Release years',
    question: 'Which one came out later?',
    higher: 'Later',
    lower: 'Earlier',
    icon: '📅',
    items: WORKS.filter((w) => w.cover?.image).map((w) => ({
      id: w.id,
      name: w.name,
      image: w.cover!.image,
      detail: domainInfo(w.domain).noun[0].toUpperCase() + domainInfo(w.domain).noun.slice(1),
      value: w.year,
      shown: String(w.year),
      domain: w.domain,
    })),
  },
];

export const hlDeck = (id: string | undefined) => HL_DECKS.find((d) => d.id === id);

/** The next challenger: not shown lately and, when possible, with a different value (ties are free points). */
export function nextItem(deck: HlDeck, current: HlItem | undefined, recent: Set<string>, rand: () => number = Math.random): HlItem {
  const fresh = deck.items.filter((x) => x !== current && !recent.has(x.id));
  const pool = fresh.length ? fresh : deck.items.filter((x) => x !== current);
  const different = pool.filter((x) => !current || x.value !== current.value);
  const from = different.length ? different : pool;
  return from[Math.floor(rand() * from.length)];
}
