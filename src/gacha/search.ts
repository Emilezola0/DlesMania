// Finding cards by name: the Album's search, shared (the Album, the Black Market).
import { DOMAINS } from '../data/domains';
import { frenchOf } from '../lib/french';
import { CARDS, SETS, type Card } from './cards';

/** Lower case, no accents or punctuation: for the search box. */
export const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** What a card can be found by: its name (in English and French), its title and its franchise. */
export const SEARCH_TEXT = new Map(CARDS.map((c) => [c.id, fold([c.name, frenchOf(c.name, c.set), c.title, c.franchise].filter(Boolean).join(' '))]));

/** A search's words (folded). */
export const searchWords = (query: string) => fold(query).split(' ').filter(Boolean);

/** Whether a card answers every word of a search (any card, with no words). */
export const cardMatches = (c: Card, words: string[]) => {
  if (!words.length) return true;
  const text = SEARCH_TEXT.get(c.id) ?? '';
  return words.every((w) => text.includes(w));
};

/** The sets, by domain (Games, Anime…), for a set picker. */
export const SETS_BY_DOMAIN = DOMAINS.map((d) => ({ domain: d, sets: SETS.filter((s) => s.domain === d.id) })).filter((g) => g.sets.length);
