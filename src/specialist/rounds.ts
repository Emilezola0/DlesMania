import { EPOCH, addDays } from '../lib/date';
import { hashString, mulberry32, pick } from '../lib/rng';
import { leastRecent } from '../lib/rounds';
import { POOLS } from './data';
import { LOL_POOLS } from './lol';
import { MARVEL_POOLS } from './marvel';
import { GENSHIN_POOLS } from './genshin';
import { WOW_POOLS } from './wow';
import { timelinePool } from './timeline';
import { simplePools } from './simple';
import { BLUEPRINT_POOLS } from './blueprint';

export type SpType = 'classic' | 'fruit' | 'laugh' | 'flag' | 'silhouette' | 'wanted' | 'ability' | 'splash' | 'film' | 'emoji' | 'voice' | 'wish' | 'constellation' | 'art' | 'titles' | 'timeline' | 'picture' | 'clue' | 'pins' | 'windows';

/** The Specialist universes, each with its own rounds (one of each per daily). */
export const UNIVERSES = [
  {
    id: 'onepiece',
    label: 'One Piece',
    ready: true,
    blurb: 'Classic, Devil Fruits, laughs, Jolly Rogers and wanted posters — 220 characters from the anime.',
    types: ['classic', 'fruit', 'laugh', 'flag', 'wanted', 'timeline'] as SpType[],
  },
  {
    id: 'lol',
    label: 'League of Legends',
    ready: true,
    blurb: 'Classic, abilities, splash arts and silhouettes — every champion, from Data Dragon.',
    types: ['classic', 'ability', 'splash', 'silhouette', 'timeline'] as SpType[],
  },
  {
    id: 'marvel',
    label: 'Marvel (MCU)',
    ready: true,
    blurb: 'Classic on 180 characters, plus posters, emoji films and voice lines — every released film.',
    types: ['classic', 'film', 'emoji', 'voice', 'timeline'] as SpType[],
  },
  {
    id: 'genshin',
    label: 'Genshin Impact',
    ready: true,
    blurb: 'Classic, wish arts, silhouettes and constellations — every playable character.',
    types: ['classic', 'wish', 'silhouette', 'constellation', 'timeline'] as SpType[],
  },
  {
    id: 'wow',
    label: 'World of Warcraft',
    ready: true,
    blurb: 'Classic, art, silhouettes and titles — 120 of the best-known characters from the games.',
    types: ['classic', 'art', 'silhouette', 'titles', 'timeline'] as SpType[],
  },
  {
    id: 'forhonor',
    label: 'For Honor',
    ready: true,
    blurb: 'Pictures, windows and weapons — all 39 heroes of the five factions.',
    types: ['picture', 'clue', 'windows'] as SpType[],
  },
  {
    id: 'forts',
    label: 'Forts',
    ready: true,
    blurb: 'Pictures and windows of commanders, weapons and devices, commanders in silhouette and by their abilities.',
    types: ['picture', 'clue', 'windows', 'silhouette'] as SpType[],
  },
  {
    id: 'avatar',
    label: 'Avatar: The Last Airbender',
    ready: true,
    blurb: 'Classic by nation and bending, pictures from the show, windows, voice lines, and the characters by their story.',
    types: ['classic', 'picture', 'clue', 'windows', 'voice'] as SpType[],
  },
  {
    id: 'unreal',
    label: 'Unreal Engine Blueprints',
    ready: true,
    blurb: 'Classic, pins and clues — guess the Blueprint node, from Branch to Spawn Actor from Class.',
    types: ['classic', 'pins', 'clue'] as SpType[],
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
  wanted: { name: 'Wanted', icon: '📜', tagline: 'Who is on the wanted poster?', maxAttempts: 6 },
  ability: { name: 'Ability', icon: '✨', tagline: 'Whose ability is this?', maxAttempts: 6 },
  splash: { name: 'Splash Art', icon: '🖼️', tagline: 'Whose splash art is this?', maxAttempts: 6 },
  film: { name: 'Film', icon: '🎬', tagline: 'Which film is this poster from?', maxAttempts: 6 },
  emoji: { name: 'Emoji', icon: '😎', tagline: 'A film told in emojis', maxAttempts: 6 },
  voice: { name: 'Voice Line', icon: '🎙️', tagline: 'Who is speaking? (original English voice)', maxAttempts: 6 },
  wish: { name: 'Wish Art', icon: '🌠', tagline: 'Whose wish art is this?', maxAttempts: 6 },
  art: { name: 'Art', icon: '🖼️', tagline: 'Who is in this picture?', maxAttempts: 6 },
  timeline: { name: 'Timeline', icon: '⏳', tagline: 'Who came first?', maxAttempts: 4 },
  titles: { name: 'Titles', icon: '📜', tagline: 'Who goes by these titles?', maxAttempts: 6 },
  constellation: { name: 'Constellation', icon: '✦', tagline: 'Whose constellation is this?', maxAttempts: 6 },
  picture: { name: 'Picture', icon: '🖼️', tagline: 'Who or what is in the picture?', maxAttempts: 6 },
  windows: { name: 'Windows', icon: '🪟', tagline: 'Windows open with each miss', maxAttempts: 6 },
  clue: { name: 'Clue', icon: '🔎', tagline: 'Name them from a clue', maxAttempts: 6 },
  pins: { name: 'Pins', icon: '🔌', tagline: 'Which node has these pins?', maxAttempts: 6 },
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

const POOLS_OF: Record<UniverseId, Partial<Record<SpType, string[]>>> = {
  onepiece: { ...POOLS, timeline: timelinePool('onepiece') },
  lol: { ...LOL_POOLS, timeline: timelinePool('lol') },
  marvel: { ...MARVEL_POOLS, timeline: timelinePool('marvel') },
  genshin: { ...GENSHIN_POOLS, timeline: timelinePool('genshin') },
  wow: { ...WOW_POOLS, timeline: timelinePool('wow') },
  forhonor: simplePools('forhonor'),
  forts: simplePools('forts'),
  avatar: simplePools('avatar'),
  unreal: BLUEPRINT_POOLS,
};

/** How many answers a round type can draw from. */
export const poolSize = (id: UniverseId, type: SpType) => (POOLS_OF[id][type] ?? []).length;

/**
 * A random round of one type; `avoid` keeps one answer from coming up twice in a day or a session,
 * and `lastUsed` (dailies) prefers the answers that haven't come up for the longest time.
 */
export function randomRound(id: UniverseId, type: SpType, rand: () => number, avoid: Set<string> = new Set(), lastUsed?: Map<string, number>): SpRound {
  const all = POOLS_OF[id][type] ?? [];
  const pool = all.filter((x) => !avoid.has(x));
  return { type, targetId: pick(leastRecent(pool.length ? pool : all, (x) => x, lastUsed), rand), seed: Math.floor(rand() * 2 ** 31) };
}

/** The day's rounds, one of each type, the same for everyone (seeded by the date). */
export function buildSpecialistDaily(id: UniverseId, date: string): SpRound[] {
  const key = `${id}:${date}`;
  const cached = dailyCache.get(key);
  if (cached) return cached;
  const rand = mulberry32(hashString(`omnidle:specialist:${id}:${date}`));
  const used = new Set<string>();
  // No repeats across days: each round prefers what hasn't been an answer for the longest time.
  const lastUsed = new Map<string, number>();
  for (let day = EPOCH, n = 0; day < date; day = addDays(day, 1), n++) {
    // Timeline rounds came later: leaving them out keeps the days already played as they were.
    for (const r of buildSpecialistDaily(id, day)) if (r.type !== 'timeline') lastUsed.set(r.targetId, n);
  }
  const rounds = universe(id)!.types.map((type) => {
    const round = randomRound(id, type, rand, used, lastUsed);
    used.add(round.targetId);
    return round;
  });
  dailyCache.set(key, rounds);
  return rounds;
}

/** Specialist dailies already built, by "universe:date" (each day depends on the days before it). */
const dailyCache = new Map<string, SpRound[]>();
