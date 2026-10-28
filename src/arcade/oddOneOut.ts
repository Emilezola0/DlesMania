import { connectionThemes, type ThemeBank } from '../data';
import { kindOf } from '../lib/connections';
import { shuffle } from '../lib/rng';

/** Cards on the table: four that share a link, one that doesn't. */
export const ODD_CARDS = 5;

export interface OddCard {
  label: string;
  image?: string;
}

export interface OddRound {
  theme: string;
  /** What the four have in common. */
  link: string;
  cards: OddCard[];
  /** The intruder's label. */
  odd: string;
}

type Category = ThemeBank['categories'][number];

/**
 * A fair round: four cards of one sub-category and an intruder of the same kind (a character among
 * characters) that isn't in it — and no other sub-category groups four of the five otherwise, so
 * there's only one card to point at.
 */
function tryRound(bank: ThemeBank, rand: () => number): OddRound | null {
  const usable = bank.categories.filter((c) => c.items.length >= ODD_CARDS - 1);
  const link = usable[Math.floor(rand() * usable.length)];
  if (!link) return null;
  const four = shuffle(link.items, rand).slice(0, ODD_CARDS - 1);
  const pool = bank.categories
    .filter((c) => c !== link && kindOf(c) === kindOf(link))
    .flatMap((c) => c.items)
    .filter((i) => !link.items.includes(i));
  if (!pool.length) return null;
  const odd = pool[Math.floor(rand() * pool.length)];
  const five = [...four, odd];
  // Another sub-category holding four of the five would make a different card the odd one.
  const ambiguous = bank.categories.some((c: Category) => c !== link && five.filter((x) => c.items.includes(x)).length >= ODD_CARDS - 1 && c.items.includes(odd));
  if (ambiguous) return null;
  const images = new Map(bank.cards.map((c) => (typeof c === 'string' ? [c, undefined] : [c.label, c.image])));
  return { theme: bank.theme, link: link.label, cards: shuffle(five, rand).map((label) => ({ label, image: images.get(label) })), odd };
}

/** A round from one theme, or from any theme when `themeId` is "all". */
export function oddRound(themeId: string, rand: () => number = Math.random): OddRound {
  const banks = themeId === 'all' ? connectionThemes : connectionThemes.filter((t) => t.id === themeId);
  for (let i = 0; i < 200; i++) {
    const r = tryRound(banks[Math.floor(rand() * banks.length)], rand);
    if (r) return r;
  }
  throw new Error(`No fair Odd One Out round for ${themeId}`);
}

export const ODD_THEMES = [{ id: 'all', theme: 'Every theme' }, ...connectionThemes.map((t) => ({ id: t.id, theme: t.theme }))];
