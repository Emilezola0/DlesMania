// JLPT sentences (built by scripts/build-jlpt-sentences.mjs): real sentences from Tatoeba using one of a
// level's grammar points (or words), with their translation, their furigana and a recording when a voice
// read it — the examples shown once a grammar question is answered (src/components/JlptGrammarNote.tsx).
// The words, readings and grammar points are the list's (jlpt.json).
import data from '../data/jlpt-sentences.json';

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
