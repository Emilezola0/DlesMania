// Fill the Gap (JLPT): a sentence with a hole where one of its level's grammar points goes, to type in. The
// sentences are those the grammar notes already show, each checked to hold the point where it's marked: the
// sources' own examples (Bunpro, JLPT Sensei: src/data/jlpt-grammar-examples.json), then the Tatoeba sentences
// that passed the same check (src/data/jlpt-sentences.json), and the owner's books' examples (written by AI,
// src/arcade/jlptBooks.ts: each under its book's level, 中級へ行こう
// with N4). The grammar points are the list's (jlpt.json) and the books'.
import { loadBooks, bookShort } from './jlptBooks';
import { loadGrammarExamples } from './jlptGrammar';
import { pieces, sentencesOf, type JlptSentence } from './jlptSentences';
import { typedOneOf } from './toTheLast';

export interface FillItem {
  key: string;
  level: string;
  /** The grammar point, as the list writes it. */
  pattern: string;
  ja: string;
  furigana: string;
  /** The hole: [start, end) in `ja`. */
  blank: [number, number];
  /** What goes in it, as written, and in kana (null when its kanji's reading can't be told apart). */
  answer: string;
  kana: string | null;
  /** The sentence's reading as its source writes it, when it doesn't line up with the kanji. */
  reading?: string;
  en: string;
  fr?: string;
  src: string;
  url: string;
  /** A Tatoeba sentence: its number (left out of the examples shown after) and its recording. */
  tatoeba?: JlptSentence;
}

const KANJI = /[㐀-鿿々]/;

/** The kana of [from, to) in a sentence, from its furigana; null when a kanji word is cut in two. */
export function kanaOf(furigana: string, [from, to]: [number, number]): string | null {
  let out = '';
  for (const p of pieces(furigana)) {
    const end = p.start + p.text.length;
    if (end <= from || p.start >= to) continue;
    const inside = p.start >= from && end <= to;
    if (!p.reading) {
      out += p.text.slice(Math.max(0, from - p.start), Math.min(p.text.length, to - p.start));
      continue;
    }
    if (!inside) return null;
    out += p.reading;
  }
  return KANJI.test(out) ? null : out;
}

let cache: Promise<Record<string, FillItem[]>> | null = null;

/** Every level's sentences to fill (the examples are a big file: loaded the first time). */
export function loadFill(): Promise<Record<string, FillItem[]>> {
  return (cache ??= Promise.all([loadGrammarExamples(), loadBooks()]).then(([d, books]) => {
    const out = new Set(d.tatoebaOut);
    const by: Record<string, FillItem[]> = {};
    for (const level of ['N5', 'N4', 'N3', 'N2', 'N1']) {
      const items: FillItem[] = [];
      for (const [pattern, list] of Object.entries(d.levels[level] ?? {}))
        list.forEach((s, i) => {
          const answer = s.ja.slice(...s.blank);
          if (!answer.trim()) return;
          items.push({ key: `${level}|${pattern}|s${i}`, level, pattern, ja: s.ja, furigana: s.furigana, blank: s.blank, answer, kana: s.kana && KANJI.test(answer) ? null : kanaOf(s.furigana, s.blank), reading: s.kana, en: s.en, src: s.src, url: s.url });
        });
      for (const s of sentencesOf(level)) {
        if (!s.grammar || out.has(`${level}|${s.grammar}|${s.id}`)) continue;
        const answer = s.ja.slice(...s.blank);
        if (!answer.trim()) continue;
        items.push({ key: `${level}|${s.grammar}|t${s.id}`, level, pattern: s.grammar, ja: s.ja, furigana: s.furigana, blank: s.blank, answer, kana: kanaOf(s.furigana, s.blank), en: s.en, fr: s.fr, src: 'Tatoeba', url: `https://tatoeba.org/en/sentences/show/${s.id}`, tatoeba: s });
      }
      by[level] = items;
    }
    for (const book of books)
      for (const point of book.points) {
        // Under its book's level: as Coto's point when Coto has it there, as the book's form otherwise.
        const level = book.level;
        const pattern = point.coto?.level === level ? point.coto.pattern : point.p;
        point.ex.forEach((s, i) => {
          const answer = s.ja.slice(...s.blank);
          if (!answer.trim() || !by[level]) return;
          by[level].push({ key: `${level}|${pattern}|${book.id}-${point.n}-${i}`, level, pattern, ja: s.ja, furigana: s.furigana, blank: s.blank, answer, kana: kanaOf(s.furigana, s.blank), en: s.en, fr: s.fr, src: `${bookShort(book)} · AI`, url: `#/jlpt/books/${book.id}` });
        });
      }
    return by;
  }));
}

/** Right or not: what goes in the hole, as written or in kana, typed in kana or romaji. */
export const fillRight = (item: FillItem, typed: string) => typedOneOf([item.answer, ...(item.kana ? [item.kana] : [])], typed);
