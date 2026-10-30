// DleCoins: what playing earns, to spend on card packs. The dailies pay the most (more for a better
// score); every boss fight pays by difficulty, and the first win over each boss at each difficulty
// pays a bonus once a week; every game from the Games page pays by how it went (fully up to a daily
// amount, then half, so farming always pays); Expeditions pay little, with a daily amount of their own
// (then a quarter), so that they never replace the other games; three daily missions pay a
// bonus each, and three a week and three a month pay more.
import { hashString } from '../lib/rng';
import type { BossDifficulty } from '../store/progress';

/** A finished daily round (category or Specialist): more for a better score. */
export const roundCoins = (won: boolean, score: number) => (won ? 12 + 2 * Math.floor(Math.max(0, score) / 10) : 4);
/** All ten rounds of a category's daily played. */
export const CATEGORY_BONUS = 50;

/** Every boss fight: a win by difficulty, a token for a loss. */
export const BOSS_WIN: Record<BossDifficulty, number> = { easy: 24, medium: 50, hard: 250, hell: 400 };
export const BOSS_LOSS = 6;
/** The first win over a boss at a difficulty each week (weeks start on Monday). */
export const BOSS_WEEKLY: Record<BossDifficulty, number> = { easy: 80, medium: 160, hard: 300, hell: 500 };

/**
 * A game from the Games page, by how it went — fully up to a daily amount, then a token:
 * - won or lost (a Wordle, a Memory grid, a Free Play round): a good sum for a win, a token for a loss;
 * - a set of rounds (Guess the Year, Map Quiz…): by the share of the best score, a token below 40%;
 * - an endless run (Higher or Lower, Summit…): more the further it went, a little faster each step.
 * A new best (that isn't a loss) adds a bonus; a best kept in the middle of a run pays nothing.
 */
export type ArcadeResult = { won: boolean } | { ratio: number } | { reached: number } | { save: true };
export const ARCADE_WIN = 40;
export const ARCADE_LOSS = 6;
export const ARCADE_BEST_BONUS = 30;
/** A set of rounds: up to this much for a perfect score. */
export const ARCADE_SET_MAX = 50;
/** An endless run's coins at most. */
export const ARCADE_RUN_MAX = 200;

export function arcadeCoins(r: ArcadeResult): number {
  if ('save' in r) return 0;
  if ('won' in r) return r.won ? ARCADE_WIN : ARCADE_LOSS;
  if ('ratio' in r) return r.ratio < 0.4 ? ARCADE_LOSS : Math.round(8 + (ARCADE_SET_MAX - 8) * Math.min(1, r.ratio));
  // `reached`: the run's length in steps (each game says what a step is): 2 a step, and more and more as it goes
  // on — the endless games get harder the further they go, so the deep steps pay the most.
  const u = Math.max(0, r.reached);
  return Math.min(ARCADE_RUN_MAX, 4 + 2 * Math.floor(2 * u + (u * u) / 15));
}
/** Whether a result earns the new-best bonus: not a loss, not a mid-run save. */
export const bestCounts = (r: ArcadeResult) => !('save' in r) && !('won' in r && !r.won) && !('ratio' in r && r.ratio < 0.4);
export const ARCADE_CAP = 1200;
/** Past the daily amount, this share of what a game would pay (at least a coin). */
export const ARCADE_AFTER_CAP = 0.5;
/** A game pays at most once per this long (so a run lost at once, again and again, isn't a farm). */
export const ARCADE_SPACING_MS = 8_000;

/**
 * The Hot Game: one game of the Games page pays more, so farming means moving around. After a few games
 * of it the bonus moves to another game, and it moves with each new day too. The order is drawn from the
 * date, the same for everyone; each player moves through it at their own pace.
 */
