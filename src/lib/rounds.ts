import { candidates, connectionsPuzzles, DOMAINS } from '../data';
import { GAME_TYPES } from '../games/meta';
import type { Domain, GameType, RoundSpec, Work } from '../types';
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

function timelineWorks(domain: Domain | undefined, rand: () => number): string[] {
  const chosen: Work[] = [];
  for (const w of shuffle(candidates('timeline', domain), rand)) {
    if (chosen.every((c) => c.year !== w.year)) chosen.push(w);
    if (chosen.length === 4) break;
  }
  return chosen.map((w) => w.id);
}

export function puzzlesFor(domain: Domain | undefined) {
  const own = connectionsPuzzles.filter((p) => p.domain === domain);
  return domain && own.length ? own : connectionsPuzzles;
}

/** Builds one round of the given type. `avoid` keeps targets unique within a day or a free-play session. */
export function buildRound(
  type: GameType,
  domain: Domain | undefined,
  rand: () => number,
  avoid: Set<string> = new Set(),
): RoundSpec | null {
  const seed = Math.floor(rand() * 2 ** 31);
  if (type === 'connections') {
    const p = pick(puzzlesFor(domain), rand);
    return { type, domain: p.domain, seed, puzzleId: p.id };
  }
  if (type === 'timeline') {
    const ids = timelineWorks(domain, rand);
    return ids.length === 4 ? { type, domain: domain ?? 'mixed', seed, workIds: ids } : null;
  }
  let pool = candidates(type, domain).filter((w) => !avoid.has(w.id));
  if (!pool.length) pool = candidates(type, domain);
  if (!pool.length) return null;
  const target = weightedPick(pool, type, rand);
  return { type, domain: target.domain, seed, targetId: target.id };
}

/**
 * Deterministic 10-round challenge for one category on one calendar day.
 * The seed is a hash of the date and the category, so every player gets the same rounds.
 */
export function buildDaily(dateKey: string, domain: Domain): RoundSpec[] {
  const rand = mulberry32(hashString(`omnidle:${dateKey}:${domain}`));
  const used = new Set<string>();
  return shuffle(GAME_TYPES, rand).map((type) => {
    const spec = buildRound(type, domain, rand, used) ?? buildRound('classic', domain, rand, used)!;
    if (spec.targetId) used.add(spec.targetId);
    return spec;
  });
}

export function isAvailable(type: GameType, domain?: Domain): boolean {
  if (type === 'connections') return true;
  if (type === 'timeline') return new Set(candidates(type, domain).map((w) => w.year)).size >= 4;
  return candidates(type, domain).length > 0;
}

export const isDomain = (s: string | undefined): s is Domain => DOMAINS.some((d) => d.id === s);
