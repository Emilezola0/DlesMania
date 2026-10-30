import { shuffle } from '../lib/rng';
import { ONE_PIECE } from '../specialist/data';
import { GENSHIN } from '../specialist/genshin';
import { LOL } from '../specialist/lol';
import { MARVEL } from '../specialist/marvel';
import { WOW, telltaleTitles } from '../specialist/wow';
import { JLPT_LEVELS, shortMeaning } from './jlpt';

/** One face of a card: a picture, a few words, or both. */
export interface MemoryFace {
  image?: string;
  text?: string;
  /** A short text shown big (a kanji, a word). */
  big?: boolean;
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

/**
 * JLPT pairs, from the list only: a kanji and its meaning, a word and its meaning, a kanji and a word
 * written with it (only that kanji in it), a katakana word and its meaning. Never a kanji and its
 * reading: many kanji share one. On a board no two cards say the same thing (meanings, kanji and
 * words are each used once in the deck), and once found each card shows its reading.
 */
export const JLPT_PAIR_TYPES = [
  { key: 'kanji-meaning', label: '字 Kanji ↔ meaning' },
  { key: 'word-meaning', label: '語 Word ↔ meaning' },
  { key: 'kanji-word', label: '字↔語 Kanji ↔ a word written with it' },
  { key: 'katakana-meaning', label: 'カ Katakana word ↔ meaning' },
] as const;

const KANJI_RE = /[㐀-鿿]/g;
const KATAKANA_ONLY = /^[゠-ヿー・]+$/;

export function jlptPairs(picks: string[]): MemoryPair[] {
  const levels = JLPT_LEVELS.filter((l) => picks.includes(l.level));
  const kanji = levels.flatMap((l) => l.decks.find((d) => d.kind === 'kanji')!.entries);
  const words = levels.flatMap((l) => l.decks.find((d) => d.kind === 'vocab')!.entries);
  const used = new Set<string>();
  /** Each text (a kanji, a word, a meaning) on one pair only, so a card has one match. */
  const fresh = (...texts: string[]) => {
    if (texts.some((t) => used.has(t))) return false;
    texts.forEach((t) => used.add(t));
    return true;
  };
  const meaning = (m: string) => shortMeaning(m, 2);
  const out: MemoryPair[] = [];
  if (picks.includes('kanji-meaning'))
    for (const k of kanji) if (fresh(k.text, meaning(k.meaning))) out.push({ id: `km:${k.id}`, a: { text: k.text, big: true, caption: k.reading }, b: { text: meaning(k.meaning), caption: `${k.text} · ${k.reading}` } });
  if (picks.includes('word-meaning'))
    for (const w of words)
      if (w.text.match(KANJI_RE) && fresh(w.text, meaning(w.meaning))) out.push({ id: `wm:${w.id}`, a: { text: w.text, big: true, caption: w.reading }, b: { text: meaning(w.meaning), caption: `${w.text} · ${w.reading}` } });
  if (picks.includes('kanji-word'))
    for (const k of kanji) {
      const w = words.find((x) => (x.text.match(KANJI_RE) ?? []).length === 1 && x.text.includes(k.text) && !used.has(x.text));
      if (w && fresh(`k:${k.text}`, w.text)) out.push({ id: `kw:${k.id}`, a: { text: k.text, big: true, caption: `${k.reading} · ${shortMeaning(k.meaning, 2)}` }, b: { text: w.text, big: true, caption: `${w.reading} · ${shortMeaning(w.meaning, 2)}` } });
    }
  if (picks.includes('katakana-meaning'))
    for (const w of words) if (KATAKANA_ONLY.test(w.text) && fresh(w.text, meaning(w.meaning))) out.push({ id: `cm:${w.id}`, a: { text: w.text, big: true, caption: w.text }, b: { text: meaning(w.meaning), caption: w.text } });
  return out;
}

/** JLPT's deck: N5 and N4, every kind of pair (the page's Customise picks the kinds and levels). */
export const JLPT_MEMORY_DEFAULT = ['N5', 'N4', ...JLPT_PAIR_TYPES.map((t) => t.key)];
MEMORY_DECKS.push({
  id: 'jlpt',
  label: 'JLPT',
  icon: '🈴',
  rule: 'Match each kanji or word to its meaning — or a kanji to a word written with it.',
  pairs: jlptPairs(JLPT_MEMORY_DEFAULT),
});
