// Fighting in the dungeon (stage C, part 2): weapons and the mobs. Weapons are crafted at a workbench from what's mined
// (src/island/crafting.ts) or drawn from the sword in the stone (once a day, its rarity at random); each wears out
// (`durability`: hits that land), the best one in the bag used first. Mobs live in the week's dungeon (each player
// fights their own), one kind a biome; they patrol their room's floor, come at you when you're near, and hurt on touch.
// No weapon: your fists (1 damage, they never wear out). The player has HEARTS; at none, back to the gate.

export interface Weapon {
  damage: number;
  /** Hits that land before it breaks. */
  durability: number;
  /** A sword from the stone: its rarity. */
  rarity?: Rarity;
}
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';

export const WEAPONS: Record<string, Weapon> = {
  'stone-sword': { damage: 2, durability: 30 },
  'iron-sword': { damage: 3, durability: 60 },
  'gold-sword': { damage: 4, durability: 45 },
  'crystal-sword': { damage: 5, durability: 90 },
  // The sword in the stone's, by rarity.
  'legend-sword-common': { damage: 3, durability: 40, rarity: 'common' },
  'legend-sword-rare': { damage: 4, durability: 60, rarity: 'rare' },
  'legend-sword-epic': { damage: 6, durability: 80, rarity: 'epic' },
  'legend-sword-legendary': { damage: 8, durability: 110, rarity: 'legendary' },
  'legend-sword-mythic': { damage: 10, durability: 150, rarity: 'mythic' },
};
export const isWeapon = (id: string) => id in WEAPONS;
export const FISTS = { damage: 1 };
/** How far a swing reaches (cells, in front of you), and how long between two. */
export const SWING = { reach: 1.5, rest: 380 };

/** The best weapon in a bag (the most damage), if any. */
export function bestWeapon(bag: Record<string, number>): string | null {
  let best: string | null = null;
  for (const [id, n] of Object.entries(bag)) if (n > 0 && WEAPONS[id] && (!best || WEAPONS[id].damage > WEAPONS[best].damage)) best = id;
  return best;
}

/** The sword in the stone: what it gives, once a day, by chance (out of 100). */
export const STONE_ODDS: [Rarity, number][] = [
  ['common', 50],
  ['rare', 28],
  ['epic', 14],
  ['legendary', 6],
  ['mythic', 2],
];
export function drawStoneSword(rand = Math.random): string {
  let r = rand() * 100;
  for (const [rarity, w] of STONE_ODDS) {
    if (r < w) return `legend-sword-${rarity}`;
    r -= w;
  }
  return 'legend-sword-common';
}
export const RARITY_COLOR: Record<Rarity, string> = { common: '#9ca3af', rare: '#3b82f6', epic: '#a855f7', legendary: '#f59e0b', mythic: '#ec4899' };

/** The player's hearts in the dungeon, and how long a hurt keeps them safe (ms). */
export const HEARTS = 5;
export const SAFE_AFTER_HURT = 1100;

export interface MobKind {
  name: string;
  fr: string;
  icon: string;
  hp: number;
  /** Cells a second. */
  speed: number;
  /** It floats (over lava, gaps). */
  flies?: boolean;
  /** What it may drop, one in two. */
  drops: string[];
}
/** One kind a biome (src/island/dungeon.ts, BIOMES). */
export const MOBS: Record<string, MobKind> = {
  crypt: { name: 'Skeleton', fr: 'Squelette', icon: '💀', hp: 3, speed: 1.7, drops: ['coal-ore', 'iron-ore'] },
  ice: { name: 'Frost slime', fr: 'Slime de givre', icon: '🧊', hp: 2, speed: 1.3, drops: ['crystal-ore', 'iron-ore'] },
  jungle: { name: 'Cave spider', fr: 'Araignée des grottes', icon: '🕷️', hp: 3, speed: 2.4, drops: ['iron-ore', 'gold-ore'] },
  magma: { name: 'Fire imp', fr: 'Diablotin de feu', icon: '😈', hp: 5, speed: 1.9, flies: true, drops: ['gold-ore', 'crystal-ore'] },
  /**
   * The boss, in the magma depths: each time it falls, a Dle question (src/island/quiz.ts). Right, it's beaten; wrong,
   * it gets back up with some of its life (BOSS.back), and the next fall asks another, until it's beaten.
   */
  boss: { name: 'The Magma Lord', fr: 'Le Seigneur du magma', icon: '👹', hp: 16, speed: 2.2, drops: [] },
};
/** The boss: its size (cells), the life it gets back on a wrong answer, what beating it pays (once a week). */
export const BOSS = { size: 1.9, back: 0.4, coins: 250, items: ['crystal-ore', 'crystal-ore', 'gold-ore', 'gold-ore'] };
