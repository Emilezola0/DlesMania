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
  // Ore in the walls next to the rooms: iron, gold, crystal (richer than on the island), some coal.
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      if (g[idx(x, y)] !== 'dungeon-brick') continue;
      const open = [idx(x - 1, y), idx(x + 1, y), idx(x, y - 1), idx(x, y + 1)].some((c) => !g[c]);
      if (!open || rnd() > 0.07) continue;
      const r = rnd();
      set(x, y, r < 0.25 ? 'coal-ore' : r < 0.55 ? 'iron-ore' : r < 0.8 ? 'gold-ore' : 'crystal-ore');
    }
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
