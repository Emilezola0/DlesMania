import { mulberry32, shuffle } from '../lib/rng';
import { ONE_PIECE } from './data';
import { GENSHIN } from './genshin';
import { LOL } from './lol';
import { MARVEL, filmById } from './marvel';
import type { UniverseId } from './rounds';
import { WOW } from './wow';

/** A character on a Specialist timeline: when they first showed up, as a number to sort by and as words. */
export interface TimelineItem {
  id: string;
  name: string;
  image: string;
  /** Sort key: earlier debut first. */
  key: number;
  /** Shown once the order is revealed ("Chapter 1 · Romance Dawn", "2013", "v1.3"...). */
  label: string;
}

/** How many characters a Timeline round sorts. */
export const TIMELINE_SIZE = 5;

interface TimelineSource {
  /** What the order is ("order of first appearance in the manga"...). */
  order: string;
  items: TimelineItem[];
  /** Smallest gap between two keys in one round, so neighbours can be told apart. */
  gap: number;
}

/** "5.10" → 510, so versions sort as numbers. */
const versionKey = (v: string) => v.split('.').map(Number).reduce((n, x, i) => n + x * (i ? 1 : 100), 0);

const SOURCES: Record<UniverseId, () => TimelineSource> = {
  onepiece: () => ({
    order: 'from their first appearance in the manga to the latest',
    gap: 20,
    items: ONE_PIECE.characters
      .filter((c) => c.chapter > 0)
      .map((c) => ({ id: c.id, name: c.name, image: c.image, key: c.chapter, label: `Chapter ${c.chapter} · ${c.arc}` })),
  }),
  lol: () => ({
    order: 'from the oldest release to the newest',
    gap: 1,
    items: LOL.champions.filter((c) => c.year > 0).map((c) => ({ id: c.id, name: c.name, image: c.image, key: c.year, label: String(c.year) })),
  }),
  marvel: () => ({
    order: 'from their first film to the latest',
    gap: 1,
    items: MARVEL.characters
      .filter((c) => filmById.has(c.debut))
      .map((c) => {
        const f = filmById.get(c.debut)!;
        return { id: c.id, name: c.name, image: c.image, key: f.order, label: `${f.name} (${f.year})` };
      }),
  }),
  genshin: () => ({
    order: 'from the earliest release to the newest',
    gap: 1,
    items: GENSHIN.characters.map((c) => ({ id: c.id, name: c.name, image: c.image, key: versionKey(c.version), label: `Version ${c.version}` })),
  }),
  wow: () => ({
    order: 'from their first game to the latest',
    gap: 1,
    items: WOW.characters
      .filter((c) => c.debut !== undefined)
      .map((c) => ({ id: c.id, name: c.name, image: c.image, key: c.debut!, label: WOW.games[c.debut!] })),
  }),
};

const cache = new Map<UniverseId, TimelineSource>();
export function timelineSource(id: UniverseId): TimelineSource {
  if (!cache.has(id)) cache.set(id, SOURCES[id]());
  return cache.get(id)!;
}

/**
 * The round's characters, in the order they're first shown: the round's target plus four others
 * picked from its seed, every debut at least `gap` apart.
 */
export function timelineRound(id: UniverseId, targetId: string, seed: number): TimelineItem[] {
  const { items, gap } = timelineSource(id);
  const target = items.find((x) => x.id === targetId) ?? items[0];
  const rand = mulberry32(seed);
  const chosen = [target];
  for (const x of shuffle(items, rand)) {
    if (chosen.length >= TIMELINE_SIZE) break;
    if (chosen.every((c) => Math.abs(c.key - x.key) >= gap)) chosen.push(x);
  }
  // Never shown already in order.
  let order = shuffle(chosen, rand);
  const sorted = [...chosen].sort((a, b) => a.key - b.key);
  while (order.length > 1 && order.every((x, i) => x === sorted[i])) order = shuffle(chosen, rand);
  return order;
}

export const timelinePool = (id: UniverseId) => timelineSource(id).items.map((x) => x.id);
