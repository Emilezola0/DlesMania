import { shuffle } from '../lib/rng';
import { ONE_PIECE } from '../specialist/data';
import { GENSHIN } from '../specialist/genshin';
import { LOL } from '../specialist/lol';
import { MARVEL } from '../specialist/marvel';
import { WOW, telltaleTitles } from '../specialist/wow';

/** One face of a card: a picture, a few words, or both. */
export interface MemoryFace {
  image?: string;
  text?: string;
  /** Shown under the picture once the pair is found. */
  caption: string;
}

/** Two cards that go together: a Devil Fruit and its user, a champion and their ultimate... */
export interface MemoryPair {
  id: string;
  a: MemoryFace;
  b: MemoryFace;
}

export interface MemoryDeck {
  id: string;
  label: string;
  icon: string;
  /** "Match each Devil Fruit to its user". */
  rule: string;
  pairs: MemoryPair[];
}

const opByName = new Map(ONE_PIECE.characters.slice(0, 160).map((c) => [c.name, c]));

export const MEMORY_DECKS: MemoryDeck[] = [
  {
    id: 'fruits',
    label: 'Devil Fruits',
    icon: '🍈',
    rule: 'Match each Devil Fruit to its user.',
    pairs: ONE_PIECE.fruits.flatMap((f) => {
      const user = f.users.map((u) => opByName.get(u)).find(Boolean);
      return f.image && user ? [{ id: f.id, a: { image: f.image, caption: f.name }, b: { image: user.image, caption: user.name } }] : [];
    }),
  },
  {
    id: 'ultimates',
    label: 'League ultimates',
    icon: '⚔️',
    rule: 'Match each champion to their ultimate.',
    pairs: LOL.champions.flatMap((c) => {
      const r = c.abilities.find((a) => a.key === 'R');
      return r ? [{ id: c.id, a: { image: c.image, caption: c.name }, b: { image: r.icon, caption: r.name } }] : [];
    }),
  },
  {
    id: 'constellations',
    label: 'Genshin constellations',
    icon: '✨',
    rule: 'Match each character to their constellation.',
    pairs: GENSHIN.characters.flatMap((c) => (c.constellation ? [{ id: c.id, a: { image: c.image, caption: c.name }, b: { text: `✦ ${c.constellation}`, caption: c.constellation } }] : [])),
  },
  {
    id: 'actors',
    label: 'MCU actors',
    icon: '🎭',
    rule: 'Match each character to the actor who plays them.',
    pairs: MARVEL.characters
      .slice(0, 120)
      .flatMap((c) => (c.castable && c.actor ? [{ id: c.id, a: { image: c.image, caption: c.name }, b: { text: c.actor, caption: c.actor } }] : [])),
  },
  {
    id: 'titles',
    label: 'Warcraft titles',
    icon: '🐉',
    rule: 'Match each character to one of their titles.',
    pairs: WOW.characters.flatMap((c) => {
      const t = telltaleTitles(c)[0];
      return t ? [{ id: c.id, a: { image: c.image, caption: c.name }, b: { text: `“${t}”`, caption: t } }] : [];
    }),
  },
];

export const memoryDeck = (id: string | undefined) => MEMORY_DECKS.find((d) => d.id === id);

/** Pairs on a board. */
export const PAIRS_PER_GAME = 8;

/** A card on the board: which pair, which side. */
export interface MemoryCard {
  key: string;
  pair: string;
  face: MemoryFace;
}

/** A shuffled board of PAIRS_PER_GAME pairs, both cards of each. */
export function dealBoard(deck: MemoryDeck, rand: () => number = Math.random): MemoryCard[] {
  const pairs = shuffle(deck.pairs, rand).slice(0, PAIRS_PER_GAME);
  return shuffle(
    pairs.flatMap((p) => [
      { key: `${p.id}-a`, pair: p.id, face: p.a },
      { key: `${p.id}-b`, pair: p.id, face: p.b },
    ]),
    rand,
  );
}

/** Points for a finished board: fewer flips and less time score more. */
export const memoryScore = (moves: number, seconds: number) => Math.max(0, 1000 - Math.max(0, moves - PAIRS_PER_GAME) * 30 - seconds * 3);
