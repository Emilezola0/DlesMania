// Special rarities: never in a pack, earned on a card the player already has (it keeps its picture and its own
// rarity underneath). Apex: an Omni's only rank, 10 copies of it (Omnis don't take grades). Relic: one card per set,
// picked once the set is complete and its boss beaten on Hell. Eclipse: a Mythic or Omni the black hole gave back
// eclipsed, or eclipsed with star shards (one per other star it swallowed). A card holds one at a time; Apex can
// take over an Eclipse. Names, colours, effects and numbers: src/data/tuning/special-rarities.json, made from the
// owner's sheet (sheets/rarities.xlsx, `npm run rarities:import`). The looks are .card-rank-* in src/index.css.
// Bond is apart: a card from a Bond pack two friends opened together (src/cloud/bonds.ts), linked to both; it's kept
// in the save's bondCards (with whom), and shows only on a card that has no other special rarity.
import T from '../data/tuning/special-rarities.json';
import type { Card, Rarity } from './cards';

export type RankId = 'apex' | 'relic' | 'eclipse' | 'bond';
export const RANK_IDS: RankId[] = ['relic', 'eclipse', 'apex'];

export interface RankInfo {
  id: RankId;
  name: string;
  gem: string;
  /** Main light, body, highlight (CSS --rk1, --rk2, --rk3). */
  colors: [string, string, string];
  blurb: string;
  how: string;
  /** Seconds for its slowest loop (the frame turning). */
  speed: number;
  /** Which of its layers show. */
  effects: Record<string, boolean>;
}

export const RANKS = Object.fromEntries(Object.entries(T).map(([id, r]) => [id, { ...r, id }])) as unknown as Record<RankId, RankInfo>;
export const isRank = (x: unknown): x is RankId => typeof x === 'string' && x in RANKS;

/** Apex: copies of the Omni it takes (the card and the rest as spares), and the DleCoins it pays. */
export const APEX_COPIES = T.apex.copies;
export const APEX_REWARD = T.apex.reward;
export const RELIC_REWARD = T.relic.reward;
/** Eclipse: the chance a swallowed card of these rarities comes back eclipsed, and the shards that eclipse one. */
export const ECLIPSE_CHANCE = T.eclipse.chance;
export const ECLIPSE_RARITIES = T.eclipse.rarities as Rarity[];
export const ECLIPSE_SHARDS = T.eclipse.shards;

/** A card's special rarity, who took it there and when. */
export interface CardRank {
  kind: RankId;
  date: string;
  by?: string;
}

/** Which rank wins when two saves disagree. */
export const rankOrder = (r: RankId | undefined) => (r ? RANK_IDS.indexOf(r) : -1);

export const canEclipse = (card: Pick<Card, 'rarity'>, rank?: RankId) => ECLIPSE_RARITIES.includes(card.rarity) && !rank;
export const canApex = (card: Pick<Card, 'rarity'>, rank?: RankId) => card.rarity === 'omni' && rank !== 'apex';

/** Bond: points a day both friends play the daily, the points a Bond pack costs, the chance it holds the Bond card. */
export const BOND_POINTS_PER_DAY = T.bond.pointsPerDay;
export const BOND_PACK_COST = T.bond.packCost;
export const BOND_CHANCE = T.bond.chance;
/** A card linked by a Bond pack: to whom, when. */
export interface BondLink {
  with: string;
  uid: string;
  date: string;
}

/** The card ids of a set that is a Relic, if one is (a card id starts with its set). */
export const relicOfSet = (ranks: Record<string, CardRank> | undefined, set: string) =>
  Object.entries(ranks ?? {}).find(([id, r]) => r.kind === 'relic' && id.split(':')[0] === set)?.[0];

/** Two saves' ranks: each card's higher one (Apex over Eclipse over Relic), the first date. */
export function mergeRanks(a: Record<string, CardRank> | undefined, b: Record<string, CardRank> | undefined): Record<string, CardRank> {
  const out: Record<string, CardRank> = { ...(a ?? {}) };
  for (const [id, r] of Object.entries(b ?? {})) {
    const o = out[id];
    if (!o || rankOrder(r.kind) > rankOrder(o.kind)) out[id] = r;
  }
  // One Relic per set: the first one made.
  const relics = new Map<string, string>();
  for (const [id, r] of Object.entries(out).sort((x, y) => x[1].date.localeCompare(y[1].date))) {
    if (r.kind !== 'relic') continue;
    const set = id.split(':')[0];
    if (relics.has(set)) delete out[id];
    else relics.set(set, id);
  }
  return out;
}
