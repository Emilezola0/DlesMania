// The claw machine (Casino → Claw), paid in casino tokens. Its box holds plushies (src/casino/plushies.ts),
// coin bags, ticket rolls, pack vouchers, card capsules, free scratch cards and a claw-only cosmetic: a new mix
// every day, the same for everyone, filled up again when it runs low. The player stops the claw twice (across,
// then front to back); it drops, closes and lifts. Aim matters most: dead on a prize's centre, the claw nearly
// always holds (a light prize all the more); and when it doesn't, a good aim still drags the prize well towards
// the chute (or carries it most of the way before it slips), so a well-aimed try is never wasted. Off-centre,
// the claw rarely holds and barely moves it.
// Every try that wins nothing fills a meter; when it's full the next grab can't slip.
// The numbers live in src/data/tuning/casino.json (`claw`).
import T from '../data/tuning/casino.json';
import { COLLECTIBLE, type Card } from '../gacha/cards';
import { hashString, mulberry32 } from '../lib/rng';
import { COSMETIC_BY_ID, CLAW_COSMETICS } from './cosmetics';
import { PLUSH_BY_ID, PLUSHIES, PLUSH_RARITY, type PlushRarity } from './plushies';

export const CLAW = T.claw as unknown as {
  cost: number;
  bundle: { tries: number; cost: number };
  dailyTries: number;
  meter: number;
  boxSize: number;
  restockBelow: number;
  reach: number;
  slip: number;
  plushOdds: Record<PlushRarity, number>;
  grip: Record<string, number>;
  coinBags: [number, number][];
  ticketRolls: [number, number][];
  capsuleOdds: { epic: number; legendary: number };
};

/** A prize in the box: what it is ("plush:kuma", "coins:500", "tokens:10", "pack", "capsule", "scratch", "cosmetic:wrap:plush") and where it lies (x across, 0 to 1 from the chute's side; z from the back, 0, to the front, 1). */
export interface ClawItem {
  uid: string;
  prize: string;
  x: number;
  z: number;
}

/** The chute: the box's left side; the claw carries what it holds there. */
export const CHUTE = { x: 0.1, z: 0.8, edge: 0.2 };
/** Where prizes lie: right of the chute, away from the glass. */
const AREA = { x0: 0.28, x1: 0.92, z0: 0.12, z1: 0.9 };

export interface PrizeLook {
  name: string;
  /** Its icon, or the plush's face. */
  icon: string;
  kind: 'plush' | 'coins' | 'tokens' | 'pack' | 'capsule' | 'scratch' | 'cosmetic';
  /** How well it holds (src/data/tuning/casino.json claw.grip). */
  grip: number;
  /** Bigger prizes look bigger. */
  size: number;
}

export function prizeLook(prize: string): PrizeLook {
  const [kind, ...rest] = prize.split(':');
  const arg = rest.join(':');
  const g = CLAW.grip;
  switch (kind) {
    case 'plush': {
      const p = PLUSH_BY_ID.get(arg);
      return { name: p ? `${p.name} plush` : 'A plush', icon: p?.face ?? '🧸', kind: 'plush', grip: g[p?.rarity ?? 'common'] ?? 0.7, size: p?.rarity === 'golden' ? 1.15 : 1 };
    }
    case 'coins': {
      const n = Number(arg);
      return { name: `${n.toLocaleString('en')} DleCoins`, icon: '💰', kind: 'coins', grip: n >= 2000 ? g.bigCoins : g.coins, size: n >= 2000 ? 1.15 : n >= 500 ? 1 : 0.85 };
    }
    case 'tokens':
      return { name: `${arg} casino tokens`, icon: '🎟️', kind: 'tokens', grip: g.tokens, size: 0.9 };
    case 'pack':
      return { name: 'A free card pack', icon: '🎴', kind: 'pack', grip: g.pack, size: 1 };
    case 'capsule':
      return { name: 'A card capsule (Epic or better)', icon: '🔮', kind: 'capsule', grip: g.capsule, size: 0.95 };
    case 'scratch':
      return { name: "A free Pirate's Chest scratch card", icon: '🎫', kind: 'scratch', grip: g.scratch, size: 0.9 };
    case 'cosmetic': {
      const c = COSMETIC_BY_ID.get(arg);
      return { name: c ? `${c.name} (${arg.startsWith('wrap:') ? 'pack wrapper' : arg.startsWith('title:') ? 'title' : 'name style'})` : 'A cosmetic', icon: '🎁', kind: 'cosmetic', grip: g.cosmetic, size: 1.05 };
    }
  }
  return { name: prize, icon: '❓', kind: 'coins', grip: 0.5, size: 1 };
}

