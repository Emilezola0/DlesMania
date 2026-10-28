import type { Work } from '../types';
import { bestSearchScore, normalizeText } from '../utils/textMatcher';
import { withFrench } from './french';

/** Lower case, no accents or punctuation (see utils/textMatcher). */
export const normalize = normalizeText;

/** Anything with names that the guess box can suggest: a work, or a Specialist character, fruit or crew. */
export type Named = Pick<Work, 'id' | 'name'> & Partial<Pick<Work, 'nameFr' | 'subtitle' | 'aliases' | 'year'>> & {
  /** A portrait shown in the suggestions (Specialist characters, champions...). */
  image?: string;
};

/** Every name a work can be searched by: English and French titles, subtitle, aliases (and the French name of each, see lib/french). */
export const workNames = (w: Named) => withFrench([w.name, w.nameFr, w.subtitle, ...(w.aliases ?? [])]);

/** Whether a partly typed query finds this work (typos, accents and punctuation forgiven). */
export function matchesQuery(w: Work, query: string): boolean {
  return bestSearchScore(query, workNames(w)) !== null;
}

/** "a character", "an item": the article for a lower-cased noun. */
export const withArticle = (noun: string) => `${/^[aeiou]/i.test(noun) ? 'an' : 'a'} ${noun.toLowerCase()}`;
