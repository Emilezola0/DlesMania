// The dungeon (stage C): under the Island, through the gate in the valley. A new one every week (made from the week,
// the same for everyone), never built on: rooms joined by corridors and ladders, torches, spikes (they send you back
// to the gate), ore in the walls (richer than on the island), and chests holding Dle Coins, a seed and materials.
// Each player explores their own: what they mined and the chests they opened are kept in their save until the week
// ends (src/store/progress.ts, dungeon). It's drawn and played by the Island's own view (src/island/IslandView.tsx):
// a dungeon is an Island whose `world` names it, its walls the world's ground (setWorldGround).
import { idx, ISLAND, setWorldGround, type Island } from './island';
import { SEEDS } from './seeds';

/** Rooms: a grid of DUNGEON.cols × DUNGEON.rows, each in a ROOM × ROOM block. */
export const DUNGEON = { cols: 8, rows: 4, room: 12, chests: 10 };

/**
 * The dungeon's biomes, one a row of rooms, deeper and deeper: the crypt (spikes), the frozen caves (ice floors you
 * slide on, icicles under the ceilings), the overgrown ruins (thorns, vines to climb), the magma depths (lava pools to
 * jump over, fire jets that flare now and then). Each its own walls; all of them unbreakable, their ore excepted.
 */
export const BIOMES = [
  { id: 'crypt', wall: 'dungeon-brick', name: 'The crypt', fr: 'La crypte' },
  { id: 'ice', wall: 'dungeon-ice', name: 'The frozen caves', fr: 'Les grottes gelées' },
  { id: 'jungle', wall: 'dungeon-moss', name: 'The overgrown ruins', fr: 'Les ruines envahies' },
  { id: 'magma', wall: 'dungeon-basalt', name: 'The magma depths', fr: 'Les profondeurs de magma' },
] as const;
export type BiomeId = (typeof BIOMES)[number]['id'];
/** The biome at a row of cells. */
export const biomeAt = (y: number) => BIOMES[Math.max(0, Math.min(BIOMES.length - 1, Math.floor(y / DUNGEON.room)))];
/** A fire jet flares a second in three (all at once, the same for everyone). */
export const FIRE_JET = { period: 3000, on: 1000 };
export const fireJetOn = (now = Date.now()) => now % FIRE_JET.period < FIRE_JET.on;

