// Japanese Wordle (日本語 Wordle): one word a day, any word of the JLPT list (src/data/jlpt.json), as many
// tiles as it has kana. Every kana is a tile — a small one too, so a contracted sound (きゃ, しゅ, ちょ) takes
// two, and so does a long vowel written out (とう) or with a bar (ー). Answers and guesses are the list's
// words, in hiragana; a guess is as long as the day's word.
import { dayNumber } from '../lib/date';
import { hashString, mulberry32, shuffle } from '../lib/rng';
import { toHiragana } from '../lib/romaji';
import { JLPT_LEVELS, type JlptEntry } from './jlpt';

/** The shortest word to find (a single kana is no puzzle). */
export const JA_MIN_LETTERS = 2;
export const JA_TRIES = 6;

export interface JaWord {
  /** In hiragana: the tiles, one a kana. */
  kana: string;
  entry: JlptEntry;
}

const KANA = /^[ぁ-ゖー]+$/;

/** Every word of the list, by its kana (one per reading: 毎月 is both まいげつ and まいつき). */
export const JA_WORDS: JaWord[] = (() => {
  const seen = new Set<string>();
  return JLPT_LEVELS.flatMap((l) => l.decks.find((d) => d.kind === 'vocab')!.entries).flatMap((entry) =>
    entry.reading.split(/[/／・、]/).flatMap((r) => {
      const kana = toHiragana(r.trim());
      if ([...kana].length < JA_MIN_LETTERS || !KANA.test(kana) || seen.has(kana)) return [];
      seen.add(kana);
      return [{ kana, entry }];
    }),
  );
})();

const VALID = new Set(JA_WORDS.map((w) => w.kana));
export const isJaWord = (kana: string) => VALID.has(kana);

const BY_KANA = new Map(JA_WORDS.map((w) => [w.kana, w]));
/** A word of the list by its kana (its meaning, for the guesses). */
export const jaWord = (kana: string) => BY_KANA.get(kana);

/** Every length a word can have, in kana (for Customise). */
export const JA_LENGTHS = [...new Set(JA_WORDS.map((w) => [...w.kana].length))].sort((a, b) => a - b);

/** The words in an order drawn once and for all: day 1 the first, and round again once they're all done. */
const ORDER = shuffle(JA_WORDS, mulberry32(hashString('omnidle:wordle-ja')));
/**
 * The day's word: the same for everyone who plays the same lengths. Every length (the default): the list's
 * own order; some lengths only (Customise): the same order, keeping only those.
 */
export function jaWordOfTheDay(date: string, lengths: number[] = JA_LENGTHS) {
  const all = lengths.length === 0 || JA_LENGTHS.every((n) => lengths.includes(n));
  const pool = all ? ORDER : ORDER.filter((w) => lengths.includes([...w.kana].length));
  const list = pool.length ? pool : ORDER;
  return list[(((dayNumber(date) - 1) % list.length) + list.length) % list.length];
}
