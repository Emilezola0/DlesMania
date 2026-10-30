/**
 * Forgiving text matching for every typed answer (mini-game search, Boss Battle phases I and III).
 *
 *  - case, accents and ligatures are ignored ("Château" = "chateau" = "CHATEAU", "Œil" = "oeil")
 *  - punctuation and spacing are ignored ("Bel'Veth" = "belveth" = "bel veth", "Spider-Man" = "spiderman")
 *  - kana and kanji are kept as they are ("ねこ", "猫"), so Japanese answers can be typed too
 *  - small typos are allowed: 1 for 3–5 letters, 2 for 6+ (Levenshtein distance)
 *
 * English and French names are just more spellings: callers pass every name a thing goes by.
 */

const LIGATURES: Record<string, string> = { œ: 'oe', æ: 'ae', ß: 'ss', ø: 'o', ł: 'l', đ: 'd' };

/** Lower case, no accents, words separated by single spaces. "L'Œil  du-Château!" → "l oeil du chateau". */
export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[œæßøłđ]/g, (c) => LIGATURES[c])
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    // Kana and kanji stay (JLPT answers): their voiced marks, split off by NFD, go back on.
    .normalize('NFC')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\u3041-\u30ff\u3400-\u9fff]+/g, ' ')
    .trim();
}

/** normalizeText without any spaces: "Bel'Veth" and "Bel Veth" both become "belveth". */
export const compactText = (s: string) => normalizeText(s).replace(/ /g, '');

/**
 * Edit distance (insertions, deletions, substitutions, and swapping two neighbouring letters —
 * "teh" for "the" is one typo), stopping early once it exceeds `max`.
 */
export function levenshtein(a: string, b: string, max = Infinity): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let before: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) cur[j] = Math.min(cur[j], before[j - 2] + 1);
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > max) return max + 1;
    before = prev;
    prev = cur;
  }
  return prev[b.length];
}

/** Typos tolerated for an answer of this many letters: none under 3, 1 up to 5, 2 from 6. */
export function typoAllowance(length: number): number {
  if (length < 3) return 0;
  return length <= 5 ? 1 : 2;
}

/**
 * Distance between a full answer and one accepted spelling, or null when it's too far.
 * 0 means an exact match once case, accents, punctuation and spaces are ignored.
 */
export function answerDistance(input: string, target: string): number | null {
  const a = compactText(input);
  const b = compactText(target);
  if (!a || !b) return null;
  if (a === b) return 0;
  const allowed = typoAllowance(b.length);
  const d = levenshtein(a, b, allowed);
  return d <= allowed ? d : null;
}

/** Whether `input` names something that goes by any of `spellings` (exactly or with small typos). */
export function isFuzzyMatch(input: string, spellings: string[]): boolean {
  return spellings.some((s) => answerDistance(input, s) !== null);
}

export interface Match<T> {
  item: T;
  distance: number;
}

/**
 * The single best answer among candidates, each with its spellings.
 * Returns null when nothing is close enough, or when two different candidates are equally close
 * (a typo that could mean either shouldn't pick one at random).
 */
export function findBestMatch<T>(input: string, candidates: T[], spellingsOf: (c: T) => string[]): Match<T> | null {
  let best: Match<T> | null = null;
  let tie = false;
  for (const item of candidates) {
    const ds = spellingsOf(item)
      .map((s) => answerDistance(input, s))
      .filter((d): d is number => d !== null);
    if (!ds.length) continue;
    const distance = Math.min(...ds);
    if (!best || distance < best.distance) {
      best = { item, distance };
      tie = false;
    } else if (distance === best.distance) tie = true;
  }
  return best && !(tie && best.distance > 0) ? best : null;
}

/**
 * Whether `input` is, word for word, part of a candidate's name other than `except` — then a typo
 * shouldn't turn it into something else ("Haruno" is Sakura's name, not a misspelt "Naruto").
 */
