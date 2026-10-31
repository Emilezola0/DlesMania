// To the Last (JLPT): every word, kanji or grammar point of a level, one at a time, until none is left.
// A right answer takes it off for good; a wrong one sends it back a little later. Progress is kept on this
// device, so a level can be learned over many sittings.
import { hashString, mulberry32, shuffle } from '../lib/rng';
import { kanaFromRomaji, toHiragana } from '../lib/romaji';
import { JLPT_LEVELS, typedRight, type JlptAsk, type JlptEntry } from './jlpt';

export type LastKind = 'vocab' | 'kanji' | 'grammar';
export const LAST_KINDS: LastKind[] = ['vocab', 'kanji', 'grammar'];
export const LAST_KIND_LABEL: Record<LastKind, string> = { vocab: '語 Words', kanji: '字 Kanji', grammar: '文 Grammar' };

/** A level's items of one kind. Grammar points have no reading or meaning in the list: only their pattern. */
export function lastItems(level: string, kind: LastKind): JlptEntry[] {
  const l = JLPT_LEVELS.find((x) => x.level === level);
  if (!l) return [];
  if (kind === 'grammar') return l.grammar.map((g, i) => ({ id: `${l.level}:grammar:${i}`, text: g, reading: '', meaning: '', level: l.level }));
  return l.decks.find((d) => d.kind === kind)!.entries;
}

/** What's asked: a word or kanji's meaning or reading; a grammar point's hidden kana (the pattern to write out in full). */
export type LastAsk = JlptAsk | 'pattern';

/** A word in kanji is asked its reading now and then; kana-only words and kanji… their meaning, or a kanji any of its readings. */
export function askFor(e: JlptEntry, kind: LastKind, seed: number): LastAsk {
  if (kind === 'grammar') return 'pattern';
  const readable = e.reading && e.reading !== e.text;
  return readable && mulberry32(seed)() < 0.4 ? 'reading' : 'meaning';
}

const KANA = /[ぁ-ゖァ-ヶ]/;
/** A grammar point with about half its kana hidden ("～の_う_が～より"), always at least one; the rest stays as written. */
export function maskPattern(pattern: string, seed: number): string {
  const chars = [...pattern];
  const kana = chars.flatMap((c, i) => (KANA.test(c) ? [i] : []));
  if (!kana.length) return pattern;
  const hide = new Set(shuffle(kana, mulberry32(seed)).slice(0, Math.max(1, Math.ceil(kana.length / 2))));
  return chars.map((c, i) => (hide.has(i) ? '＿' : c)).join('');
}

/** A grammar point's pattern as it can be typed: without ～, brackets or spaces, in hiragana. */
const patternKey = (s: string) => toHiragana(s.replace(/[～~\s（）()]/g, ''));

export function lastRight(e: JlptEntry, ask: LastAsk, typed: string): boolean {
  if (ask !== 'pattern') return typedRight(e, ask, typed);
  const want = patternKey(e.text);
  const got = patternKey(kanaFromRomaji(typed, true));
  // The bracketed reading is optional ("～や否や（いなや）": や否や is enough).
  return got === want || got === patternKey(e.text.replace(/[（(][^）)]*[）)]/g, ''));
}

/** Saved progress: the ids still to answer, in their order, and the counts so far. */
export interface LastProgress {
  left: string[];
  right: number;
  wrong: number;
}

const storeKey = (level: string, kind: LastKind) => `omnidle-jlpt-last:${level}-${kind}`;

export function loadLast(level: string, kind: LastKind): LastProgress {
  const items = lastItems(level, kind);
  const ids = new Set(items.map((e) => e.id));
  try {
    const v = JSON.parse(localStorage.getItem(storeKey(level, kind)) ?? 'null') as LastProgress | null;
    if (v && Array.isArray(v.left)) return { left: v.left.filter((id) => ids.has(id)), right: v.right ?? 0, wrong: v.wrong ?? 0 };
  } catch {
    // A fresh start.
  }
  return freshLast(level, kind);
}

export const freshLast = (level: string, kind: LastKind): LastProgress => ({
  left: shuffle(
    lastItems(level, kind).map((e) => e.id),
    mulberry32(hashString(`${level}-${kind}-${Date.now()}`)),
  ),
  right: 0,
  wrong: 0,
});

export function saveLast(level: string, kind: LastKind, p: LastProgress) {
  try {
    localStorage.setItem(storeKey(level, kind), JSON.stringify(p));
  } catch {
    // Not kept, that's all.
  }
}

/** After an answer: right, it leaves; wrong, it comes back a few items later (sooner when few are left). */
export function afterAnswer(p: LastProgress, right: boolean): LastProgress {
  const [head, ...rest] = p.left;
  if (right) return { left: rest, right: p.right + 1, wrong: p.wrong };
  const at = Math.min(rest.length, 4 + Math.floor(Math.random() * 6));
  return { left: [...rest.slice(0, at), head, ...rest.slice(at)], right: p.right, wrong: p.wrong + 1 };
}
