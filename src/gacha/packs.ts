// Card packs, bought with DleCoins: the general pack (every card), one per kind of work (video
// games, anime, movies), and one per franchise — locked until its Boss Battle is won, with better
// odds the harder the difficulty it was won at.
import { bossKey, type BossDifficulty } from '../store/progress';
import type { Domain } from '../types';
import { CARDS, RARITIES, type Card, type Rarity } from './cards';
import { clampPity, PITY_MAX, PITY_PACKS, PITY_STEP, PITY_TOP_SHARE, pityLuck } from './economy';
// The numbers and the packs' looks live in src/data/tuning/packs.json (edited from the dev-only #/admin page).
import T from '../data/tuning/packs.json';

export const PACK_SIZE = T.packSize;

/** Base odds, in percent, for each card of a pack. */
// Mythic and Omni are the endgame: about one in every 250 packs has one.
export const ODDS: Record<Rarity, number> = T.odds;

/** The luck (pity) lives with the economy, which the store reads without the card catalogue. */
export { clampPity, PITY_MAX, PITY_PACKS, PITY_STEP, PITY_TOP_SHARE, pityLuck };
export const isTopRarity = (r: Rarity) => RARITIES.indexOf(r) >= RARITIES.indexOf('legendary');

/**
 * The most a card can ever be of the top rarities, in percent, whatever stacks up (a guardian's boost and
 * full luck): the drop rates never climb past these.
 */
export const TOP_CAP: Partial<Record<Rarity, number>> = T.topCap;

/** A franchise pack's odds boost, by the hardest difficulty its boss was beaten at. */
export const BOOST: Record<BossDifficulty, number> = T.boost;

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

const DOMAIN_PACKS = T.domain.packs as { domain: Domain; name: string; icon: string; colors: [string, string] }[];

