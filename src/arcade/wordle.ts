import { SILHOUETTES } from '../data/silhouettes';
import { ONE_PIECE } from '../specialist/data';
import { GENSHIN } from '../specialist/genshin';
import { LOL } from '../specialist/lol';

/** A name as Wordle letters: no accents, spaces or punctuation ("Kai'Sa" → KAISA). */
export const wordOf = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z]/g, '')
    .toUpperCase();

export const MIN_LETTERS = 4;
export const MAX_LETTERS = 9;
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
const series = (id: string) => SILHOUETTES.find((s) => s.id === id)?.entries.map((e) => e.name) ?? [];

// One Piece goes by short names ("Luffy", "Zoro"): the first spelling of each that fits.
const onePiece = ONE_PIECE.characters.slice(0, 120).flatMap((c) => {
  const short = [c.name, ...c.aliases].find((n) => fits(wordOf(n)));
  return short ? [short] : [];
});

export const WORDLE_SETS: WordleSet[] = [
  { id: 'pokemon', label: 'Pokémon', icon: '⚡', names: named(series('pokemon')) },
  { id: 'lol', label: 'League champions', icon: '⚔️', names: named(LOL.champions.map((c) => c.name)) },
  { id: 'genshin', label: 'Genshin characters', icon: '✨', names: named(GENSHIN.characters.map((c) => c.name)) },
  { id: 'onepiece', label: 'One Piece', icon: '🏴‍☠️', names: named(onePiece) },
  { id: 'minecraft', label: 'Minecraft mobs', icon: '⛏️', names: named(series('minecraft')) },
];

export const wordleSet = (id: string | undefined) => WORDLE_SETS.find((s) => s.id === id);

export type LetterMark = 'hit' | 'near' | 'miss';

/** Wordle marks: right place, elsewhere in the word (as many times as it's there), or not in it. */
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
