import { SILHOUETTES } from '../data/silhouettes';
import { withFrench } from '../lib/french';
import { ONE_PIECE } from '../specialist/data';
import { GENSHIN } from '../specialist/genshin';
import { LOL } from '../specialist/lol';
import { DRAGON_BALL, HARRY_POTTER, NARUTO, STAR_WARS } from '../specialist/extra';
import { SIMPLE } from '../specialist/simple';
import type { NameLang } from '../store/progress';

/** A name as Wordle letters: no accents, spaces or punctuation ("Kai'Sa" → KAISA). */
export const wordOf = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z]/g, '')
    .toUpperCase();

// Any length goes: the answer's length is hidden, and a guess can be any name of the set.
export const MIN_LETTERS = 2;
export const MAX_LETTERS = 16;
export const WORDLE_TRIES = 6;

export interface WordleName {
  word: string;
  /** The name as it's written. */
  name: string;
  /** Its other spellings as Wordle letters (the other language, aliases, the full name): not played, but recognised. */
  alts: string[];
  /** JLPT: the word in Japanese and its meaning, shown with the answer (the point is to learn it). */
  note?: string;
}

export interface WordleSet {
  id: string;
  label: string;
  icon: string;
  names: WordleName[];
  /** The names in French, for sets where they differ (Pokémon, Minecraft); the others play the same either way. */
  namesFr?: WordleName[];
}

const fits = (w: string) => w.length >= MIN_LETTERS && w.length <= MAX_LETTERS;
/** A name to play, and the other ways it's written. */
type Source = { name: string; alts: string[] };

const named = (sources: Source[]): WordleName[] => {
  const seen = new Set<string>();
  return sources.flatMap(({ name, alts }) => {
    const word = wordOf(name);
    if (!fits(word) || seen.has(word)) return [];
    seen.add(word);
    const others = [...new Set(withFrench([name, ...alts]).map(wordOf))].filter((w) => w && w !== word);
    return [{ word, name, alts: others }];
  });
};
const series = (id: string, lang: NameLang = 'en'): Source[] =>
  SILHOUETTES.find((s) => s.id === id)?.entries.map((e) => ({ name: (lang === 'fr' && e.fr) || e.name, alts: [e.name, ...(e.fr ? [e.fr] : []), ...e.aliases] })) ?? [];
const roster = (xs: { name: string; aliases: string[] }[]): Source[] => xs.map((x) => ({ name: x.name, alts: x.aliases }));

// One Piece goes by short names ("Luffy", not "Monkey D. Luffy"): the first spelling of each up to 9 letters.
const onePiece: Source[] = ONE_PIECE.characters.slice(0, 120).flatMap((c) => {
  const short = [c.name, ...c.aliases].find((n) => fits(wordOf(n)) && wordOf(n).length <= 9);
  return short ? [{ name: short, alts: [c.name, ...c.aliases] }] : [];
});

/** Someone's first name when no one else in the set has it ("Hermione"), or their whole name. */
const firstNames = (xs: { name: string; aliases?: string[] }[]): Source[] => {
  const first = (n: string) => n.split(/\s+/)[0];
  const count = new Map<string, number>();
  for (const x of xs) count.set(wordOf(first(x.name)), (count.get(wordOf(first(x.name))) ?? 0) + 1);
  // A droid's number isn't letters (C-3PO would be "CPO"): left out.
  return xs.filter((x) => !/\d/.test(x.name)).map((x) => {
    const f = first(x.name);
    const short = wordOf(f).length >= 3 && count.get(wordOf(f)) === 1;
    return { name: short ? f : x.name, alts: [x.name, ...(x.aliases ?? [])] };
  });
};

