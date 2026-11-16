// The Island (stage 2a): a small 2D island seen from the side, a grid of ISLAND.w × ISLAND.h cells. Each cell has a
// front layer (`fg`: the ground, a block, a lamp, a sofa…) and a back one (`bg`: a wallpaper behind). Plant two
// seeds in a plot on the ground; a day or two later it gives one of the things they grow, maybe a seed back, and the
// first time two families are crossed, their hybrid. Everything here is pure: the store (src/store/progress.ts)
// saves what these return.
import { todayKey } from '../lib/date';
import { FAMILY_BY_ID, HYBRIDS, ITEM_BY_ID, SEED_BY_ID, type IslandItem, type Seed } from './seeds';

export const ISLAND = {
  w: 96,
  h: 48,
  /** The sea's surface (cells from the top); the shore columns are sea below it. */
  sea: 22,
  /** How far from the player (in cells) you can build. */
  reach: 5,
  /** Days a plot takes: two commons, or anything with a rare or a hybrid in it. */
  growCommon: 1,
  growRare: 2,
  /** A seed back from a harvest: this chance. */
  seedBack: 0.3,
};

/** The ground, which isn't an item: dirt (grass on top when nothing is above it) and stone deeper down. */
export const NATURAL: Record<string, { name: string; fr: string; color: string }> = {
  dirt: { name: 'Dirt', fr: 'Terre', color: '#8b5a2b' },
  stone: { name: 'Stone', fr: 'Pierre', color: '#6b7280' },
  'coal-ore': { name: 'Coal ore', fr: 'Minerai de charbon', color: '#27272a' },
  'iron-ore': { name: 'Iron ore', fr: 'Minerai de fer', color: '#d6a47c' },
  'gold-ore': { name: 'Gold ore', fr: 'Minerai d’or', color: '#facc15' },
  'crystal-ore': { name: 'Crystal ore', fr: 'Minerai de cristal', color: '#67e8f9' },
  /** The bottom of the world: can't be dug. */
  bedrock: { name: 'Bedrock', fr: 'Roche mère', color: '#1f1d24' },
  /** The dungeon's walls (src/island/dungeon.ts): can't be dug either. */
  'dungeon-brick': { name: 'Dungeon brick', fr: 'Brique de donjon', color: '#3b3346' },
  /** The other biomes' walls (src/island/dungeon.ts, BIOMES). */
  'dungeon-ice': { name: 'Frozen wall', fr: 'Mur gelé', color: '#9ad8f0' },
  'dungeon-moss': { name: 'Mossy ruin', fr: 'Ruine moussue', color: '#4d6b3a' },
  'dungeon-basalt': { name: 'Basalt', fr: 'Basalte', color: '#2a1d1d' },
};
/** Ground no pickaxe breaks. */
const UNBREAKABLE = new Set(['bedrock', 'dungeon-brick', 'dungeon-ice', 'dungeon-moss', 'dungeon-basalt']);

export interface Plot {
  a: string;
  b: string;
  /** The day it was planted. */
  day: string;
  /** Who planted it (on a shared island: theirs to harvest). */
  by?: string;
  /** The day a friend watered it (a day sooner), and who. */
  water?: string;
  waterBy?: string;
}
export interface Island {
  fg: Record<string, string>;
  bg: Record<string, string>;
  plots: Record<string, Plot>;
  /** A frame's cell → the card it shows. */
  shown: Record<string, string>;
  /** Family pairs already crossed ("a+b", sorted): their hybrid came. */
  crossed: string[];
  /** On a shared island: who placed what's in a cell ("<cell>" middle, "b<cell>" behind, "t<cell>" in front). A builder picks up only their own. */
  by?: Record<string, string>;
  /** The front layer: things drawn in front of the player (a garland, a lantern, a plant pot…). */
  front?: Record<string, string>;
  /**
   * A music maker's setting, by its key ("<cell>", "b<cell>", "t<cell>"): "off", the disc it plays, or a YouTube video
   * ("yt:<id>", a radio's, or a TV's by its cell). And each device's volume ("vol:<key>": "0"–"100"), and the device a
   * speaker plays ("to:<key>": that radio's or TV's key).
   */
  tune?: Record<string, string>;
  /** The world's version: 2 since it grew (ISLAND_V); older islands are moved into it by upgradeIsland. */
  v?: number;
  /** Another world than the Island (the week's dungeon: "dungeon:<week>"), its ground set by setWorldGround. Never saved online. */
  world?: string;
}

