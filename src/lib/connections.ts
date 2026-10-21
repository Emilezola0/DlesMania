import { connectionsPuzzles, connectionThemes, type ThemeBank } from '../data';
import type { ConnectionsLevel, ConnectionsPuzzle, Domain } from '../types';
import { mulberry32, shuffle } from './rng';

/**
 * Themed Connections grids are built from reusable sub-categories (src/data/connection-themes.json):
 * each theme lists its cards once, and each sub-category ("Marine Admirals", "Logia users"...) lists
 * which cards belong to it. A card may belong to several sub-categories — that's where the red
 * herrings come from (Akainu is an Admiral *and* a Logia user).
 *
 * A grid id is "theme:<theme id>:<seed>", so a daily round can be rebuilt from its id alone.
 */
export const THEME_PREFIX = 'theme:';

/**
 * Sub-category sets to try per grid, card draws to try per set, and how many red herrings to aim
 * for. Sets are drawn first so every sub-category gets its turn, even ones with no overlaps.
 */
const CATEGORY_SETS = 20;
const DRAWS_PER_SET = 40;
const TARGET_HERRINGS = 3;

interface Draw {
  categories: ThemeBank['categories'];
  tiles: string[][];
  herrings: number;
}

/**
 * Number of ways to split the 16 tiles into the 4 shown sub-categories, 4 each, using every
 * membership listed in the bank (stops counting at 2). A fair grid has exactly one.
 */
export function countSolutions(tiles: string[], categories: ThemeBank['categories']): number {
  const fits = tiles.map((t) => categories.map((c, i) => (c.items.includes(t) ? i : -1)).filter((i) => i >= 0));
  const room = categories.map(() => 4);
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

function draw(categories: ThemeBank['categories'], rand: () => number): Draw | null {
  const used = new Set<string>();
  const tiles: string[][] = [];
  for (const c of categories) {
    const pool = shuffle(c.items.filter((i) => !used.has(i)), rand);
    if (pool.length < 4) return null;
    const four = pool.slice(0, 4);
    four.forEach((i) => used.add(i));
    tiles.push(four);
  }
  const flat = tiles.flat();
  if (countSolutions(flat, categories) !== 1) return null;
  // A red herring is a tile that also fits another sub-category on the board.
  const herrings = flat.filter((t) => categories.filter((c) => c.items.includes(t)).length > 1).length;
  return { categories, tiles, herrings };
}

/**
 * Builds the grid for a theme and seed: picks four sub-categories, then tries card draws for them,
 * keeping only grids with a single solution and preferring the most red herrings (up to
 * TARGET_HERRINGS). Moves on to another set of sub-categories only if no draw works.
 */
export function generateThemePuzzle(bank: ThemeBank, seed: number): ConnectionsPuzzle | null {
  const rand = mulberry32(seed);
  let best: Draw | null = null;
  for (let set = 0; set < CATEGORY_SETS && !best; set++) {
    const categories = shuffle(bank.categories, rand).slice(0, 4);
    for (let i = 0; i < DRAWS_PER_SET; i++) {
      const d = draw(categories, rand);
      if (d && (!best || Math.min(d.herrings, TARGET_HERRINGS) > Math.min(best.herrings, TARGET_HERRINGS))) best = d;
      if (best && best.herrings >= TARGET_HERRINGS) break;
    }
  }
  if (!best) return null;
  const images = new Map(bank.cards.map((c) => (typeof c === 'string' ? [c, undefined] : [c.label, c.image])));
  // Colours follow each sub-category's difficulty, ties broken by the seed.
  const ranked = best.categories
    .map((c, i) => ({ c, i, tie: rand() }))
    .sort((a, b) => a.c.level - b.c.level || a.tie - b.tie);
  return {
    id: `${THEME_PREFIX}${bank.id}:${seed}`,
    domain: bank.domain,
    theme: bank.theme,
    groups: ranked.map(({ c, i }, rank) => ({
      label: c.label,
      level: rank as ConnectionsLevel,
      items: best.tiles[i].map((label) => ({ label, image: images.get(label) })),
    })),
  };
}

const cache = new Map<string, ConnectionsPuzzle | null>();

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