export const WORDLE_SETS: WordleSet[] = [
  { id: 'pokemon', label: 'Pokémon', icon: '⚡', names: named(series('pokemon')), namesFr: named(series('pokemon', 'fr')) },
  { id: 'lol', label: 'League champions', icon: '⚔️', names: named(roster(LOL.champions)) },
  { id: 'genshin', label: 'Genshin characters', icon: '✨', names: named(roster(GENSHIN.characters)) },
  { id: 'onepiece', label: 'One Piece', icon: '🏴‍☠️', names: named(onePiece) },
  { id: 'minecraft', label: 'Minecraft mobs', icon: '⛏️', names: named(series('minecraft')), namesFr: named(series('minecraft', 'fr')) },
  // From the franchises' open data and the Specialist's rosters.
  { id: 'harrypotter', label: 'Harry Potter', icon: '🪄', names: named(firstNames(HARRY_POTTER)) },
  { id: 'starwars', label: 'Star Wars', icon: '🌌', names: named(firstNames(STAR_WARS)) },
  { id: 'naruto', label: 'Naruto', icon: '🍥', names: named(firstNames(NARUTO.slice(0, 120))) },
  { id: 'dbz', label: 'Dragon Ball', icon: '💥', names: named(roster(DRAGON_BALL)) },
  { id: 'overwatch', label: 'Overwatch heroes', icon: '🎯', names: named(roster(SIMPLE.overwatch.characters)) },
  { id: 'forhonor', label: 'For Honor heroes', icon: '🛡️', names: named(roster(SIMPLE.forhonor.characters)) },
  { id: 'avatar', label: 'Avatar: The Last Airbender', icon: '🌊', names: named(firstNames(SIMPLE.avatar.characters)) },
  { id: 'destiny', label: 'Destiny', icon: '🌒', names: named(roster(SIMPLE.destiny.characters)) },
];

/** Letters apart: insertions, deletions and substitutions (Levenshtein), stopping early past `cap`. */
function distance(a: string, b: string, cap: number): number {
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let low = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      low = Math.min(low, cur[j]);
    }
    if (low > cap) return cap + 1;
    prev = cur;
  }
  return prev[b.length];
}

/**
 * A guess that isn't one of the set's names, but nearly: another spelling of one (the name in
 * the other language, an alias, the full name — `alt`), or a near-miss in the letters (`close`).
 */
export function didYouMean(names: WordleName[], guess: string): { name: WordleName; why: 'alt' | 'close' } | null {
  const g = wordOf(guess);
  if (!g) return null;
  const alt = names.find((n) => n.alts.includes(g));
  if (alt) return { name: alt, why: 'alt' };
  const cap = g.length <= 4 ? 1 : g.length <= 8 ? 2 : 3;
  let best: WordleName | null = null;
  let bestD = cap + 1;
  for (const n of names)
    for (const w of [n.word, ...n.alts]) {
      const d = distance(g, w, cap);
      if (d < bestD) (bestD = d), (best = n);
    }
  return best ? { name: best, why: 'close' } : null;
}

export const wordleSet = (id: string | undefined) => WORDLE_SETS.find((s) => s.id === id);

/** The names a set plays with in a language: its French ones when it has them. */
export const namesIn = (set: WordleSet, lang: NameLang) => (lang === 'fr' && set.namesFr) || set.names;

export type LetterMark = 'hit' | 'near' | 'miss';

/** How the answer's length compares to a guess's. */
export const lengthHint = (guess: string, answer: string): 'longer' | 'shorter' | 'same' =>
  answer.length > guess.length ? 'longer' : answer.length < guess.length ? 'shorter' : 'same';

/**
 * Wordle marks: right place, elsewhere in the word (as many times as it's there), or not in it.
 * Guess and answer can differ in length: letters past the answer's end can only be elsewhere or out.
 */
export function markGuess(guess: string, answer: string): LetterMark[] {
  const marks: LetterMark[] = Array(guess.length).fill('miss');
  const left = new Map<string, number>();
  [...answer].forEach((ch, i) => {
    if (guess[i] === ch) marks[i] = 'hit';
    else left.set(ch, (left.get(ch) ?? 0) + 1);
  });
  [...guess].forEach((ch, i) => {
    if (marks[i] === 'hit') return;
    const n = left.get(ch) ?? 0;
    if (n > 0) {
      marks[i] = 'near';
      left.set(ch, n - 1);
    }
  });
  return marks;
}
