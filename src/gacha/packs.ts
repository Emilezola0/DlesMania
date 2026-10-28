// Card packs, bought with DleCoins: the general pack (every card), one per kind of work (video
// games, anime, movies), and one per franchise — locked until its Boss Battle is won, with better
// odds the harder the difficulty it was won at.
import { bossKey, type BossDifficulty } from '../store/progress';
import type { Domain } from '../types';
import { CARDS, RARITIES, type Card, type Rarity } from './cards';

export const PACK_SIZE = 5;

/** Base odds, in percent, for each card of a pack. */
export const ODDS: Record<Rarity, number> = { common: 67.75, rare: 23, epic: 8, legendary: 1, mythic: 0.25 };

/** A franchise pack's odds boost, by the hardest difficulty its boss was beaten at. */
export const BOOST: Record<BossDifficulty, number> = { easy: 1, medium: 1.6, hard: 2.5 };

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
  for (const d of ['hard', 'medium', 'easy'] as const) if ((bosses[bossKey(id, d)]?.wins ?? 0) > 0) return d;
  return null;
}

/** The odds with a boost: epic, legendary and mythic multiplied, rare by half as much, common taking the rest. */
export function oddsWith(boost: number): Record<Rarity, number> {
  const rare = ODDS.rare * (1 + (boost - 1) / 2);
  const epic = ODDS.epic * boost;
  const legendary = ODDS.legendary * boost;
  const mythic = ODDS.mythic * boost;
  return { common: Math.max(0, 100 - rare - epic - legendary - mythic), rare, epic, legendary, mythic };
}

const rollRarity = (odds: Record<Rarity, number>, rand: () => number, atLeast: Rarity = 'common'): Rarity => {
  const allowed = RARITIES.slice(RARITIES.indexOf(atLeast));
  const total = allowed.reduce((t, r) => t + odds[r], 0);
  let x = rand() * total;
  for (const r of allowed) if ((x -= odds[r]) < 0) return r;
  return allowed[allowed.length - 1];
};

/** Five cards from a pack; the last one is at least rare. A rarity the pool lacks falls to the next one down. */
export function pullPack(pack: Pack, boost = 1, rand: () => number = Math.random): Card[] {
  const pool = CARDS.filter(pack.pool);
  const odds = oddsWith(boost);
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
