// DleCoins: what playing earns, to spend on card packs. The dailies pay the most (more for a better
// score); every boss fight pays by difficulty, and the first win over each boss at each difficulty
// pays a bonus once a week; every game from the Games page pays by how it went (fully up to a daily
// amount, then half, so farming always pays); Expeditions pay little, with a daily amount of their own
// (then a quarter), so that they never replace the other games; three daily missions pay a
// bonus each, and three a week and three a month pay more.
//
// The numbers live in src/data/tuning/economy.json (edited from the dev-only #/admin page, checked by
// `npm run data:validate`); the rules that use them stay here.
import { hashString } from '../lib/rng';
import type { BossDifficulty } from '../store/progress';
import T from '../data/tuning/economy.json';
import G from '../data/tuning/games.json';
import { MAX_DAILY_SCORE } from '../lib/scoring';

/** A finished daily round (category or Specialist): more for a better score. */
export const roundCoins = (won: boolean, score: number, r: typeof T.round = T.round) => (won ? r.win + r.perTenPoints * Math.floor(Math.max(0, score) / 10) : r.loss);
/** A daily round's coins (the numbers). */
export const ROUND = T.round;
/** All ten rounds of a category's daily played, on a past day (the Archive). */
export const CATEGORY_BONUS = T.categoryBonus;
/**
 * One of today's four category dailies finished: from DAILY_COMPLETE.min (a score of 0) to .max (a perfect
 * score), by its score, to the nearest 10; and DAILY_COMPLETE.allFour once all four of today's are done.
 */
export const DAILY_COMPLETE = T.dailyComplete;
export const dailyCompleteCoins = (score: number) => {
  const share = Math.min(1, Math.max(0, score / MAX_DAILY_SCORE));
  return Math.round((DAILY_COMPLETE.min + (DAILY_COMPLETE.max - DAILY_COMPLETE.min) * share) / 10) * 10;
};

/** What one trade offer can hold on each side (src/cloud/trades.ts; firestore.rules keeps the same limits). */
export const TRADE_LIMITS = T.trades;

/** Every boss fight: a win by difficulty, a token for a loss. */
export const BOSS_WIN: Record<BossDifficulty, number> = T.bossWin;
export const BOSS_LOSS = T.bossLoss;
/** The first win over a boss at a difficulty each week (weeks start on Monday). */
export const BOSS_WEEKLY: Record<BossDifficulty, number> = T.bossWeekly;

/**
 * A game from the Games page, by how it went — fully up to a daily amount, then a token:
 * - won or lost (a Wordle, a Memory grid, a Free Play round): a good sum for a win, a token for a loss;
 * - a set of rounds (Guess the Year, Map Quiz…): by the share of the best score, a token below 40%;
 * - an endless run (Higher or Lower, Summit…): more the further it went, a little faster each step.
 * A new best (that isn't a loss) adds a bonus; a best kept in the middle of a run pays nothing.
 */
export type ArcadeResult = { won: boolean } | { ratio: number } | { reached: number } | { save: true };
/** Name Them All's clock and reward: src/data/tuning/games.json (its own section of #/admin). */
export type NameThemAllTuning = typeof G.nameThemAll;
/** Clearing a whole list (Name Them All, To the Last): this much a name, on top of the usual pay — once a day per list. */
export const CLEAR_PER_ANSWER = G.nameThemAll.clearPerAnswer;
/** A list's time: so many seconds a name, between a floor and a ceiling (the longest lists are the hardest). */
export const listSeconds = (names: number, t: NameThemAllTuning = G.nameThemAll) => Math.round(Math.min(t.maxSeconds, Math.max(t.minSeconds, names * t.secondsPerName)));
/**
 * Clearing a whole list, the first time today: by its length — every name pays — and by its pressure: a
 * list with less time a name than usual pays more (up to clearPressureMax times), up to clearMax.
 */
