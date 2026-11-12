// Who's That? with the JLPT kanji: one series per level (N5 to N1) and all of them together. Every kanji, its
// readings and meanings come from src/data/jlpt.json (the owner's list, CLAUDE.md "JLPT"), through src/arcade/jlpt.ts.
// Kept apart from silhouettes.ts, which the cards load everywhere: only Who's That? loads the JLPT list for this.
import { JLPT_LEVELS, type JlptEntry } from '../arcade/jlpt';
import { kanjiGlyph } from '../lib/kanji';
import type { SilhouetteEntry, SilhouetteSeries } from './silhouettes';

/** A kanji to name: by its reading (kana or romaji) or its English meaning, as in /jlpt's typed answers. */
export type KanjiSilhouette = SilhouetteEntry & { kanji: JlptEntry; revealed: string };

/** Asked swollen (its outline only), shown plain once it's over. */
const entry = (e: JlptEntry): KanjiSilhouette => ({ name: e.text, aliases: [], image: kanjiGlyph(e.text, true), revealed: kanjiGlyph(e.text), kanji: e });

/** Each kanji once (a few are listed twice in a level). */
const once = (es: JlptEntry[]) => [...new Map(es.map((e) => [e.text, e])).values()];

const series = (id: string, label: string, kanji: JlptEntry[]): SilhouetteSeries => ({
  id,
  // Not a domain's series: the hub shows these under their own heading, never by domain.
  domain: 'games',
  label,
  noun: 'kanji',
  entries: once(kanji).map(entry),
});

const byLevel = JLPT_LEVELS.map((l) => series(`kanji-${l.level.toLowerCase()}`, `${l.level} Kanji`, l.decks.find((d) => d.kind === 'kanji')!.entries));

/** "All kanji" first, then N5 (easiest) to N1. */
export const KANJI_SERIES: SilhouetteSeries[] = [
  series('kanji-all', 'All kanji', JLPT_LEVELS.flatMap((l) => l.decks.find((d) => d.kind === 'kanji')!.entries)),
  ...byLevel,
];

export const isKanji = (e: SilhouetteEntry): e is KanjiSilhouette => 'kanji' in e;
