// The Island's seeds (src/data/seeds.json). Each game has its seed family: finishing one of TODAY's rounds gives its
// common seed (a win or not), and a win may add its rare seed, likelier the better the score. Boss fights and the
// arcade give theirs a few times a day (SEED.perDay). The Archive gives none: seeds follow the daily. Finishing all ten
// of a category today gives the Seed of the Day, a hybrid that otherwise only comes from crossing two families'
// seeds on the Island (stage 2).
import { create } from 'zustand';
import data from '../data/seeds.json';
import { todayKey } from '../lib/date';

export type SeedTier = 'common' | 'rare' | 'hybrid';
export type ItemKind = 'block' | 'floor' | 'wall' | 'decor' | 'furniture' | 'light' | 'music' | 'plant' | 'frame' | 'screen' | 'door' | 'rail' | 'zip' | 'craft' | 'chest' | 'spikes' | 'gate' | 'stairs' | 'ladder' | 'platform' | 'bounce' | 'warp' | 'reader' | 'disc' | 'stone' | 'weapon' | 'qdoor' | 'arch' | 'scenery';
export interface SeedFamily {
  id: string;
  source: string;
  name: string;
  fr: string;
  icon: string;
  color: string;
}
export interface Seed {
  id: string;
  tier: SeedTier;
  family?: string;
  cross?: [string, string];
  name: string;
  fr: string;
  grows: string[];
}
export interface IslandItem {
  id: string;
  kind: ItemKind;
  icon: string;
  name: string;
  fr: string;
}

export const FAMILIES = data.families as SeedFamily[];
export const SEEDS = data.seeds as Seed[];
export const ITEMS = data.items as IslandItem[];
export const FAMILY_BY_ID = new Map(FAMILIES.map((f) => [f.id, f]));
export const SEED_BY_ID = new Map(SEEDS.map((s) => [s.id, s]));
export const ITEM_BY_ID = new Map(ITEMS.map((i) => [i.id, i]));
export const HYBRIDS = SEEDS.filter((s) => s.tier === 'hybrid');
const seedOf = (family: string, tier: SeedTier) => SEEDS.find((s) => s.family === family && s.tier === tier)!;

/** The family's colour, or for a hybrid its two families'. */
export const seedColors = (s: Seed): [string, string] => {
  if (s.cross) return [FAMILY_BY_ID.get(s.cross[0])!.color, FAMILY_BY_ID.get(s.cross[1])!.color];
  const c = FAMILY_BY_ID.get(s.family!)!.color;
  return [c, c];
};

export const SEED = {
  /** A rare seed's chance after a daily round won: score (0–100) / this. A perfect round: 40 %. */
  rareDivisor: 250,
  /** A boss win's chance of the rare seed, by difficulty. */
  bossRare: { easy: 0.15, medium: 0.25, hard: 0.4, hell: 0.7 } as Record<string, number>,
  /** An arcade or JLPT game's chance of the rare seed. */
  arcadeRare: 0.1,
  /** Seeds a day from boss fights, from the arcade, and from the JLPT games (each). */
  perDay: 3,
};

/** Today's Seed of the Day: a hybrid, the same for everyone, by the date. */
export function seedOfTheDay(day = todayKey()): Seed {
  let h = 0;
  for (const c of day) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return HYBRIDS[h % HYBRIDS.length];
}

/** What a finished daily round drops: its game's common seed, and maybe its rare one (by the score). */
export function roundSeeds(game: string, won: boolean, score: number, rand = Math.random): string[] {
  if (!FAMILY_BY_ID.has(game)) return [];
  const out = [seedOf(game, 'common').id];
  if (won && rand() < Math.max(0, score) / SEED.rareDivisor) out.push(seedOf(game, 'rare').id);
  return out;
}

/** A boss fight: the Trophy seed, and on a win maybe the Champion seed. */
export function bossSeeds(won: boolean, difficulty: string, rand = Math.random): string[] {
  const out = [seedOf('boss', 'common').id];
  if (won && rand() < (SEED.bossRare[difficulty] ?? 0)) out.push(seedOf('boss', 'rare').id);
  return out;
}

/** An arcade game (or a JLPT one): its family's common seed, now and then the rare. */
export function arcadeSeeds(family: 'arcade' | 'jlpt', rand = Math.random): string[] {
  const out = [seedOf(family, 'common').id];
  if (rand() < SEED.arcadeRare) out.push(seedOf(family, 'rare').id);
  return out;
}

/** The day's book of capped seeds: how many each source gave today, and whether the Seed of the Day came. */
export interface SeedLog {
  day: string;
  n: Record<string, number>;
  sotd?: boolean;
}
export const seedLogNow = (l: SeedLog | undefined): SeedLog => (l && l.day === todayKey() ? l : { day: todayKey(), n: {} });

/** The seeds added to the bag, and the first time each was found (the Seed Book). Announces them too. */
export function withSeeds(s: { seeds?: Record<string, number>; seedsFound?: Record<string, string> }, ids: string[]) {
  if (!ids.length) return {};
  const seeds = { ...(s.seeds ?? {}) };
  const seedsFound = { ...(s.seedsFound ?? {}) };
  const fresh: string[] = [];
  for (const id of ids) {
    seeds[id] = (seeds[id] ?? 0) + 1;
    if (!seedsFound[id]) {
      seedsFound[id] = todayKey();
      fresh.push(id);
    }
  }
  useSeedDrops.getState().push(ids, fresh);
  return { seeds, seedsFound };
}

/** Seeds just dropped, for the little popup (not saved). */
interface SeedDrops {
  drops: { key: number; ids: string[]; fresh: string[] }[];
  push: (ids: string[], fresh: string[]) => void;
  clear: (key: number) => void;
}
export const useSeedDrops = create<SeedDrops>()((set) => ({
  drops: [],
  push: (ids, fresh) => set((s) => ({ drops: [...s.drops.slice(-3), { key: Date.now() + Math.random(), ids, fresh }] })),
  clear: (key) => set((s) => ({ drops: s.drops.filter((d) => d.key !== key) })),
}));
