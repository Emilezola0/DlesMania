import { WORKS, domainInfo } from '../data';
import { ONE_PIECE, formatBounty } from '../specialist/data';
import { GENSHIN } from '../specialist/genshin';
import { LOL } from '../specialist/lol';
import { MARVEL } from '../specialist/marvel';

/** Something to compare: its number, and how that number reads. */
export interface HlItem {
  id: string;
  name: string;
  image?: string;
  /** Under the name: what it is ("Game · 1998"...), never the value itself. */
  detail?: string;
  value: number;
  shown: string;
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
  items: HlItem[];
}

/** "$1.405 billion" → 1405 (millions); the first amount wins when the field has more. */
function boxOffice(text: string): number {
  const m = text.match(/\$([\d.,]+)\s*(million|billion)/i);
  if (!m) return 0;
  const n = Number(m[1].replace(/,/g, ''));
  return Math.round(m[2].toLowerCase() === 'billion' ? n * 1000 : n);
}

const versionValue = (v: string) => v.split('.').map(Number).reduce((n, x, i) => n + x * (i ? 1 : 100), 0);

export const HL_DECKS: HlDeck[] = [
  {
    id: 'bounty',
    label: 'One Piece bounties',
    question: 'Whose bounty is higher?',
    higher: 'Higher bounty',
    lower: 'Lower bounty',
    icon: '💰',
    items: ONE_PIECE.characters.filter((c) => c.bounty > 0).map((c) => ({ id: c.id, name: c.name, image: c.image, detail: c.affiliation, value: c.bounty, shown: `${formatBounty(c.bounty)} berries` })),
  },
  {
    id: 'height',
    label: 'One Piece heights',
    question: 'Who is taller?',
    higher: 'Taller',
    lower: 'Shorter',
    icon: '📏',
    items: ONE_PIECE.characters.filter((c) => c.height > 0).map((c) => ({ id: c.id, name: c.name, image: c.image, detail: c.affiliation, value: c.height, shown: `${c.height} cm` })),
  },
  {
    id: 'boxoffice',
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
    label: 'MCU appearances',
    question: 'Who is in more MCU films?',
    higher: 'More films',
    lower: 'Fewer films',
    icon: '🎬',
    items: MARVEL.characters.map((c) => ({ id: c.id, name: c.name, image: c.image, detail: c.team, value: c.films, shown: `${c.films} film${c.films === 1 ? '' : 's'}` })),
  },
  {
    id: 'lol-year',
    label: 'League release years',
    question: 'Which champion came out later?',
    higher: 'Later',
    lower: 'Earlier',
    icon: '🗓️',
    items: LOL.champions.filter((c) => c.year > 0).map((c) => ({ id: c.id, name: c.name, image: c.image, detail: c.title, value: c.year, shown: `Released ${c.year}` })),
  },
  {
    id: 'genshin-version',
    label: 'Genshin release versions',
    question: 'Which character came out later?',
    higher: 'Later',
    lower: 'Earlier',
    icon: '✨',
    items: GENSHIN.characters.map((c) => ({ id: c.id, name: c.name, image: c.image, detail: `${c.element} · ${c.region}`, value: versionValue(c.version), shown: `Version ${c.version}` })),
  },
  {
    id: 'works-year',
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
