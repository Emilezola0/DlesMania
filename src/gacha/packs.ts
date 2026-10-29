// Card packs, bought with DleCoins: the general pack (every card), one per kind of work (video
// games, anime, movies), and one per franchise — locked until its Boss Battle is won, with better
// odds the harder the difficulty it was won at.
import { bossKey, type BossDifficulty } from '../store/progress';
import type { Domain } from '../types';
import { CARDS, RARITIES, type Card, type Rarity } from './cards';
import { clampPity, PITY_MAX, PITY_PACKS, PITY_STEP, PITY_TOP_SHARE, pityLuck } from './economy';

export const PACK_SIZE = 5;

/** Base odds, in percent, for each card of a pack. */
export const ODDS: Record<Rarity, number> = { common: 68.41, rare: 23, epic: 8, legendary: 0.5, mythic: 0.08, omni: 0.01 };

/** The luck (pity) lives with the economy, which the store reads without the card catalogue. */
export { clampPity, PITY_MAX, PITY_PACKS, PITY_STEP, PITY_TOP_SHARE, pityLuck };
export const isTopRarity = (r: Rarity) => RARITIES.indexOf(r) >= RARITIES.indexOf('legendary');

/**
 * The most a card can ever be of the top rarities, in percent, whatever stacks up (a guardian's boost and
 * full luck): the drop rates never climb past these.
 */
export const TOP_CAP: Partial<Record<Rarity, number>> = { legendary: 3, mythic: 0.4, omni: 0.05 };

/** A franchise pack's odds boost, by the hardest difficulty its boss was beaten at. */
export const BOOST: Record<BossDifficulty, number> = { easy: 1, medium: 1.6, hard: 2.5, hell: 3.2 };

export interface Pack {
  id: string;
  name: string;
  blurb: string;
  cost: number;
  /** Shown on the wrapper. */
  icon: string;
  /** The wrapper's colours. */
  colors: [string, string];
  pool: (c: Card) => boolean;
  /** Franchise packs: the boss to beat first. */
  boss?: string;
  domain?: Domain;
}

const DOMAIN_PACKS: { domain: Domain; name: string; icon: string; colors: [string, string] }[] = [
  { domain: 'games', name: 'Video Games pack', icon: '🎮', colors: ['#4f46e5', '#22d3ee'] },
  { domain: 'anime', name: 'Anime pack', icon: '🌸', colors: ['#db2777', '#fb923c'] },
  { domain: 'cinema', name: 'Movies pack', icon: '🎬', colors: ['#b45309', '#facc15'] },
];

export function packsFor(sets: { id: string; franchise: string; domain: Domain; guardian: { color?: string; image?: string } }[]): Pack[] {
  return [
    { id: 'general', name: 'Omnidle pack', blurb: 'Five cards from every franchise.', cost: 100, icon: '✦', colors: ['#334155', '#a78bfa'], pool: () => true },
    ...DOMAIN_PACKS.map((d) => ({
      id: `domain:${d.domain}`,
      name: d.name,
      blurb: `Five cards from the ${d.name.replace(' pack', '').toLowerCase()} franchises only.`,
      cost: 120,
      icon: d.icon,
      colors: d.colors,
      pool: (c: Card) => c.domain === d.domain,
      domain: d.domain,
    })),
    ...sets.map((s) => ({
      id: `set:${s.id}`,
      name: `${s.franchise} pack`,
      blurb: `Five ${s.franchise} cards only.`,
      cost: 150,
      icon: '👑',
      colors: [s.guardian.color ?? '#7c3aed', '#111827'] as [string, string],
      pool: (c: Card) => c.set === s.id,
      boss: s.id,
    })),
  ];
}

/** The hardest difficulty a boss was beaten at, if it was. */
export function bossBest(bosses: Record<string, { wins: number }>, id: string): BossDifficulty | null {
  for (const d of ['hell', 'hard', 'medium', 'easy'] as const) if ((bosses[bossKey(id, d)]?.wins ?? 0) > 0) return d;
  return null;
}

/**
 * The odds with a boost: epic multiplied, rare, legendary, mythic and omni by half as much (the top stays rare), common taking the rest;
 * `luck` (see pityLuck) multiplies legendary again, and mythic and omni by PITY_TOP_SHARE of it — each kept under its TOP_CAP.
 */
export function oddsWith(boost: number, luck = 1): Record<Rarity, number> {
  const half = 1 + (boost - 1) / 2;
  const rare = ODDS.rare * half;
  const epic = ODDS.epic * boost;
  const legendary = Math.min(TOP_CAP.legendary!, ODDS.legendary * half * luck);
  const topLuck = 1 + (luck - 1) * PITY_TOP_SHARE;
  const mythic = Math.min(TOP_CAP.mythic!, ODDS.mythic * half * topLuck);
  const omni = Math.min(TOP_CAP.omni!, ODDS.omni * half * topLuck);
  return { common: Math.max(0, 100 - rare - epic - legendary - mythic - omni), rare, epic, legendary, mythic, omni };
}

const rollRarity = (odds: Record<Rarity, number>, rand: () => number, atLeast: Rarity = 'common'): Rarity => {
  const allowed = RARITIES.slice(RARITIES.indexOf(atLeast));
  const total = allowed.reduce((t, r) => t + odds[r], 0);
  let x = rand() * total;
  for (const r of allowed) if ((x -= odds[r]) < 0) return r;
  return allowed[allowed.length - 1];
};

/** Five cards from a pack; the last one is at least rare. A rarity the pool lacks falls to the next one down. */
export function pullPack(pack: Pack, boost = 1, rand: () => number = Math.random, luck = 1): Card[] {
  const pool = CARDS.filter(pack.pool);
  const odds = oddsWith(boost, luck);
  const taken = new Set<string>();
  return Array.from({ length: PACK_SIZE }, (_, i) => {
    let r = rollRarity(odds, rand, i === PACK_SIZE - 1 ? 'rare' : 'common');
    // Five different cards: one already in this pack isn't drawn again.
    const of = (x: Rarity) => pool.filter((c) => c.rarity === x && !taken.has(c.id));
    let cands = of(r);
    while (!cands.length && RARITIES.indexOf(r) > 0) {
      r = RARITIES[RARITIES.indexOf(r) - 1];
      cands = of(r);
    }
    const card = cands[Math.floor(rand() * cands.length)];
    taken.add(card.id);
    return card;
  }).sort((a, b) => RARITIES.indexOf(a.rarity) - RARITIES.indexOf(b.rarity));
}

/** `count` packs in a row, each with the luck the packs before it left: the cards, and the pity after them. */
export function pullPacks(pack: Pack, count: number, boost: number, pity: number): { packs: Card[][]; pity: number } {
  const packs: Card[][] = [];
  for (let i = 0; i < count; i++) {
    const cards = pullPack(pack, boost, Math.random, pityLuck(pity));
    packs.push(cards);
    pity = cards.some((c) => isTopRarity(c.rarity)) ? 0 : clampPity(pity + 1);
  }
  return { packs, pity: clampPity(pity) };
}