/** The three layers a thing can go in: behind (with the walls), the middle (where you walk), in front of you. */
export type Layer = 'back' | 'mid' | 'front';
export const layerKey = (layer: Layer, cell: number) => (layer === 'back' ? `b${cell}` : layer === 'front' ? `t${cell}` : String(cell));
/** What may go behind or in front: things that are only looked at (never the ground, blocks, tools or frames). */
/**
 * What stays in the middle only: tools you use where you walk (doors, ladders, platforms, trampolines, warp pads), and
 * what shows a card (frames, screens, readers). Anything else may also go behind or in front, as decoration only: a
 * block or a fence there is never solid, you walk past it.
 */
const MIDDLE_ONLY = new Set(['door', 'ladder', 'platform', 'bounce', 'warp', 'frame', 'screen', 'reader', 'disc', 'rail', 'zip', 'craft', 'chest', 'spikes', 'gate']);
/** Things that belong to the world itself (the dungeon's gate, its chests and spikes): never picked up. */
const FIXED = new Set(['chest', 'spikes', 'gate']);
export const canLayer = (id: string, layer: Layer) => {
  const k = kindOf(id);
  if (!k || k === 'natural' || k === 'disc') return layer === 'mid' && k === 'natural';
  if (layer === 'mid') return k !== 'wall';
  if (layer === 'back') return !MIDDLE_ONLY.has(k);
  return k !== 'wall' && !MIDDLE_ONLY.has(k);
};

/** Who is moving, on whose island: offline, nobody (all allowed). */
export interface Who {
  uid: string;
  owner: string;
}
const mayTake = (isl: Island, key: string, who?: Who) => !who || who.uid === who.owner || isl.by?.[key] === who.uid;
const withBy = (isl: Island, key: string, who?: Who) => (who ? { ...(isl.by ?? {}), [key]: who.uid } : isl.by);
const withoutBy = (isl: Island, key: string) => {
  if (!isl.by?.[key]) return isl.by;
  const { [key]: _, ...rest } = isl.by;
  return rest;
};

export const idx = (x: number, y: number) => y * ISLAND.w + x;
export const xy = (i: number) => ({ x: i % ISLAND.w, y: Math.floor(i / ISLAND.w) });
const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < ISLAND.w && y < ISLAND.h;

/**
 * Stage B, the world grew: twice as wide and much taller. Islands from before were 48 × 14; they sit in the middle of
 * the new world, at OLD.x, OLD.y (upgradeIsland moves them there), with new land on both sides: a big hill on the
 * left, a valley then a hill on the right, beaches and the sea at both ends. Under the ground: dirt, then stone with
 * ores (deeper is rarer), caves, and bedrock at the bottom. Up in the sky: little floating islands.
 */
export const OLD = { w: 48, h: 14, x: 24, y: 12 };
export const ISLAND_V = 2;

/** The island's ground height at each column (the top cell of the ground; the sea columns have none). */
export function surfaceAt(x: number): number {
  const { w, sea } = ISLAND;
  if (x < 4 || x >= w - 4) return ISLAND.h; // the sea: no ground
  const lx = x - OLD.x;
  if (lx >= 4 && lx < OLD.w - 4) {
    // The old island's gentle hill, as it was.
    const t = (lx - 4) / (OLD.w - 9);
    return sea - 1 - Math.round(Math.sin(t * Math.PI) * 2.6 + Math.sin(t * Math.PI * 3) * 0.7);
  }
  const left = lx < 4;
  // How far from the old island, and from the sea.
  const d = left ? OLD.x + 4 - x : x - (OLD.x + OLD.w - 5);
  const shore = left ? x - 4 : w - 5 - x;
  let up = left
    ? d <= 20 ? 6.5 * Math.sin((Math.PI * d) / 20) + 0.9 * Math.sin(d * 1.3) : 0
    : d < 9 ? -2.6 * Math.sin((Math.PI * d) / 9) : d <= 22 ? 7.5 * Math.sin((Math.PI * (d - 9)) / 13) + 0.8 * Math.sin(d * 1.1) : 0;
  up *= Math.min(1, d / 3, shore / 5);
  return sea - 1 - Math.round(up);
}

