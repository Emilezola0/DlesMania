import data from '../data/jlpt.json';
import { shuffle } from '../lib/rng';

/** A word or a kanji: what's written, how it's read, what it means. */
export interface JlptEntry {
  id: string;
  text: string;
  reading: string;
  meaning: string;
}

export type JlptKind = 'vocab' | 'kanji';

export interface JlptDeck {
  /** "n5-vocab", "n1-kanji"… also the best's key, after "jlpt:". */
  id: string;
  level: string;
  kind: JlptKind;
  label: string;
  entries: JlptEntry[];
}

export interface JlptLevel {
  level: string;
  grammar: string[];
  decks: JlptDeck[];
}

export const JLPT_SOURCE = data.source;

/** N5 (easiest) to N1, each with its vocabulary and kanji decks and its grammar list. */
export const JLPT_LEVELS: JlptLevel[] = data.levels.map((l) => ({
  level: l.level,
  grammar: l.grammar,
  decks: (['vocab', 'kanji'] as const).map((kind) => ({
    id: `${l.level.toLowerCase()}-${kind}`,
    level: l.level,
    kind,
    label: `${l.level} ${kind === 'vocab' ? 'Vocabulary' : 'Kanji'}`,
    entries: (l[kind] as string[][]).map(([text, reading, meaning], i) => ({ id: `${l.level}:${kind}:${i}`, text, reading, meaning })),
  })),
}));

export const JLPT_DECKS = JLPT_LEVELS.flatMap((l) => l.decks);
export const jlptDeck = (id: string) => JLPT_DECKS.find((d) => d.id === id);

/** The first few senses only: some entries list a dozen. */
export const shortMeaning = (m: string, senses = 3) => m.split(/;\s*|,\s*/).slice(0, senses).join(', ');

export type JlptAsk = 'meaning' | 'reading';

export interface JlptQuestion {
  entry: JlptEntry;
  ask: JlptAsk;
  /** Four answers, the right one among them. */
  options: string[];
  answer: string;
}

const shown = (e: JlptEntry, ask: JlptAsk) => (ask === 'meaning' ? shortMeaning(e.meaning) : e.reading);

/**
 * A question on an entry not seen lately: its meaning, or (for a word written in kanji) its reading. The
 * wrong answers come from the same deck, never from the same word (some are listed twice, one sense each)
 * and never reading or meaning the same as the answer.
 */
export function nextQuestion(deck: JlptDeck, recent: Set<string>): JlptQuestion {
  const fresh = deck.entries.filter((e) => !recent.has(e.id));
  const pool = fresh.length ? fresh : deck.entries;
  const entry = pool[Math.floor(Math.random() * pool.length)];
  const readable = entry.reading && entry.reading !== entry.text;
  const ask: JlptAsk = readable && Math.random() < 0.4 ? 'reading' : 'meaning';
  const answer = shown(entry, ask);
  const wrong = new Set<string>();
  for (const e of shuffle(deck.entries, Math.random)) {
    if (wrong.size >= 3) break;
    const s = shown(e, ask);
    if (!s || e.text === entry.text || s === answer || wrong.has(s)) continue;
    if (ask === 'meaning' && e.meaning === entry.meaning) continue;
    wrong.add(s);
  }
  return { entry, ask, answer, options: shuffle([answer, ...wrong], Math.random) };
}
