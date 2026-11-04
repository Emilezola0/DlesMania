// What each grammar point of the list means (src/data/jlpt-grammar.json, from Bunpro, JLPT Sensei and
// JMdict: scripts/build-jlpt-grammar.mjs), in the player's language — the French is the English's
// translation (src/data/jlpt-grammar-fr.json) — and example sentences: the sources' own for the point
// (src/data/jlpt-grammar-examples.json), then real sentences from Tatoeba that use it.
import data from '../data/jlpt-grammar.json';
import FR from '../data/jlpt-grammar-fr.json';
import { sentencesOf, type JlptSentence } from './jlptSentences';

type Meaning = { en: string; src: string };
const LEVELS = data.levels as Record<string, Record<string, Meaning>>;
const FRENCH = FR as Record<string, string>;

/** A grammar point's translation in English or French, and where it was found; null when no source has it. */
export function grammarMeaning(level: string, pattern: string, lang: 'en' | 'fr'): { text: string; src: string } | null {
  const m = LEVELS[level]?.[pattern];
  return m ? { text: (lang === 'fr' && FRENCH[m.en]) || m.en, src: m.src } : null;
}

/** Up to `n` real sentences using a grammar point of a level, the one already shown (`not`) left out. */
export const grammarExamples = (level: string, pattern: string, not?: number, n = 2): JlptSentence[] =>
  sentencesOf(level)
    .filter((s) => s.grammar === pattern && s.id !== not)
    .slice(0, n);

/**
 * A grammar point's example sentences from the source it was found in (Bunpro's grammar point, JLPT
 * Sensei's lesson), as the source writes them, each checked to hold the point
 * (scripts/build-jlpt-grammar-examples.mjs).
 */
export interface SourceExample {
  ja: string;
  /** "[漢字|かな]" for each kanji run, the readings the source gives. */
  furigana: string;
  /** The sentence's reading as the source writes it, when it doesn't line up with its kanji. */
  kana?: string;
  /** The part the source marks as the grammar point: [start, end) in `ja`. */
  blank: [number, number];
  en: string;
  src: 'Bunpro' | 'JLPT Sensei';
  url: string;
}
type ExampleData = { levels: Record<string, Record<string, SourceExample[]>>; tatoebaOut: string[] };
let loaded: Promise<ExampleData> | null = null;
/** The examples (a big file, loaded the first time a note is shown). */
export const loadGrammarExamples = () => (loaded ??= import('../data/jlpt-grammar-examples.json').then((m) => m.default as unknown as ExampleData));

/** A grammar point's examples: its sources' first, then the Tatoeba sentences that passed the same check. */
export async function allGrammarExamples(level: string, pattern: string, not?: number): Promise<{ source: SourceExample[]; tatoeba: JlptSentence[] }> {
  const d = await loadGrammarExamples();
  const out = new Set(d.tatoebaOut);
  return {
    source: d.levels[level]?.[pattern] ?? [],
    tatoeba: sentencesOf(level).filter((s) => s.grammar === pattern && s.id !== not && !out.has(`${level}|${pattern}|${s.id}`)),
  };
}