/** A cell's hash in 0..1 (the same everywhere: every world is drawn the same). */
const hash = (x: number, y: number, k: number) => {
  let n = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(k, 1442695041)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
};
/** Ores in the stone, by depth: [ore, from row, how common]. Veins: they come in little clumps. */
const ORES: [string, number, number][] = [
  ['crystal-ore', 38, 0.025],
  ['gold-ore', 32, 0.035],
  ['iron-ore', 26, 0.05],
  ['coal-ore', 20, 0.07],
];
/** The floating islands: centre column, top row, half-width. */
export const SKY_ISLANDS = [
  { x: 14, y: 8, r: 3 },
  { x: 41, y: 5, r: 2 },
  { x: 57, y: 8, r: 3 },
  { x: 83, y: 6, r: 3 },
];
/** Caves: open pockets in the stone (made once, the same in every world). */
const CAVES = (() => {
  let s = 7;
  const rnd = () => ((s = (Math.imul(s, 1103515245) + 12345) >>> 0), s / 4294967296);
  return Array.from({ length: 10 }, () => ({ x: 6 + rnd() * (ISLAND.w - 12), y: ISLAND.sea + 5 + rnd() * (ISLAND.h - ISLAND.sea - 10), rx: 2 + rnd() * 3.5, ry: 1 + rnd() * 1.4 }));
})();

/** The ground every world starts with, cell by cell (undefined: air). */
const GROUND: (string | undefined)[] = (() => {
  const { w, h, sea } = ISLAND;
  const g: (string | undefined)[] = new Array(w * h);
  for (let x = 0; x < w; x++) {
    if (x < 4 || x >= w - 4) {
      // The sea floor.
      for (let y = sea + 10; y < h; y++) g[y * w + x] = y >= h - 2 ? 'bedrock' : 'dirt';
      continue;
    }
    const top = surfaceAt(x);
    for (let y = top; y < h; y++) {
      const i = y * w + x;
      if (y >= h - 2) g[i] = 'bedrock';
      else if (y < top + 3) g[i] = 'dirt';
      else if (CAVES.some((c) => ((x + 0.5 - c.x) / c.rx) ** 2 + ((y + 0.5 - c.y) / c.ry) ** 2 < 1)) g[i] = undefined;
      else g[i] = ORES.find(([, from, p], k) => y >= from && hash(x >> 1, y >> 1, k) < p * 2.2 && hash(x, y, k + 9) < 0.55)?.[0] ?? 'stone';
    }
  }
  for (const s of SKY_ISLANDS)
    for (let row = 0; row < 3; row++)
      for (let x = s.x - s.r + row; x <= s.x + s.r - row; x++) g[(s.y + row) * w + x] = row === 2 ? 'stone' : 'dirt';
  return g;
})();
/** The dungeon's gate: on the floor of the valley, on the right of the old island. */
export const ISLAND_GATE = (() => {
  let best = OLD.x + OLD.w;
  for (let x = OLD.x + OLD.w; x < OLD.x + OLD.w + 12; x++) if (surfaceAt(x) > surfaceAt(best)) best = x;
  const cell = idx(best, surfaceAt(best) - 1);
  GROUND[cell] = 'dungeon-gate';
  return cell;
})();
/** What a cell held when the world was made. */
export const groundAt = (cell: number) => GROUND[cell];

/** The other worlds' ground (the dungeons), by name. */
const WORLDS = new Map<string, (string | undefined)[]>();
export const setWorldGround = (world: string, ground: (string | undefined)[]) => void WORLDS.set(world, ground);
const baseOf = (isl: Island) => (isl.world ? (WORLDS.get(isl.world) ?? GROUND) : GROUND);

/** The things in the middle layer (not the ground), with their cells: what was put there, and the world's own. */
export function itemsIn(isl: Island): [number, string][] {
  if (!isl.world) return Object.entries(isl.fg).flatMap(([k, id]) => (id && !NATURAL[id] ? [[Number(k), id] as [number, string]] : [])).concat(isl.fg[ISLAND_GATE] === undefined ? [[ISLAND_GATE, 'dungeon-gate']] : []);
  const out: [number, string][] = [];
  for (let c = 0; c < ISLAND.w * ISLAND.h; c++) {
    const id = fgAt(isl, c);
    if (id && !NATURAL[id]) out.push([c, id]);
  }
  return out;
}

/**
 * What's in a cell's middle layer. The island keeps only what changed from the world as made: `fg` holds the things
 * put there, and "" where the ground was dug away (the ground itself isn't saved, so the island stays small).
 */
