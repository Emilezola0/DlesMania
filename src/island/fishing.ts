// Fishing on the Island (src/island/IslandView.tsx): stand on the shore, click the sea to cast. The float dips:
// click in time to hook it, then stop the marker in the green zone of the reel bar (narrower for rarer catches).
// What can come up: a fish (a decoration for your island), a bottle with a seed inside (SEED.perDay a day, like the
// other capped seeds), or a few Dle Coins (paid like an arcade game, so it never beats the dailies). Pure: the store
// (src/store/progress.ts, fishReward) pays it.
import { SEEDS } from './seeds';

export type Catch = { kind: 'fish'; item: string } | { kind: 'seed'; seed: string } | { kind: 'coins'; coins: number };

/** The fish, how often each bites, and how wide the reel's green zone is for it (0..1 of the bar). */
export const FISH: { item: string; weight: number; zone: number }[] = [
  { item: 'fish-sardine', weight: 30, zone: 0.26 },
  { item: 'fish-clownfish', weight: 18, zone: 0.22 },
  { item: 'fish-pufferfish', weight: 12, zone: 0.18 },
  { item: 'fish-swordfish', weight: 5, zone: 0.12 },
  { item: 'fish-golden', weight: 2, zone: 0.09 },
];
export const FISHING = {
  /** A bottle with a seed: this often (weights, next to the fish). */
  bottle: 14,
  /** Dle Coins: this often, this many. */
  coins: 12,
  coinsPaid: 15,
  /** The reel bar's zone for a bottle and for coins. */
  bottleZone: 0.2,
  coinsZone: 0.14,
  /** Waiting for a bite (ms), and how long the float stays down. */
  waitMin: 1500,
  waitMax: 4500,
  bite: 1100,
  /** How long the marker takes to cross the bar (ms): faster for rarer things. */
  sweep: 900,
};

/** What's on the hook (decided when it bites). */
export function rollCatch(rand = Math.random): Catch {
  const total = FISH.reduce((n, f) => n + f.weight, 0) + FISHING.bottle + FISHING.coins;
  let r = rand() * total;
  for (const f of FISH) if ((r -= f.weight) < 0) return { kind: 'fish', item: f.item };
  if ((r -= FISHING.bottle) < 0) {
    const commons = SEEDS.filter((s) => s.tier === 'common');
    return { kind: 'seed', seed: commons[Math.floor(rand() * commons.length)].id };
  }
  return { kind: 'coins', coins: FISHING.coinsPaid };
}

/** The reel bar's green zone width for a catch. */
export const zoneOf = (c: Catch) => (c.kind === 'fish' ? (FISH.find((f) => f.item === c.item)?.zone ?? 0.2) : c.kind === 'seed' ? FISHING.bottleZone : FISHING.coinsZone);

/** Where the marker is on the bar (0..1), `ms` after the reel started: back and forth. */
export function markerAt(ms: number, sweep = FISHING.sweep): number {
  const t = (ms / sweep) % 2;
  return t < 1 ? t : 2 - t;
}
