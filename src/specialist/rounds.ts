import { hashString, mulberry32, pick } from '../lib/rng';
import { POOLS } from './data';

/** The Specialist universes. Only One Piece is playable so far. */
export const UNIVERSES = [
  { id: 'onepiece', label: 'One Piece', ready: true, blurb: 'Classic, Devil Fruits, laughs, Jolly Rogers and silhouettes — 300 characters.' },
  { id: 'lol', label: 'League of Legends', ready: false, blurb: 'Classic, abilities and splash arts. Coming soon.' },
  { id: 'marvel', label: 'Marvel (MCU)', ready: false, blurb: 'Characters and films. Coming soon.' },
] as const;
export type UniverseId = (typeof UNIVERSES)[number]['id'];

export type SpType = 'classic' | 'fruit' | 'laugh' | 'flag' | 'silhouette';

export const SP_TYPES: SpType[] = ['classic', 'fruit', 'laugh', 'flag', 'silhouette'];

export const SP_META: Record<SpType, { name: string; icon: string; tagline: string; maxAttempts: number }> = {
  classic: { name: 'Classic', icon: '🏴‍☠️', tagline: 'Find the character from their traits', maxAttempts: 12 },
  fruit: { name: 'Devil Fruit', icon: '🍈', tagline: 'Name the Devil Fruit', maxAttempts: 6 },
  laugh: { name: 'Laugh', icon: '😆', tagline: 'Whose signature laugh is this?', maxAttempts: 6 },
  flag: { name: 'Jolly Roger', icon: '☠️', tagline: 'Which crew flies this flag?', maxAttempts: 6 },
  silhouette: { name: 'Silhouette', icon: '👤', tagline: 'Who is hiding in the shadow?', maxAttempts: 6 },
};

/** One round: what to guess, and a seed for anything random about how it's shown. */
export interface SpRound {
  type: SpType;
  targetId: string;
  seed: number;
}

/** Points for a round won on the n-th try: Classic allows more tries, so each costs less. */
export function spScore(type: SpType, attempts: number): number {
  return type === 'classic' ? Math.max(20, 100 - (attempts - 1) * 8) : Math.max(10, 100 - (attempts - 1) * 15);
}

export const SP_MAX_SCORE = SP_TYPES.length * 100;

/** A random round of one type; `avoid` keeps one character from answering two rounds of a day. */
export function randomRound(type: SpType, rand: () => number, avoid: Set<string> = new Set()): SpRound {
  const pool = POOLS[type].filter((id) => !avoid.has(id));
  return { type, targetId: pick(pool.length ? pool : POOLS[type], rand), seed: Math.floor(rand() * 2 ** 31) };
}

/** The day's five rounds, one of each type, the same for everyone (seeded by the date). */
export function buildSpecialistDaily(universe: UniverseId, date: string): SpRound[] {
  const rand = mulberry32(hashString(`omnidle:specialist:${universe}:${date}`));
  const used = new Set<string>();
  return SP_TYPES.map((type) => {
    const round = randomRound(type, rand, used);
    used.add(round.targetId);
    return round;
  });
}