export function fgAt(isl: Island, cell: number): string | undefined {
  const v = isl.fg[cell];
  return v === undefined ? baseOf(isl)[cell] : v || undefined;
}
/** The island's `fg` with a cell set to `id` (or emptied), keeping only the changes from the world as made. */
function setFg(isl: Island, cell: number, id: string | undefined, fg = isl.fg): Record<string, string> {
  const { [cell]: _, ...rest } = fg;
  if (id === baseOf(isl)[cell]) return rest;
  return { ...rest, [cell]: id ?? '' };
}

export function newIsland(): Island {
  return { fg: {}, bg: {}, plots: {}, shown: {}, crossed: [], v: ISLAND_V };
}

/**
 * An island saved before the world grew (48 × 14, the ground saved cell by cell), moved into the middle of the new
 * world: everything it had (ground dug or added, things built, plots, cards, music) keeps its place; the new land
 * around it and under it is the world's. Islands already moved come back as they are.
 */
export function upgradeIsland(isl: Island): Island {
  if (isl.v === ISLAND_V) return isl;
  const move = (c: number) => idx((c % OLD.w) + OLD.x, Math.floor(c / OLD.w) + OLD.y);
  const key = (k: string) => {
    const m = /^([bt]?)(\d+)$/.exec(k);
    return m ? `${m[1]}${move(Number(m[2]))}` : k;
  };
  const keys = <T,>(r: Record<string, T> | undefined) => (r ? Object.fromEntries(Object.entries(r).map(([k, v]) => [String(move(Number(k))), v])) : r);
  const keyed = <T,>(r: Record<string, T> | undefined) => (r ? Object.fromEntries(Object.entries(r).map(([k, v]) => [key(k), v])) : r);
  let fg: Record<string, string> = {};
  for (let c = 0; c < OLD.w * OLD.h; c++) {
    const id = isl.fg[c];
    const sea = c % OLD.w < 4 || c % OLD.w >= OLD.w - 4;
    // The old sea columns become new land: only what was built there comes along.
    if (sea && (!id || NATURAL[id])) continue;
    fg = setFg(newIsland(), move(c), id, fg);
  }
  const out: Island = { ...isl, fg, bg: keys(isl.bg)!, plots: keys(isl.plots)!, shown: keys(isl.shown)!, v: ISLAND_V };
  if (isl.front) out.front = keys(isl.front);
  if (isl.by) out.by = keyed(isl.by);
  if (isl.tune) out.tune = keyed(isl.tune);
  return out;
}

export const isSea = (x: number, y: number) => (x < 4 || x >= ISLAND.w - 4) && y >= ISLAND.sea;

export function kindOf(id: string | undefined): IslandItem['kind'] | 'natural' | undefined {
  if (!id) return undefined;
  if (NATURAL[id]) return 'natural';
  return ITEM_BY_ID.get(id)?.kind;
}
/** What you can stand on: the ground, blocks, floors, stairs and trampolines (a platform only from above). */
export const isSolid = (id: string | undefined) => {
  const k = kindOf(id);
  return k === 'natural' || k === 'block' || k === 'floor' || k === 'stairs' || k === 'bounce';
};
export const solidAt = (isl: Island, x: number, y: number) => (!inside(x, y) ? y >= ISLAND.h : isSolid(fgAt(isl, idx(x, y))));

/** Zipline posts joined two by two: each post to the nearest one on its right, within reach of a rope. */
export const ZIP_REACH = { x: 24, y: 18 };
export function zipLines(isl: Island): [number, number][] {
  const posts = Object.keys(isl.fg)
    .map(Number)
    .filter((c) => kindOf(isl.fg[c]) === 'zip')
    .sort((a, b) => xy(a).x - xy(b).x || a - b);
  const out: [number, number][] = [];
  for (const a of posts) {
    const pa = xy(a);
    const b = posts
      .filter((c) => xy(c).x > pa.x && xy(c).x - pa.x <= ZIP_REACH.x && Math.abs(xy(c).y - pa.y) <= ZIP_REACH.y)
      .sort((c, d) => Math.hypot(xy(c).x - pa.x, xy(c).y - pa.y) - Math.hypot(xy(d).x - pa.x, xy(d).y - pa.y))[0];
    if (b !== undefined) out.push([a, b]);
  }
  return out;
}

