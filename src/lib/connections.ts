import { connectionsPuzzles, connectionThemes, type ThemeBank } from '../data';
import settings from '../data/settings.json';
import type { ConnectionsLevel, ConnectionsPuzzle, Domain } from '../types';
import { mulberry32, shuffle } from './rng';

/**
 * Themed Connections grids are built from reusable sub-categories (src/data/connection-themes.json):
 * each theme lists its cards once, and each sub-category ("Marine Admirals", "Logia users"...) lists
 * which cards belong to it.
 *
 * A grid never shows a card that could go in two of its groups (with Kanto starters and Fire-type
 * Pokémon on one board, Charizard stays off it), so the player never faces five Fire types for four
 * slots — which takes complete memberships in the data: every Fire type listed as one. And a board
 * avoids a single group of places or objects among characters: the odd one out would be solved at a
 * glance.
 *
 * A grid id is "theme:<theme id>:<seed>", so a daily round can be rebuilt from its id alone.
 */
export const THEME_PREFIX = 'theme:';

/**
 * Grid shapes and mistakes allowed, from src/data/settings.json.
 *   Hand-made puzzles: groups of 4, cut down to `groups` groups at play time (3 → 12 tiles).
 *   Themed grids: `themed.groups` groups of `themed.groupSize` (4 × 4 = 16 tiles).
 */
export const CONNECTIONS = {
  groups: Math.min(4, Math.max(2, settings.connections.groups)),
  groupSize: 4,
  maxMistakes: settings.connections.maxMistakes,
  themed: {
    groups: Math.min(5, Math.max(2, settings.connections.themed.groups)),
    groupSize: Math.min(4, Math.max(3, settings.connections.themed.groupSize)),
  },
};

/** Sub-category sets to try per grid, and card draws per set when the set's groups share cards. */
const CATEGORY_SETS = 60;
const DRAWS_PER_SET = 40;

type Category = ThemeBank['categories'][number];
export type CardKind = 'character' | 'place' | 'thing';

// Labels name what the cards are: "Islands of the Grand Line", "Link's tools", "Logia Devil Fruit users".
const PEOPLE = /\b(users?|bearers?|wielders?|wore|wearers?|racers?|heroes|apprentices?)\b/i;
const PLACE = /\b(islands?|planets?|places?|locations?|cities|city|towns?|regions?|worlds?|kingdoms?|lands?|maps?|stages?|villages?)\b/i;
const THING = /\b(tools?|items?|power-ups?|masks?|horcrux(es)?|hallows|weapons?|swords?|ships?|vehicles?|fruits?|moves?|techniques?|spells?|jutsu)\b/i;

/** What a sub-category's cards are: people, places or things (`kind` in the data wins). */
export function kindOf(c: Category): CardKind {
  if (c.kind) return c.kind;
  if (PEOPLE.test(c.label)) return 'character';
  if (PLACE.test(c.label)) return 'place';
  if (THING.test(c.label)) return 'thing';
  return 'character';
}

const disjoint = (a: Category, b: Category) => !a.items.some((i) => b.items.includes(i));

/** Groups whose kind no other group on the board shares (the only places among characters...). */
const loners = (set: Category[]) => set.filter((c) => set.length > 1 && set.filter((o) => kindOf(o) === kindOf(c)).length === 1);

/**
 * Number of ways to split the tiles into the shown sub-categories, using every membership listed
 * in the bank (stops counting at 2). A fair grid has exactly one.
 */
export function countSolutions(tiles: string[], categories: ThemeBank['categories']): number {
  const fits = tiles.map((t) => categories.map((c, i) => (c.items.includes(t) ? i : -1)).filter((i) => i >= 0));
  const room = categories.map(() => CONNECTIONS.themed.groupSize);
  // Most constrained tiles first.
  const order = tiles.map((_, i) => i).sort((a, b) => fits[a].length - fits[b].length);
  let found = 0;
  const place = (k: number) => {
    if (found > 1) return;
    if (k === order.length) {
      found++;
      return;
    }
    for (const c of fits[order[k]]) {
      if (!room[c]) continue;
      room[c]--;
      place(k + 1);
      room[c]++;
    }
  };
  place(0);
  return found;
}

