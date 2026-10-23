import { candidates, connectionsPuzzles, DOMAINS } from '../data';
import { THEME_PREFIX, themesFor } from './connections';
import { GAME_TYPES } from '../games/meta';
import type { Domain, GameType, RoundSpec, Work } from '../types';
import { EPOCH, addDays } from './date';
import { hashString, mulberry32, pick, shuffle } from './rng';

export const ROUNDS_PER_DAY = 10;

/** Works with real media are more fun in these rounds, so they're drawn more often. */
const MEDIA_WEIGHT: Partial<Record<GameType, (w: Work) => boolean>> = {
  visual: (w) => !!w.cover?.image,
  item: (w) => !!w.item?.image,
  location: (w) => !!w.location?.image,
  audio: (w) => !!w.audio?.youtubeId,
};

function weightedPick(pool: Work[], type: GameType, rand: () => number): Work {
  const boosted = MEDIA_WEIGHT[type];
  if (!boosted) return pick(pool, rand);
  const weights = pool.map((w) => (boosted(w) ? 4 : 1));
  let r = rand() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r < 0) return pool[i];
  }
  return pool[pool.length - 1];
}

/** Four works from different years, the least recently used first when `lastUsed` is given. */
function timelineWorks(domain: Domain | undefined, rand: () => number, lastUsed?: Map<string, number>): string[] {
  const chosen: Work[] = [];
  const order = shuffle(candidates('timeline', domain), rand);
  if (lastUsed) order.sort((x, y) => (lastUsed.get(x.id) ?? -1) - (lastUsed.get(y.id) ?? -1));
  for (const w of order) {
    if (chosen.every((c) => c.year !== w.year)) chosen.push(w);
    if (chosen.length === 4) break;
  }
  return chosen.map((w) => w.id);
}

export function puzzlesFor(domain: Domain | undefined) {
  const own = connectionsPuzzles.filter((p) => p.domain === domain);
  return domain && own.length ? own : connectionsPuzzles;
}

/** How far past the least recently used item a pick may still reach, to keep some variety. */
const RECENCY_SLACK = 3;

/**
 * Least recently used first: items never used yet, else the ones last used longest ago (with a
 * little slack). `lastUsed` maps an id to the day number it last came up.
 */
export function leastRecent<T>(items: T[], id: (item: T) => string, lastUsed?: Map<string, number>): T[] {
  if (!lastUsed || !items.length) return items;
  const never = items.filter((x) => !lastUsed.has(id(x)));
  if (never.length) return never;
  const oldest = Math.min(...items.map((x) => lastUsed.get(id(x))!));
  return items.filter((x) => lastUsed.get(id(x))! <= oldest + RECENCY_SLACK);
}

/**
 * Builds one round of the given type. `avoid` keeps targets unique within a day or a free-play
 * session; `lastUsed` (dailies) prefers what hasn't come up for the longest time.
 */
export function buildRound(
  type: GameType,
  domain: Domain | undefined,
  rand: () => number,
  avoid: Set<string> = new Set(),
  lastUsed?: Map<string, number>,
): RoundSpec | null {
  const seed = Math.floor(rand() * 2 ** 31);
  if (type === 'connections') {
    // Six times in ten, a grid built from a theme's sub-categories; otherwise a hand-made one.
    const themes = themesFor(domain);
    if (themes.length && rand() < 0.6) {
      const bank = pick(themes, rand);
      return { type, domain: bank.domain, seed, puzzleId: `${THEME_PREFIX}${bank.id}:${Math.floor(rand() * 2 ** 31)}` };
    }
    const p = pick(leastRecent(puzzlesFor(domain), (x) => x.id, lastUsed), rand);
    return { type, domain: p.domain, seed, puzzleId: p.id };
  }
  if (type === 'timeline') {
    const ids = timelineWorks(domain, rand, lastUsed);
    return ids.length === 4 ? { type, domain: domain ?? 'mixed', seed, workIds: ids } : null;
  }
  let pool = candidates(type, domain).filter((w) => !avoid.has(w.id));
  if (!pool.length) pool = candidates(type, domain);
  if (!pool.length) return null;
  const target = weightedPick(leastRecent(pool, (w) => w.id, lastUsed), type, rand);
  return { type, domain: target.domain, seed, targetId: target.id };
}

/**
 * Deterministic 10-round challenge for one category on one calendar day.
 * The seed is a hash of the date and the category, so every player gets the same rounds.
 */
export function buildDaily(dateKey: string, domain: Domain): RoundSpec[] {
  const key = `${domain}:${dateKey}`;
  const cached = dailyCache.get(key);
  if (cached) return cached;
  const rand = mulberry32(hashString(`omnidle:${dateKey}:${domain}`));
  const used = new Set<string>();
  // No repeats across days: each pick prefers what hasn't been an answer for the longest time.
  const lastUsed = usageBefore(dateKey, domain);
  // Every mini-game this category has content for, ten of them a day (voice lines only exist for
  // anime and games, so those categories rotate one game out each day).
  const types = shuffle(GAME_TYPES.filter((t) => isAvailable(t, domain)), rand).slice(0, ROUNDS_PER_DAY);
  while (types.length < ROUNDS_PER_DAY) types.push('classic');
  const specs = types.map((type) => {
    const spec = buildRound(type, domain, rand, used, lastUsed) ?? buildRound('classic', domain, rand, used, lastUsed)!;
    if (spec.targetId) used.add(spec.targetId);
    return spec;
  });
  dailyCache.set(key, specs);
  return specs;
}

/** Dailies already built, by "domain:date" (each day depends on all the days before it). */
const dailyCache = new Map<string, RoundSpec[]>();

/** The answers a round uses: its target, its works, or its hand-made puzzle. */
const answersOf = (s: RoundSpec) => [s.targetId, ...(s.workIds ?? []), s.puzzleId && !s.puzzleId.startsWith(THEME_PREFIX) ? s.puzzleId : undefined].filter((x): x is string => !!x);

/** When each answer last came up in a category's dailies before `dateKey`: id → day number since EPOCH. */
function usageBefore(dateKey: string, domain: Domain): Map<string, number> {
  const lastUsed = new Map<string, number>();
  for (let day = EPOCH, n = 0; day < dateKey; day = addDays(day, 1), n++) {
    for (const s of buildDaily(day, domain)) for (const id of answersOf(s)) lastUsed.set(id, n);
  }
  return lastUsed;
}

export function isAvailable(type: GameType, domain?: Domain): boolean {
  if (type === 'connections') return true;
  if (type === 'timeline') return new Set(candidates(type, domain).map((w) => w.year)).size >= 4;
  return candidates(type, domain).length > 0;
}

export const isDomain = (s: string | undefined): s is Domain => DOMAINS.some((d) => d.id === s);