/** Grass on dirt with nothing on top. */
export const grassy = (isl: Island, x: number, y: number) => fgAt(isl, idx(x, y)) === 'dirt' && !fgAt(isl, idx(x, y - 1)) && !isl.plots[idx(x, y - 1)];

export type Bag = Record<string, number>;
const take = (bag: Bag, id: string): Bag => {
  if (!bag[id]) throw new Error('You have none left.');
  const { [id]: n, ...rest } = bag;
  return n > 1 ? { ...rest, [id]: n - 1 } : rest;
};
const give = (bag: Bag, id: string, n = 1): Bag => ({ ...bag, [id]: (bag[id] ?? 0) + n });

export interface Change {
  island: Island;
  items?: Bag;
  seeds?: Bag;
}

/**
 * Puts an item from the bag into a cell, in a layer: a wallpaper always goes behind; the middle is where you walk
 * (blocks, tools, furniture…); a lamp, a plant or a decoration may also go behind it, or in front of you.
 */
export function place(isl: Island, items: Bag, cell: number, id: string, who?: Who, layer: Layer = 'mid'): Change {
  const item = ITEM_BY_ID.get(id);
  const { x, y } = xy(cell);
  if (!inside(x, y)) throw new Error('Off the island.');
  if (isl.world) throw new Error('Nothing can be built down here.');
  if (NATURAL[id]) {
    // Ground dug up elsewhere (dirt, stone, ore), put back.
    if (fgAt(isl, cell) || isl.plots[cell]) throw new Error('Something is already there.');
    return { island: { ...isl, fg: setFg(isl, cell, id) }, items: take(items, id) };
  }
  if (!item) throw new Error('Unknown item.');
  if (item.kind === 'disc') throw new Error('Records and CDs go in a player: click a turntable, a CD player or a jukebox.');
  if (item.kind !== 'wall' && layer !== 'mid') {
    if (!canLayer(id, layer)) throw new Error(layer === 'back' ? 'That can’t go behind.' : 'That can’t go in front.');
    const key = layerKey(layer, cell);
    if (layer === 'back') {
      if (isl.bg[cell]) throw new Error('Something is already behind there.');
      return { island: { ...isl, bg: { ...isl.bg, [cell]: id }, by: withBy(isl, key, who) }, items: take(items, id) };
    }
    if (isl.front?.[cell]) throw new Error('Something is already in front there.');
    return { island: { ...isl, front: { ...(isl.front ?? {}), [cell]: id }, by: withBy(isl, key, who) }, items: take(items, id) };
  }
  if (item.kind === 'wall') {
    if (isl.bg[cell]) throw new Error('There’s already a wall there.');
    return { island: { ...isl, bg: { ...isl.bg, [cell]: id }, by: withBy(isl, `b${cell}`, who) }, items: take(items, id) };
  }
  if (fgAt(isl, cell) || isl.plots[cell]) throw new Error('Something is already there.');
  if (item.kind === 'plant' && fgAt(isl, idx(x, y + 1)) !== 'dirt') throw new Error('Plants need dirt below (or put it behind or in front).');
  if (item.kind === 'rail' && !isSolid(fgAt(isl, idx(x, y + 1)))) throw new Error('Rails go on the ground (or on blocks).');
  return { island: { ...isl, fg: setFg(isl, cell, id), by: withBy(isl, String(cell), who) }, items: take(items, id) };
}

/** Picks a cell's front item back up (or its wallpaper, when it has nothing in front). The ground: dig instead. */
export function pickUp(isl: Island, items: Bag, cell: number, who?: Who): Change {
  const top = isl.front?.[cell];
  if (top) {
    if (!mayTake(isl, `t${cell}`, who)) throw new Error('Someone else put that there: only they (or the owner) can pick it up.');
    const { [cell]: _, ...front } = isl.front!;
    return { island: { ...isl, front, tune: tuneWithout(isl.tune, `t${cell}`), by: withoutBy(isl, `t${cell}`) }, items: give(items, top) };
  }
  const id = fgAt(isl, cell);
  if (id && FIXED.has(kindOf(id) ?? '')) throw new Error('That stays where it is.');
  if (id && !NATURAL[id]) {
    if (!mayTake(isl, String(cell), who)) throw new Error('Someone else put that there: only they (or the owner) can pick it up.');
    const fg = setFg(isl, cell, undefined);
    const { [cell]: __, ...shown } = isl.shown;
    return { island: { ...isl, fg, shown, tune: tuneWithout(isl.tune, String(cell)), by: withoutBy(isl, String(cell)) }, items: give(items, id) };
  }
  const wall = isl.bg[cell];
  if (wall) {
    if (!mayTake(isl, `b${cell}`, who)) throw new Error('Someone else put that there: only they (or the owner) can pick it up.');
    const { [cell]: _, ...bg } = isl.bg;
    return { island: { ...isl, bg, tune: tuneWithout(isl.tune, `b${cell}`), by: withoutBy(isl, `b${cell}`) }, items: give(items, wall) };
  }
  throw new Error('Nothing to pick up there.');
}