const weighted = <V>(rand: () => number, list: [V, number][]): V => {
  let x = rand() * list.reduce((t, [, w]) => t + w, 0);
  return (list.find(([, w]) => (x -= w) < 0) ?? list[0])[0];
};

function randomPlush(rand: () => number): string {
  const rarity = weighted(rand, Object.entries(CLAW.plushOdds) as [PlushRarity, number][]);
  const pool = PLUSHIES.filter((p) => p.rarity === rarity);
  return `plush:${pool[Math.floor(rand() * pool.length)].id}`;
}

/** One prize, any kind: mostly plushies. */
function randomPrize(rand: () => number, cosmetics: string[]): string {
  const r = rand();
  if (r < 0.58) return randomPlush(rand);
  if (r < 0.72) return `coins:${weighted(rand, CLAW.coinBags)}`;
  if (r < 0.82) return `tokens:${weighted(rand, CLAW.ticketRolls)}`;
  if (r < 0.88) return 'pack';
  if (r < 0.93) return 'capsule';
  if (r < 0.98) return 'scratch';
  const left = CLAW_COSMETICS.filter((c) => !cosmetics.includes(c.id));
  return left.length ? `cosmetic:${left[Math.floor(rand() * left.length)].id}` : 'scratch';
}

/** A free spot in the box, away from the prizes already there. */
function spot(rand: () => number, box: { x: number; z: number }[]): { x: number; z: number } {
  let best = { x: 0.6, z: 0.5 };
  let bestGap = -1;
  for (let k = 0; k < 24; k++) {
    const p = { x: AREA.x0 + rand() * (AREA.x1 - AREA.x0), z: AREA.z0 + rand() * (AREA.z1 - AREA.z0) };
    const gap = Math.min(1, ...box.map((b) => Math.hypot(b.x - p.x, b.z - p.z)));
    if (gap > 0.2) return p;
    if (gap > bestGap) (best = p), (bestGap = gap);
  }
  return best;
}

let uidN = 0;
const uid = (rand: () => number) => `${Date.now().toString(36)}${(uidN++).toString(36)}${Math.floor(rand() * 1e6).toString(36)}`;

/** The day's box: the same mix for everyone that day (5 plushies, a coin bag, a ticket roll, a pack or capsule, a scratch card or cosmetic). */
export function boxFor(day: string, cosmetics: string[]): ClawItem[] {
  const rand = mulberry32(hashString(`claw:${day}`));
  const prizes = [randomPlush(rand), randomPlush(rand), randomPlush(rand), randomPlush(rand), randomPlush(rand), `coins:${weighted(rand, CLAW.coinBags)}`, `tokens:${weighted(rand, CLAW.ticketRolls)}`, rand() < 0.5 ? 'pack' : 'capsule'];
  const left = CLAW_COSMETICS.filter((c) => !cosmetics.includes(c.id));
  prizes.push(left.length && rand() < 0.5 ? `cosmetic:${left[Math.floor(rand() * left.length)].id}` : 'scratch');
  while (prizes.length < CLAW.boxSize) prizes.push(randomPrize(rand, cosmetics));
  const box: ClawItem[] = [];
  for (const prize of prizes.slice(0, CLAW.boxSize)) box.push({ uid: `${day}-${box.length}`, prize, ...spot(rand, box) });
  return box;
}

/** The box filled up again once it runs low. */
export function restock(box: ClawItem[], cosmetics: string[], rand = Math.random): ClawItem[] {
  if (box.length >= CLAW.restockBelow) return box;
  const out = [...box];
  while (out.length < CLAW.boxSize) out.push({ uid: uid(rand), prize: randomPrize(rand, cosmetics), ...spot(rand, out) });
  return out;
}