export function namesAnotherWord<T>(input: string, candidates: T[], spellingsOf: (c: T) => string[], except: T): boolean {
  const q = normalizeText(input);
  if (!q) return false;
  return candidates.some((c) => c !== except && spellingsOf(c).some((s) => ` ${normalizeText(s)} `.includes(` ${q} `)));
}

/**
 * What a not-quite answer could mean, for a "Did you mean…?": a whole word of a name typed alone
 * ("Kakashi" → Kakashi Hatake, "Luffy" → Monkey D. Luffy), the start of a long name ("Trafalgar"),
 * or the whole name a few more typos off than an answer may be. Best guesses first, at most `limit`.
 */
export function suggestNames<T>(input: string, candidates: T[], spellingsOf: (c: T) => string[], limit = 3): T[] {
  const q = compactText(input);
  if (q.length < 3) return [];
  const scored: { item: T; score: number }[] = [];
  for (const item of candidates) {
    let best = Infinity;
    for (const s of spellingsOf(item)) {
      const n = normalizeText(s);
      const full = n.replace(/ /g, '');
      if (!full || full === q) continue;
      // One word of the name, typed in full (small typos forgiven).
      for (const w of n.split(' ')) {
        if (w.length < 3) continue;
        const allowed = typoAllowance(w.length);
        const d = levenshtein(q, w, allowed);
        if (d <= allowed) best = Math.min(best, d);
      }
      // The beginning of a longer name.
      if (q.length >= 4 && full.startsWith(q)) best = Math.min(best, 0.5);
      // A long name, one typo further off than an answer may be ("Itachy Uchia").
      if (full.length >= 8) {
        const loose = typoAllowance(full.length) + 1;
        const d = levenshtein(q, full, loose);
        if (d <= loose) best = Math.min(best, d + 1);
      }
    }
    if (best < Infinity) scored.push({ item, score: best });
  }
  // Only the closest: a name matched word for word crowds out the near-misses.
  const top = Math.min(...scored.map((s) => s.score));
  return scored
    .filter((s) => s.score <= top + 0.5)
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((s) => s.item);
}

/**
 * How well a partly typed search matches a name, for ranking autocomplete (lower is better):
 *   0 starts with it · 1 a word starts with it · 2 contains it · 3 close despite typos · null no match
 */
export function searchScore(query: string, name: string): number | null {
  const q = normalizeText(query);
  if (!q) return null;
  const n = normalizeText(name);
  const qc = q.replace(/ /g, '');
  const nc = n.replace(/ /g, '');
  if (nc.startsWith(qc)) return 0;
  if (n.split(' ').some((_, i, words) => words.slice(i).join('').startsWith(qc))) return 1;
  if (nc.includes(qc)) return 2;
  // Typos: compare against the whole name, and against the same-length start of the name or of each word.
  const allowed = typoAllowance(qc.length);
  if (qc.length < 3) return null;
  if (levenshtein(qc, nc, allowed) <= allowed) return 3;
  const words = n.split(' ');
  for (let i = 0; i < words.length; i++) {
    const rest = words.slice(i).join('');
    for (const len of [qc.length - 1, qc.length, qc.length + 1]) {
      if (len >= 3 && len <= rest.length && levenshtein(qc, rest.slice(0, len), allowed) <= allowed) return 3;
    }
  }
  return null;
}

/** Best search score over several names (title, French title, aliases...). */
export function bestSearchScore(query: string, names: (string | undefined)[]): number | null {
  let best: number | null = null;
  for (const n of names) {
    if (!n) continue;
    const s = searchScore(query, n);
    if (s !== null && (best === null || s < best)) best = s;
  }
  return best;
}

/** Filters and ranks items by how well any of their names match a partly typed query. */
export function rankBySearch<T>(query: string, items: T[], namesOf: (item: T) => (string | undefined)[], limit = 7): T[] {
  return items
    .map((item, i) => ({ item, i, score: bestSearchScore(query, namesOf(item)) }))
    .filter((r): r is { item: T; i: number; score: number } => r.score !== null)
    .sort((a, b) => a.score - b.score || a.i - b.i)
    .slice(0, limit)
    .map((r) => r.item);
}