/** Digs (mines) the ground: dirt, stone or ore goes into the bag (to build with, or put back); bedrock won't break. */
export function dig(isl: Island, items: Bag, cell: number): Change {
  const id = fgAt(isl, cell);
  if (!id || !NATURAL[id]) throw new Error('Only the ground can be dug (pick things up instead).');
  if (UNBREAKABLE.has(id)) throw new Error(id === 'bedrock' ? 'Bedrock: too hard, even for a pickaxe.' : 'These walls won’t break: look for ore in them.');
  if (isl.plots[cell - ISLAND.w] || kindOf(fgAt(isl, cell - ISLAND.w)) === 'plant') throw new Error('Something grows on it.');
  if (FIXED.has(kindOf(fgAt(isl, cell - ISLAND.w)) ?? '')) throw new Error('Something stands on it.');
  return { island: { ...isl, fg: setFg(isl, cell, undefined) }, items: give(items, id) };
}

const growDays = (p: Plot) => ([p.a, p.b].some((s) => SEED_BY_ID.get(s)?.tier !== 'common') ? ISLAND.growRare : ISLAND.growCommon);
const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
/** The day a plot is ready. */
export const readyOn = (p: Plot) => addDays(p.day, growDays(p) - (p.water ? 1 : 0));
export const isReady = (p: Plot, today = todayKey()) => today >= readyOn(p);

/** Plants two seeds (the same or not) on the dirt right below an empty cell. */
export function plant(isl: Island, seeds: Bag, cell: number, a: string, b: string, today = todayKey(), who?: Who): Change {
  const { x, y } = xy(cell);
  if (!inside(x, y) || fgAt(isl, cell) || isl.plots[cell]) throw new Error('Plant on an empty spot.');
  if (fgAt(isl, idx(x, y + 1)) !== 'dirt') throw new Error('Seeds need dirt below.');
  if (!SEED_BY_ID.has(a) || !SEED_BY_ID.has(b)) throw new Error('Pick two seeds.');
  let bag = take(seeds, a);
  bag = take(bag, b);
  return { island: { ...isl, plots: { ...isl.plots, [cell]: { a, b, day: today, ...(who ? { by: who.uid } : {}) } } }, seeds: bag };
}

/** A friend waters a plot that's still growing (once): it's ready a day sooner. */
export function water(isl: Island, cell: number, who: Who, today = todayKey()): Change {
  const p = isl.plots[cell];
  if (!p) throw new Error('Nothing planted there.');
  if (p.by ? p.by === who.uid : who.uid === who.owner) throw new Error('Your own plant: a friend can water it for you.');
  if (p.water) throw new Error('Already watered.');
  if (isReady(p, today)) throw new Error('It’s ready: the one who planted it can harvest it.');
  return { island: { ...isl, plots: { ...isl.plots, [cell]: { ...p, water: today, waterBy: who.uid } } } };
}

/** The families a seed belongs to (a hybrid: both of its). */
const familiesOf = (s: Seed) => (s.cross ? [...s.cross] : [s.family!]);
/** The hybrid two seeds can make: from two different families with a hybrid between them. */
export function hybridOf(a: string, b: string): Seed | undefined {
  const fa = familiesOf(SEED_BY_ID.get(a)!);
  const fb = familiesOf(SEED_BY_ID.get(b)!);
  return HYBRIDS.find((h) => (fa.includes(h.cross![0]) && fb.includes(h.cross![1])) || (fa.includes(h.cross![1]) && fb.includes(h.cross![0])));
}
export const pairKey = (h: Seed) => [...h.cross!].sort().join('+');

