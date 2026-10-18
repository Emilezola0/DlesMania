import { candidates, connectionsPuzzles, DOMAINS } from '../data';
import { GAME_TYPES } from '../games/meta';
import type { Domain, GameType, RoundSpec, Work } from '../types';
import { hashString, mulberry32, pick, shuffle } from './rng';

export const ROUNDS_PER_DAY = 10;

function timelineWorks(domain: Domain, rand: () => number): string[] {
  const pool = shuffle(candidates('timeline', domain), rand);
  const chosen: Work[] = [];
  for (const w of pool) {
    if (chosen.every((c) => c.year !== w.year)) chosen.push(w);
    if (chosen.length === 4) break;
  }
  return chosen.map((w) => w.id);
}

/** Builds one round of the given type. `avoid` keeps daily targets unique. */
export function buildRound(
  type: GameType,
  domain: Domain | undefined,
  rand: () => number,
  avoid: Set<string> = new Set(),
): RoundSpec | null {
  const seed = Math.floor(rand() * 2 ** 31);
  if (type === 'connections') {
    return { type, domain: 'mixed', seed, puzzleId: pick(connectionsPuzzles, rand).id };
  }
  if (type === 'timeline') {
    const d = domain ?? pick(DOMAINS, rand).id;
    return { type, domain: d, seed, workIds: timelineWorks(d, rand) };
  }
  let pool = candidates(type, domain).filter((w) => !avoid.has(w.id));
  if (!pool.length) pool = candidates(type, domain);
  if (!pool.length) return null;
  const target = pick(pool, rand);
  return { type, domain: target.domain, seed, targetId: target.id };
}

/** Deterministic 10-round challenge for a calendar day — identical for every player. */
export function buildDaily(dateKey: string): RoundSpec[] {
  const rand = mulberry32(hashString(`omnidle:${dateKey}`));
  const types = shuffle(GAME_TYPES, rand);
  // Cycle through domains so each one shows up at least twice per day.
  const domainCycle = [...shuffle(DOMAINS, rand), ...shuffle(DOMAINS, rand), ...shuffle(DOMAINS, rand)].map((d) => d.id);
  const used = new Set<string>();
  let cursor = 0;

  return types.map((type) => {
    let spec: RoundSpec | null = null;
    // Try the scheduled domain first, then fall back to any domain that has data.
    for (let attempt = 0; attempt < DOMAINS.length && !spec; attempt++) {
      const d = domainCycle[(cursor + attempt) % domainCycle.length];
      const pool = type === 'connections' || type === 'timeline' ? [1] : candidates(type, d).filter((w) => !used.has(w.id));
      if (pool.length) spec = buildRound(type, d, rand, used);
    }
    spec ??= buildRound(type, undefined, rand, used)!;
    if (spec.type !== 'connections') cursor++;
    if (spec.targetId) used.add(spec.targetId);
    return spec;
  });
}

export function isAvailable(type: GameType, domain?: Domain): boolean {
  if (type === 'connections') return true;
  if (type === 'timeline') return candidates(type, domain).length >= 4;
  return candidates(type, domain).length > 0;
}
