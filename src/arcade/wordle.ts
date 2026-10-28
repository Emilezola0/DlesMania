import { SILHOUETTES } from '../data/silhouettes';
import { ONE_PIECE } from '../specialist/data';
import { GENSHIN } from '../specialist/genshin';
import { LOL } from '../specialist/lol';
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
const named = (names: string[]): WordleName[] => {
  const seen = new Set<string>();
  return names.flatMap((name) => {
    const word = wordOf(name);
    if (!fits(word) || seen.has(word)) return [];
    seen.add(word);
    return [{ word, name }];
  });
};
const series = (id: string, lang: NameLang = 'en') => SILHOUETTES.find((s) => s.id === id)?.entries.map((e) => (lang === 'fr' && e.fr) || e.name) ?? [];

// One Piece goes by short names ("Luffy", not "Monkey D. Luffy"): the first spelling of each up to 9 letters.
const onePiece = ONE_PIECE.characters.slice(0, 120).flatMap((c) => {
  const short = [c.name, ...c.aliases].find((n) => fits(wordOf(n)) && wordOf(n).length <= 9);
  return short ? [short] : [];
});

export const WORDLE_SETS: WordleSet[] = [
  { id: 'pokemon', label: 'Pokémon', icon: '⚡', names: named(series('pokemon')), namesFr: named(series('pokemon', 'fr')) },
  { id: 'lol', label: 'League champions', icon: '⚔️', names: named(LOL.champions.map((c) => c.name)) },
  { id: 'genshin', label: 'Genshin characters', icon: '✨', names: named(GENSHIN.characters.map((c) => c.name)) },
  { id: 'onepiece', label: 'One Piece', icon: '🏴‍☠️', names: named(onePiece) },
  { id: 'minecraft', label: 'Minecraft mobs', icon: '⛏️', names: named(series('minecraft')), namesFr: named(series('minecraft', 'fr')) },
];

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