export interface Harvest {
  item: string;
  /** A seed back, if one came. */
  seed?: string;
  /** The hybrid, the first time its two families were crossed (or now and then after). */
  hybrid?: string;
}

/**
 * Harvests a ready plot: one thing either seed grows (a rare's or a hybrid's twice as likely), sometimes one of the
 * two seeds back, and a hybrid seed: always the first time its families are crossed, then one time in four.
 */
/** What a ripe plot offers: everything its two seeds grow (the player picks one). */
export function harvestChoices(p: Plot): string[] {
  return [...new Set([p.a, p.b].flatMap((id) => SEED_BY_ID.get(id)?.grows ?? []))];
}

/** Harvests a ripe plot: the thing picked among `harvestChoices` (by chance when none is given), maybe a seed back, maybe the hybrid. */
export function harvest(isl: Island, items: Bag, seeds: Bag, cell: number, rand = Math.random, today = todayKey(), who?: Who, pick?: string): Change & { got: Harvest } {
  const p = isl.plots[cell];
  if (!p) throw new Error('Nothing planted there.');
  if (who && (p.by ? p.by !== who.uid : who.uid !== who.owner)) throw new Error('Someone else planted it: theirs to harvest.');
  if (!isReady(p, today)) throw new Error('Not ready yet.');
  const pool: string[] = [];
  for (const id of [p.a, p.b]) {
    const s = SEED_BY_ID.get(id)!;
    for (const g of s.grows) pool.push(...(s.tier === 'common' ? [g] : [g, g]));
  }
  if (pick && !pool.includes(pick)) throw new Error('That doesn’t grow from these seeds.');
  const got: Harvest = { item: pick ?? pool[Math.floor(rand() * pool.length)] };
  if (rand() < ISLAND.seedBack) got.seed = rand() < 0.5 ? p.a : p.b;
  const h = hybridOf(p.a, p.b);
  let crossed = isl.crossed;
  if (h && (!crossed.includes(pairKey(h)) || rand() < 0.25)) {
    got.hybrid = h.id;
    if (!crossed.includes(pairKey(h))) crossed = [...crossed, pairKey(h)];
  }
  const { [cell]: _, ...plots } = isl.plots;
  let bag = seeds;
  if (got.seed) bag = give(bag, got.seed);
  if (got.hybrid) bag = give(bag, got.hybrid);
  return { island: { ...isl, plots, crossed }, items: give(items, got.item), seeds: bag, got };
}

const without = (m: Record<string, string> | undefined, key: string) => {
  if (!m?.[key]) return m;
  const { [key]: _, ...rest } = m;
  return rest;
};
/** A device's settings gone with it: its tune, its volume ("vol:<key>"), the link a speaker had ("to:<key>"). */
const tuneWithout = (m: Record<string, string> | undefined, key: string) => without(without(without(m, key), `vol:${key}`), `to:${key}`);

/** A music maker's setting (by its layer key): null plays its own tune, "off" silences it, a disc id plays that disc. */
export function setTune(isl: Island, key: string, tune: string | null): Change {
  return { island: { ...isl, tune: tune ? { ...(isl.tune ?? {}), [key]: tune } : without(isl.tune, key) } };
}

/** Shows one of your cards in a frame, or puts its clip on a screen, or a card in a reader. */
export function showCard(isl: Island, cell: number, card: string | null, who?: Who): Change {
  const k = kindOf(fgAt(isl, cell));
  if (k !== 'frame' && k !== 'screen' && k !== 'reader') throw new Error('That’s not a frame or a screen.');
  if (!mayTake(isl, String(cell), who)) throw new Error('Someone else put it there: only they (or the owner) can change it.');
  const { [cell]: _, ...shown } = isl.shown;
  return { island: { ...isl, shown: card ? { ...shown, [cell]: card } : shown } };
}

/** The common seed a helper gets for watering a plot: from one of its seeds' families. */
export function helpSeed(p: Plot, rand = Math.random): string {
  const fams = [p.a, p.b].flatMap((id) => familiesOf(SEED_BY_ID.get(id)!));
  const f = fams[Math.floor(rand() * fams.length)];
  return [...SEED_BY_ID.values()].find((s) => s.family === f && s.tier === 'common')!.id;
}

/** A family's colour for a seed (its first family's for a hybrid). */
export const seedTint = (id: string) => FAMILY_BY_ID.get(familiesOf(SEED_BY_ID.get(id)!)[0])!.color;
