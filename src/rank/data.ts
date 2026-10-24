import ranks from '../data/ranks.json';
import { EPOCH, addDays } from '../lib/date';
import { hashString, mulberry32, pick, shuffle } from '../lib/rng';
import { leastRecent } from '../lib/rounds';

/** One rank of a game's ladder (built by scripts/find-rank-clips.mjs). */
export interface Rank {
  id: string;
  name: string;
  icon?: string;
}

/** A gameplay video whose YouTube title states the player's rank. */
export interface RankClip {
  youtubeId: string;
  rank: string;
  title: string;
  channel: string;
  seconds: number;
}

export interface RankGame {
  id: string;
  label: string;
  /** Lowest first. */
  ranks: Rank[];
  clips: RankClip[];
}

interface RankData {
  generated: string;
  games: RankGame[];
}

export const RANK_DATA = ranks as RankData;
export const rankGame = (id: string | undefined) => RANK_DATA.games.find((g) => g.id === id);

/** Clips a day, per game. */
export const RANK_ROUNDS = 3;

/** One round: the rank to find and the clips that show it (the next one stands in if a video is gone). */
export interface RankRound {
  rank: string;
  clips: string[];
  /** Where in the video the clip starts, as a share of its length. */
  at: number;
}

/** Exact: full points; one rank off either way: half. */
export function rankScore(game: RankGame, guess: string, answer: string): number {
  const d = Math.abs(game.ranks.findIndex((r) => r.id === guess) - game.ranks.findIndex((r) => r.id === answer));
  return d === 0 ? 100 : d === 1 ? 50 : 0;
}

/** A round for `rank`, its clips in a seeded order with the least recently shown first. */
function roundFor(game: RankGame, rank: string, rand: () => number, lastUsed?: Map<string, number>): RankRound {
  const ids = shuffle(
    game.clips.filter((c) => c.rank === rank),
    rand,
  ).map((c) => c.youtubeId);
  const first = pick(leastRecent(ids, (x) => x, lastUsed), rand);
  // Mid-game, past loading screens (where ranks show) and before the end screen.
  return { rank, clips: [first, ...ids.filter((x) => x !== first)], at: 0.25 + rand() * 0.35 };
}

/** Ranks that have clips: each is as likely as the others, whatever YouTube has most of. */
const playableRanks = (game: RankGame) => game.ranks.filter((r) => game.clips.some((c) => c.rank === r.id)).map((r) => r.id);

/** A random round for practice; `recent` (most recent first) keeps clips seen lately out while there are others. */
export function randomRankRound(game: RankGame, recent: string[] = []): RankRound {
  const rank = pick(playableRanks(game), Math.random);
  return roundFor(game, rank, Math.random, new Map(recent.map((id, i) => [id, recent.length - i])));
}

const dailyCache = new Map<string, RankRound[]>();

/**
 * The day's rounds for a game, the same for everyone: different ranks, each clip the one that
 * hasn't been a daily for the longest time.
 */
export function buildRankDaily(game: RankGame, date: string): RankRound[] {
  const key = `${game.id}:${date}`;
  const cached = dailyCache.get(key);
  if (cached) return cached;
  const lastUsed = new Map<string, number>();
  for (let day = EPOCH, n = 0; day < date; day = addDays(day, 1), n++) {
    for (const r of buildRankDaily(game, day)) lastUsed.set(r.clips[0], n);
  }
  const rand = mulberry32(hashString(`omnidle:rank:${game.id}:${date}`));
  const ranksToday = shuffle(playableRanks(game), rand).slice(0, RANK_ROUNDS);
  const rounds = ranksToday.map((rank) => roundFor(game, rank, rand, lastUsed));
  dailyCache.set(key, rounds);
  return rounds;
}
