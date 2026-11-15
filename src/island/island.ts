// The Island (stage 2a): a small 2D island seen from the side, a grid of ISLAND.w × ISLAND.h cells. Each cell has a
// front layer (`fg`: the ground, a block, a lamp, a sofa…) and a back one (`bg`: a wallpaper behind). Plant two
// seeds in a plot on the ground; a day or two later it gives one of the things they grow, maybe a seed back, and the
// first time two families are crossed, their hybrid. Everything here is pure: the store (src/store/progress.ts)
// saves what these return.
import { todayKey } from '../lib/date';
import { FAMILY_BY_ID, HYBRIDS, ITEM_BY_ID, SEED_BY_ID, type IslandItem, type Seed } from './seeds';

export const ISLAND = {
  w: 48,
  h: 14,
  /** The sea's surface (cells from the top); the shore columns are sea below it. */
  sea: 10,
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
};

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
  /** A music maker's setting, by its key ("<cell>", "b<cell>", "t<cell>"): "off", or the disc it plays. */
  tune?: Record<string, string>;
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
const MIDDLE_ONLY = new Set(['door', 'ladder', 'platform', 'bounce', 'warp', 'frame', 'screen', 'reader', 'disc']);
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

/** The island's ground height at each column: a gentle hill, sea at both ends. */
export function surfaceAt(x: number): number {
  const { w, sea } = ISLAND;
  if (x < 4 || x >= w - 4) return ISLAND.h; // the sea: no ground
  const t = (x - 4) / (w - 9);
  const hill = Math.round(Math.sin(t * Math.PI) * 2.6 + Math.sin(t * Math.PI * 3) * 0.7);
  return sea - 1 - hill;
}

export function newIsland(): Island {
  const fg: Record<string, string> = {};
  for (let x = 0; x < ISLAND.w; x++) {
    const top = surfaceAt(x);
    for (let y = top; y < ISLAND.h; y++) fg[idx(x, y)] = y >= top + 3 ? 'stone' : 'dirt';
  }
  return { fg, bg: {}, plots: {}, shown: {}, crossed: [] };
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
export const solidAt = (isl: Island, x: number, y: number) => (!inside(x, y) ? y >= ISLAND.h : isSolid(isl.fg[idx(x, y)]));

/** Grass on dirt with nothing on top. */
export const grassy = (isl: Island, x: number, y: number) => isl.fg[idx(x, y)] === 'dirt' && !isl.fg[idx(x, y - 1)] && !isl.plots[idx(x, y - 1)];

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
  if (id === 'dirt') {
    if (isl.fg[cell] || isl.plots[cell]) throw new Error('Something is already there.');
    return { island: { ...isl, fg: { ...isl.fg, [cell]: 'dirt' } }, items: take(items, id) };
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
  if (isl.fg[cell] || isl.plots[cell]) throw new Error('Something is already there.');
  if (item.kind === 'plant' && isl.fg[idx(x, y + 1)] !== 'dirt') throw new Error('Plants need dirt below (or put it behind or in front).');
  return { island: { ...isl, fg: { ...isl.fg, [cell]: id }, by: withBy(isl, String(cell), who) }, items: take(items, id) };
}

/** Picks a cell's front item back up (or its wallpaper, when it has nothing in front). The ground: dig instead. */
export function pickUp(isl: Island, items: Bag, cell: number, who?: Who): Change {
  const top = isl.front?.[cell];
  if (top) {
    if (!mayTake(isl, `t${cell}`, who)) throw new Error('Someone else put that there: only they (or the owner) can pick it up.');
    const { [cell]: _, ...front } = isl.front!;
    return { island: { ...isl, front, tune: without(isl.tune, `t${cell}`), by: withoutBy(isl, `t${cell}`) }, items: give(items, top) };
  }
  const id = isl.fg[cell];
  if (id && !NATURAL[id]) {
    if (!mayTake(isl, String(cell), who)) throw new Error('Someone else put that there: only they (or the owner) can pick it up.');
    const { [cell]: _, ...fg } = isl.fg;
    const { [cell]: __, ...shown } = isl.shown;
    return { island: { ...isl, fg, shown, tune: without(isl.tune, String(cell)), by: withoutBy(isl, String(cell)) }, items: give(items, id) };
  }
  const wall = isl.bg[cell];
  if (wall) {
    if (!mayTake(isl, `b${cell}`, who)) throw new Error('Someone else put that there: only they (or the owner) can pick it up.');
    const { [cell]: _, ...bg } = isl.bg;
    return { island: { ...isl, bg, tune: without(isl.tune, `b${cell}`), by: withoutBy(isl, `b${cell}`) }, items: give(items, wall) };
  }
  throw new Error('Nothing to pick up there.');
}

/** Digs the ground: dirt goes into the bag (to fill elsewhere); stone is too hard. */
export function dig(isl: Island, items: Bag, cell: number): Change {
  const id = isl.fg[cell];
  if (id !== 'dirt') throw new Error(id === 'stone' ? 'Stone is too hard to dig.' : 'Only dirt can be dug.');
  if (isl.plots[cell - ISLAND.w] || kindOf(isl.fg[cell - ISLAND.w]) === 'plant') throw new Error('Something grows on it.');
  const { [cell]: _, ...fg } = isl.fg;
  return { island: { ...isl, fg }, items: give(items, 'dirt') };
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
  if (!inside(x, y) || isl.fg[cell] || isl.plots[cell]) throw new Error('Plant on an empty spot.');
  if (isl.fg[idx(x, y + 1)] !== 'dirt') throw new Error('Seeds need dirt below.');
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

/** A music maker's setting (by its layer key): null plays its own tune, "off" silences it, a disc id plays that disc. */
export function setTune(isl: Island, key: string, tune: string | null): Change {
  return { island: { ...isl, tune: tune ? { ...(isl.tune ?? {}), [key]: tune } : without(isl.tune, key) } };
}

/** Shows one of your cards in a frame, or puts its clip on a screen, or a card in a reader. */
export function showCard(isl: Island, cell: number, card: string | null, who?: Who): Change {
  const k = kindOf(isl.fg[cell]);
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
