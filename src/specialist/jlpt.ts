// The JLPT Specialist: the list's kanji and words (src/data/jlpt.json, nothing else), three ways —
// a kanji to give the meaning of, a word to read, a meaning to put back into Japanese. Every round ends on
// the reading under the character: the point is to learn.
import { JLPT_LEVELS, shortMeaning, type JlptEntry } from '../arcade/jlpt';
import { romajiSpellings, toHiragana } from '../lib/romaji';
import type { Guessable } from './data';

const title = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const kanas = (reading: string) => reading.split(/[/／・、\s]+/).map((r) => r.replace(/[.\-～~]/g, '')).filter(Boolean);
const meaningsOf = (m: string) => m.split(/[;,]/).map((x) => x.trim()).filter((x) => x && !/radical|counter for/i.test(x));

/** A kanji of the list, named by a meaning no other kanji uses first. */
export interface JlptKanji extends Guessable {
  entry: JlptEntry;
}
/** A word of the list (one per written form). */
export interface JlptWord extends Guessable {
  entry: JlptEntry;
  kana: string;
}

const ALL_KANJI = JLPT_LEVELS.flatMap((l) => l.decks.find((d) => d.kind === 'kanji')!.entries);
const ALL_VOCAB = JLPT_LEVELS.flatMap((l) => l.decks.find((d) => d.kind === 'vocab')!.entries);

export const JLPT_KANJI: JlptKanji[] = (() => {
  const taken = new Set<string>();
  const out: JlptKanji[] = [];
  for (const e of ALL_KANJI) {
    if (out.some((k) => k.entry.text === e.text)) continue;
    const meanings = meaningsOf(e.meaning).map(title);
    const name = meanings.find((m) => !taken.has(m.toLowerCase())) ?? `${meanings[0] ?? 'Kanji'} (${e.text})`;
    taken.add(name.toLowerCase());
    const readings = kanas(e.reading).map(toHiragana);
    out.push({ id: `k:${e.text}`, name, aliases: [...new Set([...meanings.filter((m) => m !== name), ...readings, ...readings.flatMap(romajiSpellings)])], entry: e });
  }
  return out;
})();

export const JLPT_WORDS: JlptWord[] = (() => {
  const seen = new Set<string>();
  const out: JlptWord[] = [];
  for (const e of ALL_VOCAB) {
    const [kana] = kanas(e.reading);
    if (!kana || seen.has(e.text)) continue;
    seen.add(e.text);
    const forms = e.text.split(/[/／\s]+/).filter(Boolean);
    out.push({ id: `w:${e.text}`, name: kana !== e.text ? `${e.text} · ${kana}` : e.text, aliases: [...new Set([...forms, ...kanas(e.reading), ...kanas(e.reading).flatMap(romajiSpellings)])], entry: e, kana });
  }
  return out;
})();

/** Readings to choose from in a Reading round: every kana reading of the list's words, once each. */
export const JLPT_READINGS: Guessable[] = (() => {
  const seen = new Map<string, Guessable>();
  for (const w of JLPT_WORDS) {
    const h = toHiragana(w.kana);
    if (!seen.has(h)) seen.set(h, { id: `r:${h}`, name: `${h} (${romajiSpellings(h)[0]})`, aliases: romajiSpellings(h) });
  }
  return [...seen.values()];
})();

export const jlptKanji = (id: string) => JLPT_KANJI.find((k) => k.id === id);
export const jlptWord = (id: string) => JLPT_WORDS.find((w) => w.id === id);

/** On and kun readings, as the list writes them (katakana on, hiragana kun). */
export function onKun(reading: string) {
  const parts = reading.split(/[・、\s]+/).filter(Boolean);
  return { on: parts.filter((p) => /^[゠-ヿ]/.test(p)).join('・'), kun: parts.filter((p) => !/^[゠-ヿ]/.test(p)).join('・') };
}

export const wordDetail = (w: JlptWord) => `${w.entry.text} — ${w.entry.reading} · ${shortMeaning(w.entry.meaning, 4)} · JLPT ${w.entry.level}`;

/** What each round draws from: a word for Reading only when it's written with kanji (else the reading is on screen). */
export const JLPT_POOLS = {
  kanji: JLPT_KANJI.map((k) => k.id),
  reading: JLPT_WORDS.filter((w) => w.entry.text !== w.kana && /[㐀-鿿]/.test(w.entry.text)).map((w) => w.id),
  word: JLPT_WORDS.map((w) => w.id),
};