export function clearReward(answers: number, seconds?: number, t: NameThemAllTuning = G.nameThemAll): number {
  if (answers <= 0) return 0;
  const pressure = seconds ? Math.min(t.clearPressureMax, Math.max(1, (answers * t.secondsPerName) / seconds)) : 1;
  return Math.min(t.clearMax, Math.round(answers * t.clearPerAnswer * pressure));
}
/** The same list cleared again the same day: a token, so replaying one list isn't a farm. */
export const clearRepeatReward = (full: number, t: NameThemAllTuning = G.nameThemAll) => (full > 0 ? Math.max(1, Math.round(full * t.clearRepeat)) : 0);
/** Whether a list was already cleared today (its big reward taken). */
export const clearedToday = (e: Economy | undefined, key: string, today: string) => !!e && e.date === today && !!e.cleared?.includes(key);
export const ARCADE_WIN = T.arcade.win;
export const ARCADE_LOSS = T.arcade.loss;
export const ARCADE_BEST_BONUS = T.arcade.bestBonus;
/** A set of rounds: up to this much for a perfect score. */
export const ARCADE_SET_MAX = T.arcade.setMax;
/** An endless run's coins at most. */
export const ARCADE_RUN_MAX = T.arcade.runMax;

export function arcadeCoins(r: ArcadeResult): number {
  if ('save' in r) return 0;
  if ('won' in r) return r.won ? ARCADE_WIN : ARCADE_LOSS;
  if ('ratio' in r) return r.ratio < 0.4 ? ARCADE_LOSS : Math.round(8 + (ARCADE_SET_MAX - 8) * Math.min(1, r.ratio));
  // `reached`: the run's length in steps (each game says what a step is): 2 a step, and more and more as it goes
  // on — the endless games get harder the further they go, so the deep steps pay the most.
  const u = Math.max(0, r.reached);
  return Math.min(ARCADE_RUN_MAX, 4 + 2 * Math.floor(2 * u + (u * u) / 15));
}
/**
 * Whether a finished game counts for the quests and missions: a game won or lost, a set with something right,
 * an endless run that got somewhere (T.arcade.minRun steps). A run lost at once (and the page refreshed, again
 * and again) counts for nothing: it was a way to fill the Who's That? missions in minutes.
 */
export const countsAsPlayed = (r: ArcadeResult) => !('save' in r) && ('won' in r ? true : 'ratio' in r ? r.ratio > 0 : r.reached >= T.arcade.minRun);
/** Whether a result earns the new-best bonus: not a loss, not a mid-run save. */
export const bestCounts = (r: ArcadeResult) => !('save' in r) && !('won' in r && !r.won) && !('ratio' in r && r.ratio < 0.4);
export const ARCADE_CAP = T.arcade.dailyCap;
/** Past the daily amount, this share of what a game would pay (at least a coin). */
export const ARCADE_AFTER_CAP = T.arcade.afterCap;
/** A game pays at most once per this long (so a run lost at once, again and again, isn't a farm). */
export const ARCADE_SPACING_MS = T.arcade.spacingMs;

/**
 * The Hot Game: one game of the Games page pays more, so farming means moving around. After a few games
 * of it the bonus moves to another game, and it moves with each new day too. The order is drawn from the
 * date, the same for everyone; each player moves through it at their own pace.
 */
export const HOT_BONUS = T.hot.bonus;
export const HOT_PLAYS = T.hot.plays;
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
] as const;

/**
 * The games to learn with (the JLPT's decks, its grammar, To the Last, the Japanese Wordle), by their best keys:
 * they pay like the others, but sit out the Hot Game and don't count for the missions or the quests — learning
 * isn't farming. A new learning game adds its keys here.
 */
export const isLearnKey = (key: string) => /^jlpt[:-]/.test(key) || key === 'wordle:ja';

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
  if (isLearnKey(key) || key.split(':')[0] !== now.game.id) return { amount, book: now.book };
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
export const PITY_STEP = T.pity.step;
export const PITY_MAX = T.pity.max;
export const PITY_TOP_SHARE = T.pity.topShare;
/** The packs it takes to reach the most luck: the counter never goes past it (nor below 0, nor to NaN). */
export const PITY_PACKS = Math.round((PITY_MAX - 1) / PITY_STEP);
export const clampPity = (pity: number | undefined) => (Number.isFinite(pity) ? Math.min(PITY_PACKS, Math.max(0, Math.floor(pity as number))) : 0);
export const pityLuck = (pity: number) => Math.min(PITY_MAX, 1 + PITY_STEP * clampPity(pity));

/**
 * Omni luck, for the unlucky: every pack opened without an Omni raises the Omni odds by OMNI_PITY.step (+1%), up to
 * OMNI_PITY.max times (still under the Omni cap); only an Omni pulled from a pack sets it back to the start.
 */
