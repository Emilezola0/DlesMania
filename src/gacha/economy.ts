// DleCoins: what playing earns, to spend on card packs. The dailies pay the most (more for a better
// score), beating a boss pays by difficulty, the endless games pay a little — with a daily cap, so
// they can't be farmed — and three daily missions pay a bonus each.
import { hashString } from '../lib/rng';
import type { BossDifficulty } from '../store/progress';

/** A finished daily round (category or Specialist): more for a better score. */
export const roundCoins = (won: boolean, score: number) => (won ? 6 + Math.floor(Math.max(0, score) / 10) : 2);
/** All ten rounds of a category's daily played. */
export const CATEGORY_BONUS = 25;

/** A boss beaten, the first time today at that difficulty; again, a token. */
export const BOSS_COINS: Record<BossDifficulty, number> = { easy: 30, medium: 60, hard: 100 };
export const BOSS_AGAIN = 5;

/** The endless games: a little per game, a bit more for a new best, up to a cap a day. */
export const ARCADE_COINS = 2;
export const ARCADE_BEST_BONUS = 4;
export const ARCADE_CAP = 60;

export type MissionKind = 'rounds' | 'category' | 'special' | 'boss' | 'arcade' | 'whos';

export const MISSIONS: Record<MissionKind, { icon: string; text: string; need: number; reward: number }> = {
  rounds: { icon: '📅', text: 'Win 5 daily rounds', need: 5, reward: 40 },
  category: { icon: '🏁', text: 'Play a whole daily category', need: 1, reward: 50 },
  special: { icon: '🎯', text: 'Win 3 Specialist rounds', need: 3, reward: 40 },
  boss: { icon: '👑', text: 'Beat a boss', need: 1, reward: 60 },
  arcade: { icon: '🕹️', text: 'Finish 3 games from the Games page', need: 3, reward: 30 },
  whos: { icon: '👤', text: "Play a Who's That? run", need: 1, reward: 25 },
};

const KINDS = Object.keys(MISSIONS) as MissionKind[];

/** Today's three missions, the same for everyone on a given day. */
export function missionsFor(date: string): MissionKind[] {
  const pool = [...KINDS];
  const out: MissionKind[] = [];
  let h = hashString(`missions:${date}`);
  while (out.length < 3) {
    out.push(pool.splice(h % pool.length, 1)[0]);
    h = Math.floor(h / 7) + 13;
  }
  return out;
}

/** One day's earnings book: the capped coins, the bosses already paid for, mission progress. */
export interface Economy {
  date: string;
  /** Coins from the endless games so far today. */
  arcade: number;
  /** bossKey()s already paid for today. */
  bosses: string[];
  counters: Partial<Record<MissionKind, number>>;
  claimed: MissionKind[];
  /** Coins earned today in all, for the shop's "today" line. */
  earned: number;
}

export const freshEconomy = (date: string): Economy => ({ date, arcade: 0, bosses: [], counters: {}, claimed: [], earned: 0 });
