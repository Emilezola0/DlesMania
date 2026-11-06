// To the Last (JLPT): every word, kanji or grammar point of a level, one at a time, until none is left.
// A right answer takes it off for good; a wrong one sends it back a little later. Progress is kept on this
// device, so a level can be learned over many sittings.
import { hashString, mulberry32, shuffle } from '../lib/rng';
import { kanaFromRomaji, romajiSpellings, toHiragana } from '../lib/romaji';
import { BASIC_KANA, JLPT_LEVELS, typedRight, type JlptAsk, type JlptEntry } from './jlpt';

export type LastKind = 'vocab' | 'kanji' | 'grammar' | 'hiragana' | 'katakana';
/** A level's kinds (N5…N1); the kana are a "level" of their own ("Kana"), the basic syllabary of each script. */
export const LAST_KINDS: LastKind[] = ['vocab', 'kanji', 'grammar'];
export const KANA_KINDS: LastKind[] = ['hiragana', 'katakana'];
export const LAST_KIND_LABEL: Record<LastKind, string> = { vocab: '語 Words', kanji: '字 Kanji', grammar: '文 Grammar', hiragana: 'あ Hiragana', katakana: 'ア Katakana' };
/** Whether a level and kind make a To the Last. */
export const lastValid = (level: string, kind: string) => (/^N[1-5]$/.test(level) && (LAST_KINDS as string[]).includes(kind)) || (level === 'Kana' && (KANA_KINDS as string[]).includes(kind));

/** A level's items of one kind. Grammar points have no reading or meaning in the list: only their pattern. */
export function lastItems(level: string, kind: LastKind): JlptEntry[] {
  if (kind === 'hiragana' || kind === 'katakana') return BASIC_KANA[kind];
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
/** How much of a grammar point is hidden: easy shows at least two kana (never the whole answer), medium about half, hard none. */
export type GapLevel = 'easy' | 'medium' | 'hard';
const hiddenCount = (n: number, level: GapLevel) => (level === 'hard' ? n : level === 'easy' ? Math.max(1, Math.min(n - 2, Math.ceil(n / 3))) : Math.max(1, Math.ceil(n / 2)));

/** A grammar point with some of its kana hidden ("～の_う_が～より"), always at least one; the rest stays as written. */
export function maskPattern(pattern: string, seed: number, level: GapLevel = 'medium'): string {
  const chars = [...pattern];
  const kana = chars.flatMap((c, i) => (KANA.test(c) ? [i] : []));
  if (!kana.length) return pattern;
  const hide = new Set(shuffle(kana, mulberry32(seed)).slice(0, hiddenCount(kana.length, level)));
  return chars.map((c, i) => (hide.has(i) ? '＿' : c)).join('');
}

/** The kana a masked pattern hides, in order (～んです shown as "～ん＿＿": "です"). */
export function hiddenKana(pattern: string, shown: string): string {
  const masked = [...shown];
  return [...pattern].filter((c, i) => masked[i] === '＿' && c !== '＿').join('');
}

/** Each kanji's readings in the list (on'yomi in hiragana, kun'yomi without its okurigana), and a one-kanji word's (的: てき). */
const KANJI_READINGS = (() => {
  const m = new Map<string, Set<string>>();
  const add = (k: string, readings: string) => {
    const set = m.get(k) ?? m.set(k, new Set()).get(k)!;
    for (const r of readings.split(/[・、/／\s]+/)) {
      const kana = toHiragana(r.replace(/[-－]/g, '').split('.')[0]);
      if (kana) set.add(kana);
    }
  };
  for (const l of JLPT_LEVELS)
    for (const d of l.decks) for (const e of d.entries) if ([...e.text].length === 1 && /\p{Script=Han}/u.test(e.text)) add(e.text, e.reading);
  return new Map([...m].map(([k, v]) => [k, [...v]]));
})();
/** A pattern with its kanji read out, each way the list reads them (的: てき; に関する: にかんする), to type it in romaji. */
function readOut(pattern: string): string[] {
  let forms = [''];
  for (const c of pattern) {
    const rs = KANJI_READINGS.get(c);
    forms = (rs?.length ? forms.flatMap((f) => rs.map((r) => f + r)) : forms.map((f) => f + c)).slice(0, 64);
  }
  return forms;
}

/** A grammar point's pattern as it can be typed: without ～, brackets or spaces, in hiragana. */
const patternKey = (s: string) => toHiragana(s.replace(/[～~\s（）()]/g, ''));

/** A particle as it's said: は "wa", を "o", へ "e" — each of them either way. */
const particleForms = (kana: string): string[] => {
  const out = new Set([kana]);
  for (const [k, said] of [['は', 'わ'], ['を', 'お'], ['へ', 'え']] as const) for (const x of [...out]) out.add(x.replaceAll(k, said));
  return [...out];
};
/** Romaji as compared: lower case, letters only. */
const latin = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');

/**
 * Right or not. A word or kanji asked its meaning can be answered with its reading too, in kana or romaji
 * (午前: "morning" or "gozen"); asked its reading, only the reading. A grammar point (`shown` with gaps):
 * its gaps filled — the hidden kana alone ("desu" for ～ん＿＿) — or the whole pattern, in kana or romaji
 * ("ndesu"), the particles either way (は as "ha" or "wa").
 */
export function lastRight(e: JlptEntry, ask: LastAsk, typed: string, shown?: string): boolean {
  if (ask === 'meaning') return typedRight(e, 'meaning', typed) || typedRight(e, 'reading', typed);
  if (ask === 'reading') return typedRight(e, 'reading', typed);
  const gap = shown ? hiddenKana(e.text, shown) : '';
  const whole = [e.text, e.text.replace(/[（(][^）)]*[）)]/g, '')];
  // Its kanji read out too (a pattern all in kanji, 的, has no gap to fill).
  const patterns = [...whole, ...whole.flatMap(readOut), ...(gap ? [gap] : [])].map(patternKey);
  // The bracketed reading is optional ("～や否や（いなや）": や否や is enough).
  const got = patternKey(kanaFromRomaji(typed, true));
  if (patterns.some((p) => particleForms(p).includes(got) || p === got)) return true;
  // In romaji: against every Latin spelling of the pattern (long vowels written or not).
  const roman = latin(typed);
  return !!roman && patterns.some((p) => particleForms(p).some((form) => /^[ぁ-ゖー]+$/.test(form) && romajiSpellings(form).some((r) => latin(r) === roman)));
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