export type GrabOutcome =
  /** Nothing under the claw. */
  | { kind: 'miss' }
  /** Caught, but it fell as the claw lifted: nudged towards the chute, further the better the aim (`aim`, 0 to 1). */
  | { kind: 'lost'; uid: string; x: number; z: number; aim: number }
  /** Carried part of the way (`at`, 0 to 1), then it slipped and landed nearer the chute. */
  | { kind: 'slip'; uid: string; x: number; z: number; at: number; aim: number }
  /** In the chute: won (`lucky`: it slipped right into it). */
  | { kind: 'win'; uid: string; prize: string; at?: number; lucky?: boolean };

/** Where the claw catches when dropped at (x, z): the prize closest to it, if it's within reach. */
export function under(box: ClawItem[], x: number, z: number): { item: ClawItem; aim: number } | null {
  let best: ClawItem | null = null;
  let d = Infinity;
  for (const it of box) {
    const dd = Math.hypot(it.x - x, it.z - z);
    if (dd < d) (best = it), (d = dd);
  }
  const reach = CLAW.reach * (best ? prizeLook(best.prize).size : 1);
  return best && d <= reach ? { item: best, aim: 1 - d / reach } : null;
}

/**
 * The chance the claw holds a prize as it lifts: its grip, scaled by the aim, plus a bonus that only a good
 * aim earns. Dead centre on a common plush (grip 0.8): 97%; half-way to its edge: about 57%; near its edge: 25%.
 * A golden plush (grip 0.4): 85%, 34%, 13%.
 */
export const holdChance = (grip: number, aim: number) => Math.min(0.97, grip * (0.15 + 0.85 * aim) + 0.45 * aim * aim);

/** A grab at (x, z): `sure` when the meter is full (it holds and can't slip). */
export function grab(box: ClawItem[], x: number, z: number, sure: boolean, rand = Math.random): GrabOutcome {
  const hit = under(box, x, z);
  if (!hit) return { kind: 'miss' };
  const { item, aim } = hit;
  const grip = prizeLook(item.prize).grip;
  const toward = (f: number) => ({ x: item.x + (CHUTE.x - item.x) * f, z: item.z + (CHUTE.z - item.z) * f });
  if (!sure && rand() >= holdChance(grip, aim)) {
    // It fell as the claw lifted: dragged towards the chute, from a nudge (off-centre) to a third of the way (dead on).
    const p = toward(0.04 + 0.3 * aim + rand() * 0.05);
    return { kind: 'lost', uid: item.uid, x: Math.max(CHUTE.edge + 0.03, AREA.x0 - 0.04, p.x + (rand() - 0.5) * 0.03), z: Math.min(AREA.z1, Math.max(AREA.z0, p.z)), aim };
  }
  if (!sure && rand() < CLAW.slip * (1 - aim) ** 1.5 * (1.25 - grip)) {
    // The better the aim, the further it's carried before it slips.
    const at = Math.min(0.97, 0.3 + 0.55 * aim + rand() * 0.12);
    const p = toward(at);
    // It slipped over the chute: in!
    if (p.x <= CHUTE.edge) return { kind: 'win', uid: item.uid, prize: item.prize, at, lucky: true };
    return { kind: 'slip', uid: item.uid, x: p.x, z: Math.min(AREA.z1, Math.max(AREA.z0, p.z)), at, aim };
  }
  return { kind: 'win', uid: item.uid, prize: item.prize };
}

/** The cards a capsule can hold: Epic or Legendary (no places or techniques). */
const CAPSULE_POOL: Record<'epic' | 'legendary', Card[]> = { epic: [], legendary: [] };
for (const c of COLLECTIBLE) if (!c.place && !c.technique && (c.rarity === 'epic' || c.rarity === 'legendary')) CAPSULE_POOL[c.rarity].push(c);

export function capsuleCard(rand = Math.random): Card {
  const rarity = weighted(rand, [
    ['epic', CLAW.capsuleOdds.epic],
    ['legendary', CLAW.capsuleOdds.legendary],
  ] as ['epic' | 'legendary', number][]);
  const pool = CAPSULE_POOL[rarity];
  return pool[Math.floor(rand() * pool.length)];
}

/** What a plush won again is worth. */
export const plushDuplicate = (id: string) => PLUSH_RARITY[PLUSH_BY_ID.get(id)?.rarity ?? 'common'].duplicate;