export const OMNI_PITY = T.omniPity;
/** The packs it takes to reach the most Omni luck: the counter never goes past it. */
export const OMNI_PITY_PACKS = Math.round((OMNI_PITY.max - 1) / OMNI_PITY.step);
export const clampOmniPity = (n: number | undefined) => (Number.isFinite(n) ? Math.min(OMNI_PITY_PACKS, Math.max(0, Math.floor(n as number))) : 0);
export const omniLuck = (n: number | undefined) => Math.min(OMNI_PITY.max, 1 + OMNI_PITY.step * clampOmniPity(n));

/**
 * The golden pack: every GOLDEN.packs-th pack opened (any pack, whatever it held) comes golden. Its last
 * GOLDEN.slots cards are Legendary or better: the very last one now and then Mythic (GOLDEN.last), the
 * others Legendary with a small chance of better (GOLDEN.others), in percent. With the live numbers (150
 * packs; 35% / 1% on the last, 3% / 0.25% on the two before): a Mythic or better in about 40% of golden
 * packs and an Omni in 1.5%, so the endgame stays far away (retuned 6 November 2026: at 80% / 3% the golden
 * packs alone gave half of all Mythics). The counter is the packs opened since the last golden one.
 */
export const GOLDEN = T.golden;
export const clampGolden = (n: number | undefined) => (Number.isFinite(n) ? Math.min(GOLDEN.packs - 1, Math.max(0, Math.floor(n as number))) : 0);
/** Whether the next pack opened is golden. */
export const goldenNext = (n: number | undefined) => clampGolden(n) >= GOLDEN.packs - 1;

/** The most an Expedition pays in DleCoins for one room (elites included) and one boss, however deep the run. */
export const EXPEDITION_ROOM_MAX = T.expedition.roomMax;
export const EXPEDITION_BOSS_MAX = T.expedition.bossMax;
/** Beating the last act's guardian: on top of its own coins. */
export const EXPEDITION_COMPLETE_BONUS = T.expedition.completeBonus;

/**
 * The Casino's roulette: a spin costs a few coins, with a small chance of a big jackpot, a better one of a small
 * prize, and a free-spin slice that sets the wheel turning again by itself. At the defaults it pays back a
 * little more than it takes (about 105%, nearly all of it through the jackpot): a player who puts in a lot
 * comes out ahead on average, and the daily spins cap what anyone can make of it.
 */
export const ROULETTE = T.roulette;
/** 👑 the mega jackpot, 💎 the jackpot, 🪙 a small prize, 🎁 a free pack, 🔄 a free spin, or nothing. */
export type RoulettePrize = 'mega' | 'jackpot' | 'small' | 'pack' | 'free' | 'none';
/** A prize that pays (coins or a pack): it ends a lucky streak. */
export const rouletteWins = (p: RoulettePrize) => p !== 'none' && p !== 'free';
/** The lucky streak: every empty landing in a row raises the odds of every prize a little, up to a cap. */
export const rouletteLuck = (streak: number | undefined) => Math.min(ROULETTE.streakMax, 1 + ROULETTE.streakStep * Math.max(0, streak ?? 0));
/** `luck` raises the odds of every prize (the lucky streak); the free spin's stay as they are. */
export function rouletteRoll(r: number = Math.random(), luck = 1): RoulettePrize {
  let at = 0;
  for (const [prize, chance] of [['mega', ROULETTE.megaChance * luck], ['jackpot', ROULETTE.jackpotChance * luck], ['small', ROULETTE.smallChance * luck], ['pack', ROULETTE.packChance * luck], ['free', ROULETTE.freeChance]] as const) {
    if (r < (at += chance)) return prize;
  }
  return 'none';
}
/** One paid spin and the free spins it sets off: every landing in order, the last one what it pays. */
export function rouletteChain(rand: () => number = Math.random, luck = 1): RoulettePrize[] {
  const chain: RoulettePrize[] = [];
  for (;;) {
    let p = rouletteRoll(rand(), luck);
    // Past the most free spins in a row, the wheel lands on something else.
    while (p === 'free' && chain.length >= ROULETTE.maxFree) p = rouletteRoll(rand(), luck);
    chain.push(p);
    if (p !== 'free') return chain;
  }
}
/** What a spin pays back on average in coins, for each coin put in (free spins included; packs and the lucky streak aside). */
export const rouletteReturn = () => (ROULETTE.mega * ROULETTE.megaChance + ROULETTE.jackpot * ROULETTE.jackpotChance + ROULETTE.small * ROULETTE.smallChance) / (1 - ROULETTE.freeChance) / ROULETTE.cost;
export const roulettePay = (p: RoulettePrize) => (p === 'mega' ? ROULETTE.mega : p === 'jackpot' ? ROULETTE.jackpot : p === 'small' ? ROULETTE.small : 0);
/** Expeditions have a daily amount of their own: in full up to this, then a quarter (at least a coin). */
export const EXPEDITION_CAP = T.expedition.dailyCap;
export const EXPEDITION_AFTER_CAP = T.expedition.afterCap;

