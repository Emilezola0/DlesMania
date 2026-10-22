import { hashString, mulberry32, pick } from '../lib/rng';
import { POOLS } from './data';
import { LOL_POOLS } from './lol';
import { MARVEL_POOLS } from './marvel';

export type SpType = 'classic' | 'fruit' | 'laugh' | 'flag' | 'silhouette' | 'ability' | 'splash' | 'film' | 'emoji' | 'cast';

/** The Specialist universes, each with its own rounds (one of each per daily). */
export const UNIVERSES = [
  {
    id: 'onepiece',
    label: 'One Piece',
    ready: true,
    blurb: 'Classic, Devil Fruits, laughs, Jolly Rogers and silhouettes — 300 characters.',
    types: ['classic', 'fruit', 'laugh', 'flag', 'silhouette'] as SpType[],
  },
  {
    id: 'lol',
    label: 'League of Legends',
    ready: true,
    blurb: 'Classic, abilities, splash arts and silhouettes — every champion, from Data Dragon.',
    types: ['classic', 'ability', 'splash', 'silhouette'] as SpType[],
  },
  {
    id: 'marvel',
    label: 'Marvel (MCU)',
    ready: true,
    blurb: 'Classic on 180 characters, plus posters, emoji films and the cast — every released film.',
    types: ['classic', 'film', 'emoji', 'cast'] as SpType[],
  },
] as const;
export type UniverseId = (typeof UNIVERSES)[number]['id'];

export const universe = (id: string) => UNIVERSES.find((u) => u.id === id);

export const SP_META: Record<SpType, { name: string; icon: string; tagline: string; maxAttempts: number }> = {
  classic: { name: 'Classic', icon: '🧩', tagline: 'Find them from their traits', maxAttempts: 12 },
  fruit: { name: 'Devil Fruit', icon: '🍈', tagline: 'Name the Devil Fruit', maxAttempts: 6 },
  laugh: { name: 'Laugh', icon: '😆', tagline: 'Whose signature laugh is this?', maxAttempts: 6 },
  flag: { name: 'Jolly Roger', icon: '☠️', tagline: 'Which crew flies this flag?', maxAttempts: 6 },
  silhouette: { name: 'Silhouette', icon: '👤', tagline: 'Who is hiding in the shadow?', maxAttempts: 6 },
  ability: { name: 'Ability', icon: '✨', tagline: 'Whose ability is this?', maxAttempts: 6 },
  splash: { name: 'Splash Art', icon: '🖼️', tagline: 'Whose splash art is this?', maxAttempts: 6 },
  film: { name: 'Film', icon: '🎬', tagline: 'Which film is this poster from?', maxAttempts: 6 },
  emoji: { name: 'Emoji', icon: '😎', tagline: 'A film told in emojis', maxAttempts: 6 },
  cast: { name: 'Cast', icon: '🎭', tagline: 'Who does this actor play?', maxAttempts: 6 },
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

export const maxScore = (id: UniverseId) => universe(id)!.types.length * 100;

const POOLS_OF: Record<UniverseId, Partial<Record<SpType, string[]>>> = { onepiece: POOLS, lol: LOL_POOLS, marvel: MARVEL_POOLS };

/** A random round of one type; `avoid` keeps one answer from coming up twice in a day. */
export function randomRound(id: UniverseId, type: SpType, rand: () => number, avoid: Set<string> = new Set()): SpRound {
  const all = POOLS_OF[id][type] ?? [];
  const pool = all.filter((x) => !avoid.has(x));
  return { type, targetId: pick(pool.length ? pool : all, rand), seed: Math.floor(rand() * 2 ** 31) };
}

/** The day's rounds, one of each type, the same for everyone (seeded by the date). */
export function buildSpecialistDaily(id: UniverseId, date: string): SpRound[] {
  const rand = mulberry32(hashString(`omnidle:specialist:${id}:${date}`));
  const used = new Set<string>();
  return universe(id)!.types.map((type) => {
    const round = randomRound(id, type, rand, used);
    used.add(round.targetId);
    return round;
  });
}