/** A little random generator from a word (the week). */
function rng(word: string) {
  let s = 2166136261;
  for (const c of word) s = Math.imul(s ^ c.charCodeAt(0), 16777619);
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

interface Built {
  ground: (string | undefined)[];
  /** The gate's cell (where you come in and go out). */
  entry: number;
}
const built = new Map<string, Built>();

/** The week's dungeon, made once. */
export function dungeonOf(week: string): Built {
  const had = built.get(week);
  if (had) return had;
  const { w, h } = ISLAND;
  const R = DUNGEON.room;
  const rnd = rng(`dungeon ${week}`);
  const pick = (n: number) => Math.floor(rnd() * n);
  const g: (string | undefined)[] = new Array(w * h).fill('dungeon-brick');
  const set = (x: number, y: number, id: string | undefined) => (g[idx(x, y)] = id);
  // The rooms: interiors (x0..x1, y0..floor-1), the floor row below them.
  const rooms: { x0: number; x1: number; y0: number; floor: number }[][] = [];
  for (let gx = 0; gx < DUNGEON.cols; gx++) {
    rooms[gx] = [];
    for (let gy = 0; gy < DUNGEON.rows; gy++) {
      const bx = gx * R;
      const by = gy * R;
      const r = { x0: bx + 1 + pick(2), x1: bx + R - 2 - pick(2), y0: by + 2 + pick(3), floor: by + R - 2 };
      rooms[gx][gy] = r;
      for (let x = r.x0; x <= r.x1; x++) for (let y = r.y0; y < r.floor; y++) set(x, y, undefined);
    }
  }
  // Joined: a maze through every room (from the gate's), then a few loops.
  const startX = 3 + pick(2);
  const seen = new Set([`${startX},0`]);
  const ladders: number[] = [];
  const join = (ax: number, ay: number, bx: number, by: number) => {
    const a = rooms[ax][ay];
    const b = rooms[bx][by];
    if (ay === by) {
      // A corridor along the floor, three high.
      const [l, r] = ax < bx ? [a, b] : [b, a];
      for (let x = l.x1; x <= r.x0; x++) for (let y = a.floor - 3; y < a.floor; y++) set(x, y, undefined);
    } else {
      // A shaft down through the floor, with a ladder.
      const [up, down] = ay < by ? [a, b] : [b, a];
      const lo = Math.max(up.x0, down.x0) + 1;
      const hi = Math.min(up.x1, down.x1) - 1;
      const x = lo + pick(Math.max(1, hi - lo));
      for (let y = up.floor; y < down.y0; y++) set(x, y, undefined);
      for (let y = up.floor; y < down.floor; y++) set(x, y, 'rope-ladder'), ladders.push(idx(x, y));
    }
  };
  const walk = (gx: number, gy: number) => {
    const ways = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ].sort(() => rnd() - 0.5);
    for (const [dx, dy] of ways) {
      const nx = gx + dx;
      const ny = gy + dy;
      if (nx < 0 || ny < 0 || nx >= DUNGEON.cols || ny >= DUNGEON.rows || seen.has(`${nx},${ny}`)) continue;
      seen.add(`${nx},${ny}`);
      join(gx, gy, nx, ny);
      walk(nx, ny);
    }
  };
  walk(startX, 0);
  for (let i = 0; i < 6; i++) {
    const gx = pick(DUNGEON.cols - 1);
    const gy = pick(DUNGEON.rows);
    join(gx, gy, gx + 1, gy);
  }
  // In each room: a torch or two; in tall rooms, a platform. The gate in the first room.
  const floorSpots = (r: (typeof rooms)[0][0]) => {
    const out: number[] = [];
    for (let x = r.x0; x <= r.x1; x++) if (!g[idx(x, r.floor - 1)] && g[idx(x, r.floor)] === 'dungeon-brick') out.push(x);
    return out;
  };
  for (let gx = 0; gx < DUNGEON.cols; gx++)
    for (let gy = 0; gy < DUNGEON.rows; gy++) {
      const r = rooms[gx][gy];
      for (const x of [r.x0, r.x1]) if (!g[idx(x, r.y0 + 1)]) set(x, r.y0 + 1, 'wall-torch');
      if (r.floor - r.y0 >= 7) {
        const px = r.x0 + 2 + pick(Math.max(1, r.x1 - r.x0 - 5));
        for (let x = px; x < px + 3; x++) if (!g[idx(x, r.floor - 4)]) set(x, r.floor - 4, 'wood-platform');
      }
    }
  const first = rooms[startX][0];
  const gateX = floorSpots(first)[Math.floor(floorSpots(first).length / 2)];
  const entry = idx(gateX, first.floor - 1);
  g[entry] = 'dungeon-gate';
  // Chests in rooms away from the gate; spikes here and there (never next to a chest, a ladder or the gate).
  const others = rooms.flatMap((col, gx) => col.map((r, gy) => ({ r, gx, gy }))).filter((o) => !(o.gx === startX && o.gy === 0));
  others.sort(() => rnd() - 0.5);
  for (const { r } of others.slice(0, DUNGEON.chests)) {
    const spots = floorSpots(r);
    if (spots.length) set(spots[pick(spots.length)], r.floor - 1, 'dungeon-chest');
  }
  for (const { r } of others.slice(DUNGEON.chests - 4, DUNGEON.chests + 6)) {
    const spots = floorSpots(r).filter((x) => [x - 1, x, x + 1].every((xx) => !g[idx(xx, r.floor - 1)] && !ladders.includes(idx(xx, r.floor - 1))));
    if (spots.length) set(spots[pick(spots.length)], r.floor - 1, 'spikes');
  }
  // Each biome's traps, in its rooms (the gate's room left alone; never next to a chest, a ladder or the gate).
  const free = (x: number, y: number) => !g[idx(x, y)] && !ladders.includes(idx(x, y));
  for (let gx = 0; gx < DUNGEON.cols; gx++)
    for (let gy = 0; gy < DUNGEON.rows; gy++) {
      if (gx === startX && gy === 0) continue;
      const r = rooms[gx][gy];
      const biome = BIOMES[gy].id;
      const spots = floorSpots(r).filter((x) => [x - 1, x, x + 1].every((xx) => free(xx, r.floor - 1)));
      const some = (n: number) => spots.sort(() => rnd() - 0.5).slice(0, n);
      if (biome === 'ice') {
        // Icicles under the ceiling (they hurt whoever jumps into them).
        for (let k = 0; k < 2; k++) {
          const x = r.x0 + 1 + pick(Math.max(1, r.x1 - r.x0 - 1));
          if (free(x, r.y0) && g[idx(x, r.y0 - 1)] === 'dungeon-brick') set(x, r.y0, 'icicles');
        }
      } else if (biome === 'jungle') {
        for (const x of some(1 + pick(2))) set(x, r.floor - 1, 'thorns');
        // A vine down a wall, to climb.
        // (A column in from the wall: the torches hang on the wall's own.)
        if (rnd() < 0.7) {
          const x = rnd() < 0.5 ? r.x0 + 1 : r.x1 - 1;
          if ([...Array(r.floor - r.y0).keys()].every((k) => free(x, r.y0 + k))) for (let y = r.y0; y < r.floor; y++) set(x, y, 'jungle-vine');
        }
      } else if (biome === 'magma') {
        // A lava pool sunk into the floor (two cells: a jump clears it), and a fire jet.
        const pool = spots.filter((x) => spots.includes(x + 1) && x + 1 < r.x1);
        if (pool.length) {
          const x = pool[pick(pool.length)];
          set(x, r.floor, 'lava');
          set(x + 1, r.floor, 'lava');
        }
        const jet = spots.filter((x) => g[idx(x, r.floor)] === 'dungeon-brick' && free(x, r.floor - 1));
        if (jet.length) set(jet[pick(jet.length)], r.floor - 1, 'fire-jet');
      }
    }
  // Ore in the walls next to the rooms: iron, gold, crystal (richer than on the island), some coal.
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      if (g[idx(x, y)] !== 'dungeon-brick') continue;
      const open = [idx(x - 1, y), idx(x + 1, y), idx(x, y - 1), idx(x, y + 1)].some((c) => !g[c]);
      if (!open || rnd() > 0.07) continue;
      const r = rnd();
      set(x, y, r < 0.25 ? 'coal-ore' : r < 0.55 ? 'iron-ore' : r < 0.8 ? 'gold-ore' : 'crystal-ore');
    }
  // Each biome's own walls.
  for (let c = 0; c < w * h; c++) if (g[c] === 'dungeon-brick') g[c] = biomeAt(Math.floor(c / w)).wall;
  const out = { ground: g, entry };
  built.set(week, out);
  return out;
}

