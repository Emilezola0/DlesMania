// Crafting on the Island (stage C): a furnace refines what you mine (stone, dirt, ores from the island and the
// dungeon) into blocks, and a workbench turns those into decorations you can't grow. Click a furnace or a workbench
// (Walk) to open its recipes; the Seed Book lists them all, the ones never made hidden. The store pays it
// (src/store/progress.ts, craft).
export type Station = 'furnace' | 'workbench';
export interface Recipe {
  out: string;
  /** How many it makes (1 if not said). */
  n?: number;
  at: Station;
  needs: Record<string, number>;
}

export const RECIPES: Recipe[] = [
  { out: 'polished-stone', at: 'furnace', needs: { stone: 2 } },
  { out: 'stone-bricks', at: 'furnace', needs: { stone: 2, 'coal-ore': 1 } },
  { out: 'red-bricks', at: 'furnace', needs: { dirt: 3, 'coal-ore': 1 } },
  { out: 'glass-block', at: 'furnace', needs: { dirt: 2, 'coal-ore': 1 } },
  { out: 'iron-block', at: 'furnace', needs: { 'iron-ore': 2, 'coal-ore': 1 } },
  { out: 'gold-block', at: 'furnace', needs: { 'gold-ore': 2, 'coal-ore': 1 } },
  { out: 'crystal-block', at: 'furnace', needs: { 'crystal-ore': 2 } },
  { out: 'brick-wallpaper', n: 2, at: 'workbench', needs: { 'stone-bricks': 1 } },
  { out: 'stone-pillar', at: 'workbench', needs: { 'polished-stone': 2 } },
  { out: 'iron-fence', n: 2, at: 'workbench', needs: { 'iron-block': 1 } },
  { out: 'iron-lantern', at: 'workbench', needs: { 'iron-block': 1, 'coal-ore': 1 } },
  { out: 'stained-glass', n: 2, at: 'workbench', needs: { 'glass-block': 2, 'gold-ore': 1 } },
  { out: 'crystal-lamp', at: 'workbench', needs: { 'crystal-block': 1, 'iron-block': 1 } },
  { out: 'crystal-chandelier', at: 'workbench', needs: { 'crystal-block': 2, 'gold-block': 1 } },
  { out: 'gold-throne', at: 'workbench', needs: { 'gold-block': 3 } },
  // Weapons for the dungeon (src/island/combat.ts), each wearing out as it hits.
  { out: 'stone-sword', at: 'workbench', needs: { 'polished-stone': 2, 'coal-ore': 1 } },
  { out: 'iron-sword', at: 'workbench', needs: { 'iron-block': 2, 'coal-ore': 1 } },
  { out: 'gold-sword', at: 'workbench', needs: { 'gold-block': 2, 'iron-block': 1 } },
  { out: 'crystal-sword', at: 'workbench', needs: { 'crystal-block': 2, 'gold-block': 1 } },
];
export const RECIPE_BY_OUT = new Map(RECIPES.map((r) => [r.out, r]));

/** Whether the bag holds what a recipe needs. */
export const canCraft = (r: Recipe, bag: Record<string, number>) => Object.entries(r.needs).every(([id, n]) => (bag[id] ?? 0) >= n);
