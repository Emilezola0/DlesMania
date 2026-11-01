// JLPT sentences with a blank (built by scripts/build-jlpt-sentences.mjs): real sentences from Tatoeba,
// each with a blank on one of the level's grammar points or words, its translation, its furigana, and a
// recording when a voice read it. The words, readings and grammar points are the list's (jlpt.json).
import data from '../data/jlpt-sentences.json';
import { shuffle } from '../lib/rng';
import { JLPT_LEVELS, jlptEntry, type JlptEntry } from './jlpt';

export interface JlptSentence {
  /** Tatoeba's number for it. */
  id: number;
  ja: string;
  /** Tatoeba's furigana: "[漢字|かん|じ]" for each kanji word, the rest as written. */
  furigana: string;
  /** The blank: [start, end) in `ja`. */
  blank: [number, number];
  /** Three wrong answers. */
  wrong: string[];
  /** What the blank is: one of the level's grammar points (as the list writes it), or a word of it (its id). */
  grammar?: string;
  word?: string;
  en: string;
  fr?: string;
  /** A recording (served with the site), and who read it under which licence. */
  audio?: { by: string; license: string };
}

export const SENTENCE_SOURCE = data.source;
const BY_LEVEL = data.levels as unknown as Record<string, JlptSentence[]>;
export const sentencesOf = (level: string) => BY_LEVEL[level] ?? [];
export const audioUrl = (s: JlptSentence) => `${import.meta.env?.BASE_URL ?? './'}audio/jlpt/${s.id}.mp3`;
export const tatoebaUrl = (s: JlptSentence) => `https://tatoeba.org/en/sentences/show/${s.id}`;

/** A piece of the sentence: as written, with its reading when it's kanji. */
export interface Piece {
  text: string;
  reading?: string;
  start: number;
}

/** Tatoeba's furigana as pieces: each kanji with its own reading when the reading is split by kanji ("[漢字|かん|じ]"). */
export function pieces(furigana: string): Piece[] {
  const out: Piece[] = [];
  let at = 0;
  for (const m of furigana.matchAll(/\[([^|\]]+)\|([^\]]*)\]|([^[]+)/g)) {
    if (m[3]) {
      out.push({ text: m[3], start: at });
      at += m[3].length;
      continue;
    }
    const base = m[1];
    const parts = m[2].split('|');
    // One reading per character (empty for a kana within the word): a ruby on each kanji.
    if (parts.length === [...base].length) {
      [...base].forEach((ch, i) => out.push({ text: ch, reading: parts[i] || undefined, start: at + i }));
    } else out.push({ text: base, reading: parts.join(''), start: at });
    at += base.length;
  }
  return out;
}

/** The list's words in a sentence (its longest matches, each once — a lone kanji too), to go over once it's answered. */
const WORD_INDEX = (() => {
  const m = new Map<string, JlptEntry>();
  for (const l of JLPT_LEVELS) for (const e of l.decks[0].entries) for (const w of e.text.split('/')) if (/\p{Script=Han}/u.test(w) && !m.has(w)) m.set(w, e);
  return m;
})();
export function wordsIn(s: JlptSentence): JlptEntry[] {
  const out: JlptEntry[] = [];
  const word = s.word ? jlptEntry(s.word) : undefined;
  if (word) out.push(word);
  for (let i = 0; i < s.ja.length; i++) {
    for (let len = Math.min(6, s.ja.length - i); len >= 1; len--) {
      const e = WORD_INDEX.get(s.ja.slice(i, i + len));
      if (e) {
        if (!out.some((x) => x.id === e.id)) out.push(e);
        i += len - 1;
        break;
      }
    }
  }
  return out.slice(0, 8);
}

export interface SentenceQuestion {
  s: JlptSentence;
  answer: string;
  options: string[];
}

/** A sentence not asked lately, its four answers mixed. */
export function nextSentence(level: string, recent: Set<number>): SentenceQuestion | null {
  const all = sentencesOf(level).filter((s) => s.wrong.length === 3);
  if (!all.length) return null;
  const fresh = all.filter((s) => !recent.has(s.id));
  const pool = fresh.length ? fresh : all;
  const s = pool[Math.floor(Math.random() * pool.length)];
  const answer = s.ja.slice(s.blank[0], s.blank[1]);
  return { s, answer, options: shuffle([answer, ...s.wrong.filter((w) => w !== answer)], Math.random) };
}
