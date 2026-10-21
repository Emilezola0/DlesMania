import type { Work } from '../types';
import { bestSearchScore, normalizeText } from '../utils/textMatcher';

/** Lower case, no accents or punctuation (see utils/textMatcher). */
export const normalize = normalizeText;

/** Every name a work can be searched by: English and French titles, subtitle, aliases. */
export const workNames = (w: Work) => [w.name, w.nameFr, w.subtitle, ...(w.aliases ?? [])];

/** Whether a partly typed query finds this work (typos, accents and punctuation forgiven). */
export function matchesQuery(w: Work, query: string): boolean {
  return bestSearchScore(query, workNames(w)) !== null;
}