export const HOT_BONUS = 1;
export const HOT_PLAYS = 3;
/** The games it visits: `id` is what their best keys start with ("memory:pokemon"). */
export const HOT_GAMES = [
  { id: 'rail', to: '/rail-rush', title: 'Rail Rush', icon: '🚂' },
  { id: 'whos', to: '/whos-that', title: "Who's That?", icon: '👤' },
  { id: 'hl', to: '/higher-lower', title: 'Higher or Lower', icon: '↕️' },
  { id: 'ntl', to: '/name-them-all', title: 'Name Them All', icon: '📝' },
  { id: 'wordle', to: '/wordle', title: 'Franchise Wordle', icon: '🟩' },
  { id: 'sort', to: '/quick-sort', title: 'Quick Sort', icon: '↔️' },
  { id: 'six', to: '/six-degrees', title: 'Six Degrees', icon: '🕸️' },
  { id: 'who', to: '/who-am-i', title: 'Who Am I?', icon: '🕵️' },
  { id: 'climb', to: '/summit', title: 'Summit', icon: '🧗' },
  { id: 'cross', to: '/crossroads', title: 'Crossroads', icon: '🌉' },
  { id: 'odd', to: '/odd-one-out', title: 'Odd One Out', icon: '🧩' },
  { id: 'memory', to: '/memory', title: 'Memory Pairs', icon: '🃏' },
  { id: 'map', to: '/map-quiz', title: 'Map Quiz', icon: '📍' },
  { id: 'year', to: '/guess-the-year', title: 'Guess the Year', icon: '📅' },
  { id: 'jlpt', to: '/jlpt', title: 'JLPT', icon: '🇯🇵' },
] as const;

/** A player's place in the day's order: how many times the bonus has moved, and the games played of the current one. */
export interface HotBook {
  date: string;
  moves: number;
  played: number;
}

/** The game at a place in a day's order: never the same one twice in a row. */
function hotAt(date: string, moves: number): (typeof HOT_GAMES)[number] {
  const pick = hashString(`hot:${date}:${moves}`) % HOT_GAMES.length;
  if (moves <= 0) return HOT_GAMES[pick];
  return HOT_GAMES[pick] === hotAt(date, moves - 1) ? HOT_GAMES[(pick + 1) % HOT_GAMES.length] : HOT_GAMES[pick];
}

/** The Hot Game today, and how many games of it are left. */
export function hotNow(book: HotBook | undefined, date: string) {
  const b = book?.date === date ? book : { date, moves: 0, played: 0 };
  return { game: hotAt(date, b.moves), left: HOT_PLAYS - b.played, book: b };
}

/** A finished game's coins with the bonus if it's the Hot Game, and the book after it. */
export function payHot(book: HotBook | undefined, date: string, key: string, amount: number): { amount: number; book: HotBook } {
  const now = hotNow(book, date);
  if (key.split(':')[0] !== now.game.id) return { amount, book: now.book };
  const played = now.book.played + 1;
  return {
    amount: Math.round(amount * (1 + HOT_BONUS)),
    book: played >= HOT_PLAYS ? { date, moves: now.book.moves + 1, played: 0 } : { date, moves: now.book.moves, played },
  };
}

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

/**
 * Luck (pity): every pack opened without a Legendary or better raises the odds of Legendary, Mythic and
 * Omni by this share, up to PITY_MAX times; the first one pulled sets it back to the start. Mythic and Omni
 * get none of it (PITY_TOP_SHARE), so they stay rare: a Legendary or better about every 16 packs on average
 * (24 without luck); a Mythic or better about every 250, luck or not.
 */
export const PITY_STEP = 0.05;
export const PITY_MAX = 3;
export const PITY_TOP_SHARE = 0;
/** The packs it takes to reach the most luck: the counter never goes past it (nor below 0, nor to NaN). */
export const PITY_PACKS = Math.round((PITY_MAX - 1) / PITY_STEP);
export const clampPity = (pity: number | undefined) => (Number.isFinite(pity) ? Math.min(PITY_PACKS, Math.max(0, Math.floor(pity as number))) : 0);
export const pityLuck = (pity: number) => Math.min(PITY_MAX, 1 + PITY_STEP * clampPity(pity));

/** The most an Expedition pays in DleCoins for one room (elites included) and one boss, however deep the run. */
export const EXPEDITION_ROOM_MAX = 24;
export const EXPEDITION_BOSS_MAX = 120;
/** Expeditions have a daily amount of their own: in full up to this, then a quarter (at least a coin). */
export const EXPEDITION_CAP = 300;
export const EXPEDITION_AFTER_CAP = 0.25;

/** A spare copy of a card, traded in: by rarity (a pack of five costs 100–150). */
export const DUPLICATE_VALUE = { common: 2, rare: 5, epic: 15, legendary: 50, mythic: 150, omni: 500 } as const;

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
  /** Coins from Expeditions so far today. */
  expedition?: number;
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