/** Tiles for each group, none of them fitting another group on the board (null when that fails). */
function draw(categories: Category[], rand: () => number): string[][] | null {
  const tiles: string[][] = [];
  for (const c of categories) {
    const own = c.items.filter((i) => categories.every((o) => o === c || !o.items.includes(i)));
    if (own.length < CONNECTIONS.themed.groupSize) return null;
    tiles.push(shuffle(own, rand).slice(0, CONNECTIONS.themed.groupSize));
  }
  return tiles;
}

/**
 * Builds the grid for a theme and seed. Whatever the sub-categories, the tiles drawn for a group are
 * cards no other group on the board lists. Sets are tried best first: no lone kind and no card shared
 * anywhere in the theme; no lone kind (shared cards just stay off the board); then, failing those, a
 * lone kind, coloured as the easiest group.
 */
export function generateThemePuzzle(bank: ThemeBank, seed: number): ConnectionsPuzzle | null {
  const rand = mulberry32(seed);
  // Sub-categories smaller than a group (trios like the Legendary Sannin) sit out at this group size.
  const usable = bank.categories.filter((c) => c.items.length >= CONNECTIONS.themed.groupSize);
  let best: { tier: number; categories: Category[]; tiles: string[][] } | null = null;
  for (let set = 0; set < CATEGORY_SETS && !(best && best.tier === 0); set++) {
    const categories = shuffle(usable, rand).slice(0, CONNECTIONS.themed.groups);
    if (categories.length < CONNECTIONS.themed.groups) break;
    const apart = categories.every((c, i) => categories.every((o, j) => i === j || disjoint(c, o)));
    const tier = (loners(categories).length ? 2 : 0) + (apart ? 0 : 1);
    if (best && best.tier <= tier) continue;
    for (let i = 0; i < (apart ? 1 : DRAWS_PER_SET); i++) {
      const tiles = draw(categories, rand);
      if (tiles && countSolutions(tiles.flat(), categories) === 1) {
        best = { tier, categories, tiles };
        break;
      }
    }
  }
  if (!best) return null;
  const { categories, tiles } = best;
  const images = new Map(bank.cards.map((c) => (typeof c === 'string' ? [c, undefined] : [c.label, c.image])));
  // Colours follow each sub-category's difficulty, ties broken by the seed. A lone kind (the only
  // places on a board of characters) is spotted at once: it's always the easiest. With fewer than
  // four groups the ranks spread over the four colours (3 groups: yellow, blue, purple).
  const lone = new Set(loners(categories));
  const ranked = categories
    .map((c, i) => ({ c, i, level: lone.has(c) ? -1 : c.level, tie: rand() }))
    .sort((a, b) => a.level - b.level || a.tie - b.tie);
  const colour = (rank: number) => Math.round((rank * 3) / Math.max(1, ranked.length - 1)) as ConnectionsLevel;
  return {
    id: `${THEME_PREFIX}${bank.id}:${seed}`,
    domain: bank.domain,
    theme: bank.theme,
    groups: ranked.map(({ c, i }, rank) => ({
      label: c.label,
      level: colour(rank),
      items: tiles[i].map((label) => ({ label, image: images.get(label) })),
    })),
  };
}

const cache = new Map<string, ConnectionsPuzzle | null>();

/**
 * Cuts a puzzle down to CONNECTIONS.groups groups, chosen by the round's seed (hand-made puzzles
 * have four). The groups keep their own colours.
 */
export function fitPuzzle(p: ConnectionsPuzzle, seed: number): ConnectionsPuzzle {
  if (p.groups.length <= CONNECTIONS.groups) return p;
  const keep = new Set(shuffle(p.groups.map((_, i) => i), mulberry32(seed ^ 0x5bd1e995)).slice(0, CONNECTIONS.groups));
  return { ...p, groups: p.groups.filter((_, i) => keep.has(i)) };
}

/** A hand-made puzzle by id, or a themed grid rebuilt from "theme:<id>:<seed>". */
export function getPuzzle(id: string | undefined): ConnectionsPuzzle | undefined {
  if (!id) return undefined;
  if (!id.startsWith(THEME_PREFIX)) return connectionsPuzzles.find((p) => p.id === id);
  if (!cache.has(id)) {
    const [themeId, seed] = id.slice(THEME_PREFIX.length).split(':');
    const bank = connectionThemes.find((t) => t.id === themeId);
    cache.set(id, bank ? generateThemePuzzle(bank, Number(seed)) : null);
  }
  return cache.get(id) ?? undefined;
}

export const themesFor = (domain: Domain | undefined) => connectionThemes.filter((t) => !domain || t.domain === domain);
