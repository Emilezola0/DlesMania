// DleCoins: what playing earns, to spend on card packs. The dailies pay the most (more for a better
// score); every boss fight pays by difficulty, and the first win over each boss at each difficulty
// pays a bonus once a week; every game from the Games page pays a few coins (fully up to a daily
// amount, then a token per game, so there's always something to farm); three daily missions pay a
// bonus each.
import { hashString } from '../lib/rng';
import type { BossDifficulty } from '../store/progress';

/** A finished daily round (category or Specialist): more for a better score. */
export const roundCoins = (won: boolean, score: number) => (won ? 6 + Math.floor(Math.max(0, score) / 10) : 2);
/** All ten rounds of a category's daily played. */
export const CATEGORY_BONUS = 25;

/** Every boss fight: a win by difficulty, a token for a loss. */
export const BOSS_WIN: Record<BossDifficulty, number> = { easy: 12, medium: 25, hard: 45 };
export const BOSS_LOSS = 3;
/** The first win over a boss at a difficulty each week (weeks start on Monday). */
export const BOSS_WEEKLY: Record<BossDifficulty, number> = { easy: 40, medium: 80, hard: 150 };

/** A game from the Games page: a few coins, more for a new best — fully up to a daily amount, then a token. */
export const ARCADE_COINS = 3;
export const ARCADE_BEST_BONUS = 5;
export const ARCADE_CAP = 150;
export const ARCADE_AFTER_CAP = 1;
/** Games that save as they go (a point at a time, a ledge at a time) pay once per this long. */
export const ARCADE_SPACING_MS = 20_000;

/** The Monday a date's week starts on: "2026-10-28" → "2026-10-26". */
export function weekOf(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

/** The bosses (bossKey()s) whose weekly bonus was paid, this week. */
export interface BossWeek {
  week: string;
  keys: string[];
}

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
  /** bossKey()s already paid for today (kept for old saves; bosses now pay by the week, see BossWeek). */
  bosses: string[];
  /** When each game last paid (by its best key), for the spacing between pays. */
  lastPaid?: Record<string, number>;
  counters: Partial<Record<MissionKind, number>>;
  claimed: MissionKind[];
  /** Coins earned today in all, for the shop's "today" line. */
  earned: number;
}

export const freshEconomy = (date: string): Economy => ({ date, arcade: 0, bosses: [], counters: {}, claimed: [], earned: 0 });