/** A spare copy of a card, traded in: by rarity (a pack of five costs 100–150). */
export const DUPLICATE_VALUE: Record<'common' | 'rare' | 'epic' | 'legendary' | 'mythic' | 'omni', number> = T.duplicateValue;

export type MissionKind = 'rounds' | 'category' | 'special' | 'boss' | 'arcade' | 'whos';

export type MissionSpec = { icon: string; text: string; need: number; reward: number };
export const MISSIONS: Record<MissionKind, MissionSpec> = T.missions;

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
  /** Roulette spins so far today. */
  spins?: number;
  /** The Casino's slot spins and pachinko balls so far today. */
  slots?: number;
  balls?: number;
  /** bossKey()s already paid for today (kept for old saves; bosses now pay by the week, see BossWeek). */
  bosses: string[];
  /** When each game last paid (by its best key), for the spacing between pays. */
  lastPaid?: Record<string, number>;
  counters: Partial<Record<QuestCounter, number>>;
  claimed: MissionKind[];
  /** Coins earned today in all, for the shop's "today" line. */
  earned: number;
  /** Lists cleared in full today (Name Them All, To the Last), each paid its big reward once a day. */
  cleared?: string[];
}

// ── Quests: three at a time, an Easy, a Medium and a Hard; a claimed one is replaced at once by another of its
// tier, and all of them change at midnight. Each counts from when it came up (the day's counters, above). The
// order is drawn from the date, the same for everyone; each player goes through it at their own pace. ──

export type QuestTier = 'easy' | 'medium' | 'hard';
export const QUEST_TIERS: QuestTier[] = ['easy', 'medium', 'hard'];
/** What the quests count: the daily missions' goals, and Free Play wins. */
export type QuestCounter = MissionKind | 'freeplay';
export type QuestSpec = MissionSpec & { kind: QuestCounter };
export const QUESTS = T.quests as Record<QuestTier, QuestSpec[]> & { fullPerDay: number; afterFull: number };

/** The n-th quest of a tier on a day: never the same goal twice in a row. */
export function questAt(date: string, tier: QuestTier, n: number): QuestSpec {
  const pool = QUESTS[tier];
  const pick = hashString(`quest:${date}:${tier}:${n}`) % pool.length;
  if (n <= 0) return pool[pick];
  return pool[pick].kind === questAt(date, tier, n - 1).kind ? pool[(pick + 1) % pool.length] : pool[pick];
}

/** A player's quests today: by tier, which quest of the day's order they're on and the counter when it came up, and how many they've claimed. */
export interface QuestBook {
  date: string;
  slots: Record<QuestTier, { n: number; start: number }>;
  done: Record<QuestTier, number>;
}
export const freshQuests = (date: string): QuestBook => ({ date, slots: { easy: { n: 0, start: 0 }, medium: { n: 0, start: 0 }, hard: { n: 0, start: 0 } }, done: { easy: 0, medium: 0, hard: 0 } });
export const questsNow = (b: QuestBook | undefined, date: string): QuestBook => (b?.date === date ? b : freshQuests(date));
/** A quest's coins: in full for the first few of its tier today, then a share. */
export const questReward = (q: QuestSpec, claimedToday: number) => (claimedToday < QUESTS.fullPerDay ? q.reward : Math.max(1, Math.round(q.reward * QUESTS.afterFull)));

export const freshEconomy = (date: string): Economy => ({ date, arcade: 0, bosses: [], counters: {}, claimed: [], earned: 0 });

// ── Weekly and monthly missions: the same kinds of goal, bigger, for bigger rewards; three a week, three a
// month, drawn the same for everyone. Their progress counts from the day the period starts. ──

export type Period = 'week' | 'month';
/** What the long missions count: the daily kinds, and packs opened. */
export type LongKind = MissionKind | 'packs';

export const LONG_MISSIONS: Record<Period, Record<LongKind, MissionSpec>> = T.longMissions;

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
