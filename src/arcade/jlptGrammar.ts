// What each grammar point of the list means (src/data/jlpt-grammar.json, from Bunpro, JLPT Sensei and
// JMdict: scripts/build-jlpt-grammar.mjs), in the player's language — the French is the English's
// translation (src/data/jlpt-grammar-fr.json) — and the real sentences (Tatoeba) that use it.
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