export function packsFor(sets: { id: string; franchise: string; domain: Domain; guardian: { color?: string; image?: string } }[]): Pack[] {
  return [
    { id: 'general', ...T.general, colors: T.general.colors as [string, string], pool: () => true },
    ...DOMAIN_PACKS.map((d) => ({
      id: `domain:${d.domain}`,
      name: d.name,
      blurb: `Five cards from the ${d.name.replace(' pack', '').toLowerCase()} franchises only.`,
      cost: T.domain.cost,
      icon: d.icon,
      colors: d.colors,
      pool: (c: Card) => c.domain === d.domain,
      domain: d.domain,
    })),
    ...sets.map((s) => ({
      id: `set:${s.id}`,
      name: `${s.franchise} pack`,
      blurb: `Five ${s.franchise} cards only.`,
      cost: T.franchise.cost,
      icon: T.franchise.icon,
      colors: [s.guardian.color ?? T.franchise.color, T.franchise.secondColor] as [string, string],
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
 * The odds with a boost: epic multiplied, rare and legendary by half as much, mythic and omni by a quarter (they stay the
 * endgame), common taking the rest; `luck` (see pityLuck) multiplies legendary again, and mythic and omni by
 * PITY_TOP_SHARE of it — each kept under its TOP_CAP.
 */
export interface OddsTuning {
  odds: Record<Rarity, number>;
  topCap: Partial<Record<Rarity, number>>;
  topShare: number;
}
/** The odds in play (the admin page previews others). */
const LIVE_ODDS: OddsTuning = { odds: ODDS, topCap: TOP_CAP, topShare: PITY_TOP_SHARE };

export function oddsWith(boost: number, luck = 1, t: OddsTuning = LIVE_ODDS): Record<Rarity, number> {
  const half = 1 + (boost - 1) / 2;
  const quarter = 1 + (boost - 1) / 4;
  const rare = t.odds.rare * half;
  const epic = t.odds.epic * boost;
  const legendary = Math.min(t.topCap.legendary!, t.odds.legendary * half * luck);
  const topLuck = 1 + (luck - 1) * t.topShare;
  const mythic = Math.min(t.topCap.mythic!, t.odds.mythic * quarter * topLuck);
  const omni = Math.min(t.topCap.omni!, t.odds.omni * quarter * topLuck);
  return { common: Math.max(0, 100 - rare - epic - legendary - mythic - omni), rare, epic, legendary, mythic, omni };
}


/**
 * The odds of a pack's last card: no common, the top rarities lifted by the same amount whatever the boost
 * (so a better rare or epic never crowds them out), rare and epic sharing the rest as they do on the others.
 */
export function lastCardOdds(odds: Record<Rarity, number>, base: Record<Rarity, number> = ODDS): Record<Rarity, number> {
  // How much likelier the top rarities are on a pack's last card, the one that's at least rare.
  const lift = 100 / (100 - base.common);
  const legendary = odds.legendary * lift;
  const mythic = odds.mythic * lift;
  const omni = odds.omni * lift;
  const rest = 100 - legendary - mythic - omni;
  const lower = odds.rare + odds.epic;
  return { common: 0, rare: (rest * odds.rare) / lower, epic: (rest * odds.epic) / lower, legendary, mythic, omni };
}

/** The rarity of a card: the hardest to get is tried first (Omni, then Mythic, and so on), Common last. */
const rollRarity = (odds: Record<Rarity, number>, rand: () => number): Rarity => {
  const order = [...RARITIES].reverse();
  let x = rand() * 100;
  for (const r of order) if ((x -= odds[r]) < 0) return r;
  return order[order.length - 1];
};

/** One of these cards: every franchise among them has the same chance, however many cards it has, then every card of it. */
function drawFairly(cards: Card[], rand: () => number): Card {
  const sets = [...new Set(cards.map((c) => c.set))];
  const set = sets[Math.floor(rand() * sets.length)];
  const own = cards.filter((c) => c.set === set);
  return own[Math.floor(rand() * own.length)];
}

/** Five cards from a pack; the last one is at least rare. A rarity the pool lacks falls to the next one down. */
export function pullPack(pack: Pack, boost = 1, rand: () => number = Math.random, luck = 1): Card[] {
  const pool = CARDS.filter(pack.pool);
  const odds = oddsWith(boost, luck);
  const taken = new Set<string>();
  return Array.from({ length: PACK_SIZE }, (_, i) => {
    let r = rollRarity(i === PACK_SIZE - 1 ? lastCardOdds(odds) : odds, rand);
    // Five different cards: one already in this pack isn't drawn again.
    const of = (x: Rarity) => pool.filter((c) => c.rarity === x && !taken.has(c.id));
    let cands = of(r);
    while (!cands.length && RARITIES.indexOf(r) > 0) {
      r = RARITIES[RARITIES.indexOf(r) - 1];
      cands = of(r);
    }
    const card = drawFairly(cands, rand);
    taken.add(card.id);
    return card;
  }).sort((a, b) => RARITIES.indexOf(a.rarity) - RARITIES.indexOf(b.rarity));
}

/**
 * The sky's surprises, rolled as a pack is bought (its cards are final before the animation, so skipping it
 * loses nothing): two planets embrace and the best card goes up (Rare to Epic or Legendary, Epic to Legendary),
 * a supernova swallows it and it comes back Mythic, a Big Bang turns a Legendary into an Omni. At most one a pack.
 */
export type CosmicKind = 'wish' | 'collision' | 'supernova' | 'bigbang';
export const COSMIC_KINDS: CosmicKind[] = ['wish', 'collision', 'supernova', 'bigbang'];
export const COSMIC = T.cosmic;
export interface CosmicEvent {
  kind: CosmicKind;
  /** The card the pack held, and the one it became (now in the pack instead). */
  from: Card;
  to: Card;
}

/**
 * For testing, in dev only (`npm run dev`): localStorage "omnidle-force-cosmic" = "wish", "collision", "supernova" or
 * "bigbang" plays it every pack. The live site ignores it (it would hand out an Omni a pack).
 */
const forcedCosmic = (): CosmicKind | null => {
  if (!import.meta.env.DEV) return null;
  try {
    const f = localStorage.getItem('omnidle-force-cosmic');
    return (COSMIC_KINDS as string[]).includes(f ?? '') ? (f as CosmicKind) : null;
  } catch {
    return null;
  }
};

/** Rolls a pack's cosmic event and swaps its card in place (the pack stays sorted, the rarest last). */
export function cosmicFor(pack: Pack, cards: Card[], rand: () => number = Math.random, force: CosmicKind | null = forcedCosmic()): CosmicEvent | null {
  if (!cards.length) return null;
  const pool = CARDS.filter(pack.pool);
  const rank = (r: Rarity) => RARITIES.indexOf(r);
  const best = cards[cards.length - 1];
  const legend = [...cards].reverse().find((c) => c.rarity === 'legendary');
  const pick = (r: Rarity) => {
    const cands = pool.filter((c) => c.rarity === r && !cards.some((x) => x.id === c.id));
    return cands.length ? drawFairly(cands, rand) : null;
  };
  let kind: CosmicKind | null = null;
  let from: Card | undefined;
  let to: Rarity | null = null;
  // A wish: a golden comet catches one of the smaller stars on its way (never the best card's): a Common
  // becomes Rare, a Rare (now and then) Epic.
  const small = cards.slice(0, -1).filter((c) => c.rarity === 'common' || c.rarity === 'rare');
  const wishFor = (c: Card): Rarity => (c.rarity === 'common' ? 'rare' : 'epic');
  if (force === 'wish') {
    if (small.length) [kind, from, to] = ['wish', small[0], wishFor(small[0])];
  } else if (force) {
    kind = force;
    from = force === 'bigbang' ? (legend ?? best) : best;
    to = force === 'bigbang' ? 'omni' : force === 'supernova' ? 'mythic' : best.rarity === 'common' || best.rarity === 'rare' ? 'epic' : 'legendary';
  } else if (legend && rand() < COSMIC.bigBang) [kind, from, to] = ['bigbang', legend, 'omni'];
  else if (rank(best.rarity) < rank('mythic') && rand() < COSMIC.supernova) [kind, from, to] = ['supernova', best, 'mythic'];
  else if ((best.rarity === 'rare' || best.rarity === 'epic') && rand() < COSMIC.collision)
    [kind, from, to] = ['collision', best, best.rarity === 'epic' || rand() < COSMIC.collisionToLegendary ? 'legendary' : 'epic'];
  else if (small.length && rand() < COSMIC.wish) {
    // Rares are wished up less often than Commons.
    const c = small[Math.floor(rand() * small.length)];
    if (c.rarity === 'common' || rand() < COSMIC.wishToEpic) [kind, from, to] = ['wish', c, wishFor(c)];
  }
  if (!kind || !from || !to) return null;
  const card = pick(to);
  if (!card) return null;
  cards.splice(cards.indexOf(from), 1, card);
  cards.sort((a, b) => rank(a.rarity) - rank(b.rarity));
  return { kind, from, to: card };
}

/** `count` packs in a row, each with the luck the packs before it left: the cards, their cosmic events, and the pity after them. */
export function pullPacks(pack: Pack, count: number, boost: number, pity: number): { packs: Card[][]; events: CosmicEvent[]; pity: number } {
  const packs: Card[][] = [];
  const events: CosmicEvent[] = [];
  for (let i = 0; i < count; i++) {
    const cards = pullPack(pack, boost, Math.random, pityLuck(pity));
    const event = cosmicFor(pack, cards);
    if (event) events.push(event);
    packs.push(cards);
    pity = cards.some((c) => isTopRarity(c.rarity)) ? 0 : clampPity(pity + 1);
  }
  return { packs, events, pity: clampPity(pity) };
}
