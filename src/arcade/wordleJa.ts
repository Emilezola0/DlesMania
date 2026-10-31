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

/** The words in an order drawn once and for all: day 1 the first, and round again once they're all done. */
const ORDER = shuffle(JA_WORDS, mulberry32(hashString('omnidle:wordle-ja')));
export const jaWordOfTheDay = (date: string) => ORDER[(((dayNumber(date) - 1) % ORDER.length) + ORDER.length) % ORDER.length];
