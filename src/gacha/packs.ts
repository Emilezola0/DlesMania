// Card packs, bought with DleCoins: the general pack (every card), one per kind of work (video
// games, anime, movies), and one per franchise — locked until its Boss Battle is won, with better
// odds the harder the difficulty it was won at.
import { bossKey, type BossDifficulty } from '../store/progress';
import type { Domain } from '../types';
import { COLLECTIBLE, RARITIES, type Card, type Rarity } from './cards';
import { clampGolden, clampOmniPity, clampPity, GOLDEN, goldenNext, omniLuck, PITY_MAX, PITY_PACKS, PITY_STEP, PITY_TOP_SHARE, pityLuck } from './economy';
// The numbers and the packs' looks live in src/data/tuning/packs.json (edited from the dev-only #/admin page).
import T from '../data/tuning/packs.json';

export const PACK_SIZE = T.packSize;

/** Base odds, in percent, for each card of a pack. */
// Mythic and Omni are the endgame: about one in every 250 packs has one.
export const ODDS: Record<Rarity, number> = T.odds;

/** The luck (pity) lives with the economy, which the store reads without the card catalogue. */
export { clampPity, PITY_MAX, PITY_PACKS, PITY_STEP, PITY_TOP_SHARE, pityLuck };
/** The golden pack, every GOLDEN.packs-th: it lives with the economy too. */
export { clampGolden, GOLDEN, goldenNext };
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

