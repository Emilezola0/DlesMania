// DleCoins: what playing earns, to spend on card packs. The dailies pay the most (more for a better
// score); every boss fight pays by difficulty, and the first win over each boss at each difficulty
// pays a bonus once a week; every game from the Games page pays a few coins (fully up to a daily
// amount, then a token per game, so there's always something to farm); three daily missions pay a
// bonus each, and three a week and three a month pay more.
import { hashString } from '../lib/rng';
import type { BossDifficulty } from '../store/progress';

/** A finished daily round (category or Specialist): more for a better score. */
export const roundCoins = (won: boolean, score: number) => (won ? 6 + Math.floor(Math.max(0, score) / 10) : 2);
/** All ten rounds of a category's daily played. */
export const CATEGORY_BONUS = 25;

/** Every boss fight: a win by difficulty, a token for a loss. */
export const BOSS_WIN: Record<BossDifficulty, number> = { easy: 12, medium: 25, hard: 45, hell: 80 };
export const BOSS_LOSS = 3;
/** The first win over a boss at a difficulty each week (weeks start on Monday). */
export const BOSS_WEEKLY: Record<BossDifficulty, number> = { easy: 40, medium: 80, hard: 150, hell: 250 };

/**
 * A game from the Games page, by how it went — fully up to a daily amount, then a token:
 * - won or lost (a Wordle, a Memory grid, a Free Play round): a good sum for a win, a token for a loss;
 * - a set of rounds (Guess the Year, Map Quiz…): by the share of the best score, a token below 40%;
 * - an endless run (Higher or Lower, Summit…): more the further it went, a little faster each step.
 * A new best (that isn't a loss) adds a bonus; a best kept in the middle of a run pays nothing.
 */
export type ArcadeResult = { won: boolean } | { ratio: number } | { reached: number } | { save: true };
export const ARCADE_WIN = 10;
export const ARCADE_LOSS = 1;
export const ARCADE_BEST_BONUS = 5;
/** An endless run's coins at most. */
export const ARCADE_RUN_MAX = 40;

export function arcadeCoins(r: ArcadeResult): number {
  if ('save' in r) return 0;
  if ('won' in r) return r.won ? ARCADE_WIN : ARCADE_LOSS;
  if ('ratio' in r) return r.ratio < 0.4 ? ARCADE_LOSS : Math.round(2 + 10 * Math.min(1, r.ratio));
  // `reached`: the run's length in steps (each game says what a step is): 1 + a step each, and a bit more as it goes on.
  const u = Math.max(0, r.reached);
  return Math.min(ARCADE_RUN_MAX, 1 + Math.floor(u + (u * u) / 40));
}
/** Whether a result earns the new-best bonus: not a loss, not a mid-run save. */
export const bestCounts = (r: ArcadeResult) => !('save' in r) && !('won' in r && !r.won) && !('ratio' in r && r.ratio < 0.4);
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

/** A spare copy of a card, traded in: by rarity (a pack of five costs 100–150). */
export const DUPLICATE_VALUE = { common: 4, rare: 12, epic: 40, legendary: 120, mythic: 400, omni: 1500 } as const;

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

// ── Weekly and monthly missions: the same kinds of goal, bigger, for bigger rewards; three a week, three a
// month, drawn the same for everyone. Their progress counts from the day the period starts. ──

export type Period = 'week' | 'month';
/** What the long missions count: the daily kinds, and packs opened. */
export type LongKind = MissionKind | 'packs';

export const LONG_MISSIONS: Record<Period, Record<LongKind, { icon: string; text: string; need: number; reward: number }>> = {
  week: {
    rounds: { icon: '📅', text: 'Win 25 daily rounds', need: 25, reward: 150 },
    category: { icon: '🏁', text: 'Play 4 whole daily categories', need: 4, reward: 180 },
    special: { icon: '🎯', text: 'Win 12 Specialist rounds', need: 12, reward: 150 },
    boss: { icon: '👑', text: 'Beat 4 bosses', need: 4, reward: 220 },
    arcade: { icon: '🕹️', text: 'Finish 15 games from the Games page', need: 15, reward: 120 },
    whos: { icon: '👤', text: "Play 5 Who's That? runs", need: 5, reward: 100 },
    packs: { icon: '🎴', text: 'Open 4 card packs', need: 4, reward: 150 },
  },
  month: {
    rounds: { icon: '📅', text: 'Win 80 daily rounds', need: 80, reward: 500 },
    category: { icon: '🏁', text: 'Play 12 whole daily categories', need: 12, reward: 600 },
    special: { icon: '🎯', text: 'Win 40 Specialist rounds', need: 40, reward: 450 },
    boss: { icon: '👑', text: 'Beat 12 bosses', need: 12, reward: 700 },
    arcade: { icon: '🕹️', text: 'Finish 50 games from the Games page', need: 50, reward: 400 },
    whos: { icon: '👤', text: "Play 15 Who's That? runs", need: 15, reward: 350 },
    packs: { icon: '🎴', text: 'Open 15 card packs', need: 15, reward: 450 },
  },
};

/** The period a date falls in: its week's Monday, or its month ("2026-10"). */
export const periodOf = (p: Period, date: string) => (p === 'week' ? weekOf(date) : date.slice(0, 7));

/** A period's three missions, the same for everyone. */
export function longMissionsFor(p: Period, period: string): LongKind[] {
  const pool = Object.keys(LONG_MISSIONS[p]) as LongKind[];
  const out: LongKind[] = [];
  let h = hashString(`missions:${p}:${period}`);
  while (out.length < 3) {
    out.push(pool.splice(h % pool.length, 1)[0]);
    h = Math.floor(h / 7) + 13;
  }
  return out;
}

/** A week's or a month's missions book. */
export interface PeriodBook {
  period: string;
  counters: Partial<Record<LongKind, number>>;
  claimed: LongKind[];
}
export type PeriodBooks = Record<Period, PeriodBook>;

export const freshBook = (p: Period, date: string): PeriodBook => ({ period: periodOf(p, date), counters: {}, claimed: [] });