/** The week's dungeon as an Island (with what this player already changed in it). */
export function dungeonIsland(week: string, fg: Record<string, string> = {}): Island {
  const world = `dungeon:${week}`;
  setWorldGround(world, dungeonOf(week).ground);
  return { fg, bg: {}, plots: {}, shown: {}, crossed: [], v: 2, world };
}

/** What's in a chest: Dle Coins, maybe a seed (capped a day like the other seeds), and a material or two. */
export interface Loot {
  coins: number;
  seed: string | null;
  items: string[];
}
export const LOOT = { coins: [20, 50] as const, seed: 0.6, rareSeed: 0.2 };
export function rollLoot(rand = Math.random): Loot {
  const coins = LOOT.coins[0] + Math.floor(rand() * (LOOT.coins[1] - LOOT.coins[0] + 1));
  let seed: string | null = null;
  if (rand() < LOOT.seed) {
    const pool = SEEDS.filter((s) => s.tier === (rand() < LOOT.rareSeed ? 'rare' : 'common'));
    seed = pool[Math.floor(rand() * pool.length)].id;
  }
  const mats = ['iron-ore', 'gold-ore', 'gold-ore', 'crystal-ore', 'crystal-ore', 'coal-ore'];
  const items = Array.from({ length: 1 + Math.floor(rand() * 2) }, () => mats[Math.floor(rand() * mats.length)]);
  return { coins, seed, items };
}