export function oddsWith(boost: number, luck = 1, t: OddsTuning = LIVE_ODDS, omni = 1): Record<Rarity, number> {
  const half = 1 + (boost - 1) / 2;
  const quarter = 1 + (boost - 1) / 4;
  const rare = t.odds.rare * half;
  const epic = t.odds.epic * boost;
  const legendary = Math.min(t.topCap.legendary!, t.odds.legendary * half * luck);
  const topLuck = 1 + (luck - 1) * t.topShare;
  const mythic = Math.min(t.topCap.mythic!, t.odds.mythic * quarter * topLuck);
  // `omni`: the Omni luck of a player who hasn't had one for a while (see omniLuck), on the Omni odds alone.
  const omniOdds = Math.min(t.topCap.omni!, t.odds.omni * quarter * topLuck * omni);
  return { common: Math.max(0, 100 - rare - epic - legendary - mythic - omniOdds), rare, epic, legendary, mythic, omni: omniOdds };
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

/** A golden pack's top card: Omni, Mythic or else Legendary, by these chances (in percent). */
const rollGolden = (o: { mythic: number; omni: number }, rand: () => number): Rarity => {
  const x = rand() * 100;
  return x < o.omni ? 'omni' : x < o.omni + o.mythic ? 'mythic' : 'legendary';
};

/**
 * Five cards from a pack; the last one is at least rare. A rarity the pool lacks falls to the next one down.
 * A golden pack: its last GOLDEN.slots cards are Legendary or better (see GOLDEN).
 */
/**
 * For testing, in dev only (the Test lab, /test-lab): localStorage "omnidle-force-draw" = a JSON list, one entry a
 * slot: a card id (that card, from any set), a rarity (a card of it), or "" (drawn as usual). The live site ignores it.
 */
export const FORCE_DRAW = 'omnidle-force-draw';
/** With it: the forced draw is used by one purchase (its packs), then cleared. */
export const FORCE_DRAW_ONCE = 'omnidle-force-draw-once';
const forcedDraw = (): string[] => {
  if (!import.meta.env.DEV) return [];
  try {
    const v: unknown = JSON.parse(localStorage.getItem(FORCE_DRAW) ?? '[]');
    return Array.isArray(v) ? v.map((x) => (typeof x === 'string' ? x : '')) : [];
  } catch {
    return [];
  }
};

export function pullPack(pack: Pack, boost = 1, rand: () => number = Math.random, luck = 1, golden = false, force: string[] = [], omni = 1): Card[] {
  const pool = COLLECTIBLE.filter(pack.pool);
  const odds = oddsWith(boost, luck, LIVE_ODDS, omni);
  const taken = new Set<string>();
  return Array.from({ length: PACK_SIZE }, (_, i) => {
    // A rigged slot (dev only): that card, or a card of that rarity (from the pack, else from any set).
    const rigged = force[i] ?? '';
    const exact = rigged && COLLECTIBLE.find((c) => c.id === rigged);
    if (exact) return (taken.add(exact.id), exact);
    if ((RARITIES as string[]).includes(rigged)) {
      const of = (list: Card[]) => list.filter((c) => c.rarity === rigged && !taken.has(c.id));
      const cands = of(pool).length ? of(pool) : of(COLLECTIBLE);
      if (cands.length) {
        const card = drawFairly(cands, rand);
        taken.add(card.id);
        return card;
      }
    }
    const goldSlot = golden && i >= PACK_SIZE - GOLDEN.slots;
    let r = goldSlot ? rollGolden(i === PACK_SIZE - 1 ? GOLDEN.last : GOLDEN.others, rand) : rollRarity(i === PACK_SIZE - 1 ? lastCardOdds(odds) : odds, rand);
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
 * "bigbang" plays it on the first pack of a purchase (one Omni from a Big Bang, not five), or on every pack with
 * "omnidle-force-cosmic-all" = "1". The live site ignores it (it would hand out an Omni a pack).
 */
const cosmicOnAll = () => {
  try {
    return localStorage.getItem('omnidle-force-cosmic-all') === '1';
  } catch {
    return false;
  }
};
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
  const pool = COLLECTIBLE.filter(pack.pool);
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

/** Legendary, Mythic and Omni cards: counted in a pack, or expected of one. */
export interface TopCount {
  legendary: number;
  mythic: number;
  omni: number;
}
export const topOf = (cards: Card[]): TopCount => ({
  legendary: cards.filter((c) => c.rarity === 'legendary').length,
  mythic: cards.filter((c) => c.rarity === 'mythic').length,
  omni: cards.filter((c) => c.rarity === 'omni').length,
});

/**
 * The Legendary, Mythic and Omni cards a pack gives on average, with the odds it is rolled with (boost, pity luck,
 * golden): every slot's chances added up, then the cosmic events that lift a card (a Big Bang, a supernova, a
 * collision), closely reckoned. For the luck report (src/cloud/luck.ts): what a player pulled against this.
 */
export function expectedTop(boost: number, luck: number, golden: boolean, omniBoost = 1): TopCount {
  const odds = oddsWith(boost, luck, LIVE_ODDS, omniBoost);
  const slots = Array.from({ length: PACK_SIZE }, (_, i) => {
    const last = i === PACK_SIZE - 1;
    if (golden && i >= PACK_SIZE - GOLDEN.slots) {
      const o = last ? GOLDEN.last : GOLDEN.others;
      return { low: 0, epic: 0, l: 1 - (o.mythic + o.omni) / 100, m: o.mythic / 100, o: o.omni / 100 };
    }
    const p = last ? lastCardOdds(odds) : odds;
    return { low: (p.common + p.rare) / 100, epic: p.epic / 100, l: p.legendary / 100, m: p.mythic / 100, o: p.omni / 100 };
  });
  type Slot = (typeof slots)[number];
  const sum = (f: (s: Slot) => number) => slots.reduce((n, s) => n + f(s), 0);
  const all = (f: (s: Slot) => number) => slots.reduce((n, s) => n * f(s), 1);
  let legendary = sum((s) => s.l);
  let mythic = sum((s) => s.m);
  let omni = sum((s) => s.o);
  // The pack's best card: below Mythic, below Legendary, Rare or less.
  const belowMythic = all((s) => 1 - s.m - s.o);
  const noTop = all((s) => 1 - s.l - s.m - s.o);
  const rareBest = all((s) => s.low);
  // A Big Bang: a Legendary becomes an Omni.
  const bigBang = (1 - all((s) => 1 - s.l)) * COSMIC.bigBang;
  // A supernova (no Big Bang): the best card, below Mythic, becomes a Mythic.
  const legendBest = belowMythic - noTop;
  const supernova = (noTop + legendBest * (1 - COSMIC.bigBang)) * COSMIC.supernova;
  // A collision (neither): the best card, Rare or Epic, becomes Epic or Legendary.
  const collision = (1 - COSMIC.supernova) * COSMIC.collision * (noTop - rareBest + rareBest * COSMIC.collisionToLegendary);
  omni += bigBang;
  mythic += supernova;
  legendary += collision - bigBang - legendBest * (1 - COSMIC.bigBang) * COSMIC.supernova;
  return { legendary: Math.max(0, legendary), mythic, omni };
}

/**
 * `count` packs in a row, each with the luck the packs before it left: the cards, their cosmic events, and the
 * pity after them; and the golden counter after them, with which of the packs came golden (`goldenAt`). With the
 * Legendary, Mythic and Omni cards they gave (`top`) and the ones their odds promised (`expected`), for the luck report.
 */
export function pullPacks(pack: Pack, count: number, boost: number, pity: number, golden = 0, omniPity = 0): { packs: Card[][]; events: CosmicEvent[]; pity: number; golden: number; goldenAt: number[]; omniPity: number; top: TopCount; expected: TopCount } {
  const packs: Card[][] = [];
  const events: CosmicEvent[] = [];
  const goldenAt: number[] = [];
  const forced = forcedDraw();
  const top: TopCount = { legendary: 0, mythic: 0, omni: 0 };
  const expected: TopCount = { legendary: 0, mythic: 0, omni: 0 };
  for (let i = 0; i < count; i++) {
    const gold = goldenNext(golden) || forcedGolden();
    if (gold) goldenAt.push(i);
    golden = gold ? 0 : clampGolden(golden + 1);
    const e = expectedTop(boost, pityLuck(pity), gold, omniLuck(omniPity));
    const cards = pullPack(pack, boost, Math.random, pityLuck(pity), gold, forced, omniLuck(omniPity));
    // A forced event (dev only): the first pack of the purchase, or every one when asked; the others roll as usual.
    const event = cosmicFor(pack, cards, Math.random, i === 0 || cosmicOnAll() ? forcedCosmic() : null);
    if (event) events.push(event);
    packs.push(cards);
    const t = topOf(cards);
    for (const k of ['legendary', 'mythic', 'omni'] as const) (top[k] += t[k]), (expected[k] += e[k]);
    pity = cards.some((c) => isTopRarity(c.rarity)) ? 0 : clampPity(pity + 1);
    // The Omni luck: only an Omni sets it back (a cosmic event's too).
    omniPity = cards.some((c) => c.rarity === 'omni') || event?.to.rarity === 'omni' ? 0 : clampOmniPity(omniPity + 1);
  }
  if (import.meta.env.DEV) {
    try {
      if (localStorage.getItem(FORCE_DRAW_ONCE) === '1') (localStorage.removeItem(FORCE_DRAW), localStorage.removeItem(FORCE_DRAW_ONCE));
    } catch {
      // No storage: nothing was forced.
    }
  }
  return { packs, events, pity: clampPity(pity), golden: clampGolden(golden), goldenAt, omniPity: clampOmniPity(omniPity), top, expected };
}

/** For testing, in dev only: localStorage "omnidle-force-golden" = "1" makes every pack golden. The live site ignores it. */
const forcedGolden = (): boolean => {
  if (!import.meta.env.DEV) return false;
  try {
    return localStorage.getItem('omnidle-force-golden') === '1';
  } catch {
    return false;
  }
};
