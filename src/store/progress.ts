import { create } from 'zustand';
import { canGradeUp, gradeOf, gradeReward, gradeRewards, GRADE_COST } from '../gacha/grades';
import type { Rarity } from '../gacha/cards';
import { RETIRED } from '../gacha/retired';
import { persist } from 'zustand/middleware';
import type { RunState } from '../rogue/run';
import { addDays, todayKey } from '../lib/date';
import { ROUNDS_PER_DAY } from '../lib/rounds';
import type { Domain, RoundRecord, RoundSpec } from '../types';
import {
  clampPity,
  ARCADE_AFTER_CAP,
  ARCADE_BEST_BONUS,
  arcadeCoins,
  bestCounts,
  type ArcadeResult,
  ARCADE_CAP,
  ARCADE_SPACING_MS,
  BOSS_LOSS,
  BOSS_WEEKLY,
  BOSS_WIN,
  CATEGORY_BONUS,
  MISSIONS,
  freshEconomy,
  missionsFor,
  roundCoins,
  weekOf,
  type BossWeek,
  type Economy,
  type MissionKind,
  freshBook,
  LONG_MISSIONS,
  longMissionsFor,
  periodOf,
  type LongKind,
  type Period,
  type PeriodBooks,
} from '../gacha/economy';
import { CODES, normalizeCode } from '../gacha/codes';

type DayRounds = Record<number, RoundRecord>;

/** Lifetime results against one boss. Times are in milliseconds, for victories only. */
export interface BossRecord {
  plays: number;
  wins: number;
  bestScore: number;
  bestTime: number | null;
}

export const EMPTY_BOSS_RECORD: BossRecord = { plays: 0, wins: 0, bestScore: 0, bestTime: null };

export type BossDifficulty = 'easy' | 'medium' | 'hard' | 'hell';

/** Records are kept per boss and difficulty; Easy keeps the plain id that records had before difficulties. */
export const bossKey = (id: string, difficulty: BossDifficulty) => (difficulty === 'easy' ? id : `${id}:${difficulty}`);

/** 'system' follows the OS; the others force a theme. */
export type ThemeChoice = 'system' | 'light' | 'dark';
/** Naming language for games that need one spelling. */
export type NameLang = 'en' | 'fr';

/** Storage key for one category's daily on one date, e.g. "anime:2026-10-18". */
export const dayKey = (domain: Domain, date: string) => `${domain}:${date}`;

interface ProgressState {
  /** dayKey(domain, date) -> round index -> record */
  days: Record<string, DayRounds>;
  /**
   * Rounds of each daily as first generated. Adding works to the dataset changes what
   * buildDaily() draws, so a day that was already opened keeps its original rounds.
   */
  specs: Record<string, RoundSpec[]>;
  freePlay: { played: number; won: number; points: number };
  /** bossKey(id, difficulty) -> record. */
  bosses: Record<string, BossRecord>;
  /** Difficulty picked last on a boss intro. */
  bossDifficulty: BossDifficulty;
  /** "Who's That?": best score per series id or "all-<domain>". */
  whosThat: Record<string, number>;
  /** Best scores in the arcade games (Higher or Lower, Name Them All, Guess the Year), by "<game>:<mode>". */
  bests: Record<string, number>;
  /** DleCoins, to spend on card packs (src/gacha). */
  coins: number;
  /** Cards collected: card id -> how many times it was pulled. */
  cards: Record<string, number>;
  /** Today's earnings book: capped coins, missions (see src/gacha/economy.ts). */
  econ: Economy;
  /** This week's boss bonuses already paid. */
  bossWeek: BossWeek;
  packsOpened: number;
  /** Packs opened since the last Legendary or better: the luck that raises their odds (see pityLuck). */
  pity: number;
  /** A card shown as the player's icon (any card they own). */
  avatar: string | null;
  /** A card shown behind the pages (Rare or better). */
  backdrop: string | null;
  /** Legendary and Mythic icons and backgrounds react to the play (on unless turned off). */
  cardReactions: boolean;
  setCardReactions: (on: boolean) => void;
  /** An equipped Omni card restyles the whole site (on unless turned off). */
  omniAura: boolean;
  setOmniAura: (on: boolean) => void;
  /** Mythics' voice lines, heard (on unless turned off; the card still shows them). */
  voiceLines: boolean;
  setVoiceLines: (on: boolean) => void;
  /** Five spare copies of one rarity traded for one new card of it (card id -> copies given). */
  renewCards: (spent: Record<string, number>, gained: string) => void;
  /** Each card's grade, I to V (1 when missing). */
  grades: Record<string, number>;
  /** The highest grade already paid for, per card (grades reached before the rewards existed are paid once, later). */
  gradesPaid: Record<string, number>;
  /** Five copies of a card into one a grade higher (the card and four spares); pays the grade's reward. */
  gradeUp: (id: string, rarity: Rarity) => boolean;
  /** Pays every grade reached and not paid for yet (rarityOf: a card id's rarity): the coins and grades paid. */
  payGradeBacklog: (rarityOf: (id: string) => Rarity | undefined) => { coins: number; grades: number };
  /** Folds the copies of retired cards into the cards that replace them (see RETIRED): what was folded, and the coins. */
  foldRetiredCards: () => { folded: { name: string; intoName: string; copies: number }[]; coins: number };
  setAvatar: (cardId: string | null) => void;
  setBackdrop: (cardId: string | null) => void;
  /** Pays for a pack and adds its cards; false (and nothing done) when the coins aren't there. */
  /** `packs`: how many packs that was (five opened at once count as five). */
  openPack: (cost: number, cardIds: string[], packs?: number, pity?: number) => boolean;
  claimMission: (kind: MissionKind) => void;
  /** This week's and this month's missions (see src/gacha/economy.ts). */
  missionBooks: PeriodBooks;
  claimLongMission: (period: Period, kind: LongKind) => void;
  /** Dailies shared by a group code (src/cloud/groups.ts), by dayKey: the code this player made, or the one they joined. */
  groups: Record<string, { code: string; role: 'host' | 'joined'; host?: string }>;
  setGroup: (key: string, group: { code: string; role: 'host' | 'joined'; host?: string }) => void;
  /** Gift codes already redeemed (normalized). */
  redeemed: string[];
  /** A gift code typed in the Shop: its coins, once per player. */
  redeemCode: (code: string) => { ok: true; coins: number; note: string } | { ok: false; reason: 'used' | 'unknown' };
  /** Coins earned outside the capped games (an Expedition room or boss): paid in full. */
  earnCoins: (amount: number) => void;
  /** Spare copies traded in for coins: card id -> how many (one copy of each always stays), and the coins they're worth. */
  exchangeCards: (copies: Record<string, number>, coins: number) => void;
  /** Cards in or out by trading (src/cloud/trades.ts): card id -> +1 or -1. */
  moveCards: (delta: Record<string, number>) => void;
  /** The Expedition run in progress (src/rogue/run.ts), kept across refreshes. */
  rogueRun: RunState | null;
  setRogueRun: (run: RunState | null) => void;
  /** Specialist dailies: "<universe>:<date>" -> round index -> record. */
  special: Record<string, DayRounds>;
  sound: boolean;
  /** Volume of the synthesized sound effects, 0–200 (above 100 boosts them). */
  sfxVolume: number;
  /** Volume of the YouTube clips (soundtracks, voices, laughs), 0–100: YouTube's player can't go louder. */
  clipVolume: number;
  theme: ThemeChoice;
  /** Which names games ask for when only one will do (Franchise Wordle): English or French. */
  nameLang: NameLang;
  setNameLang: (lang: NameLang) => void;
  /**
   * What came up recently outside the dailies, most recent first, by scope ("boss:<id>:faces",
   * "free:<domain>", "practice:<universe>:<type>"...), so new games draw something not seen lately.
   */
  seen: Record<string, string[]>;
  markSeen: (scope: string, ids: string[]) => void;
  recordBoss: (key: string, result: { won: boolean; score: number; time: number }) => void;
  setBossDifficulty: (d: BossDifficulty) => void;
  /** A finished run's score, and how it went (src/gacha/economy.ts' ArcadeResult): what it pays. */
  recordWhosThat: (key: string, score: number, result: ArcadeResult) => void;
  recordBest: (key: string, score: number, result: ArcadeResult) => void;
  setSpecialRound: (key: string, index: number, record: RoundRecord) => void;
  setRound: (domain: Domain, date: string, index: number, record: RoundRecord) => void;
  saveSpecs: (domain: Domain, date: string, specs: RoundSpec[]) => void;
  recordFreePlay: (record: RoundRecord) => void;
  toggleSound: () => void;
  setVolume: (kind: 'sfxVolume' | 'clipVolume', value: number) => void;
  cycleTheme: () => void;
  resetAll: () => void;
}

/** Today's earnings book (a new one each day). */
export const econToday = (e: Economy | undefined) => (e && e.date === todayKey() ? e : freshEconomy(todayKey()));

/** This week's and this month's missions books (new ones each Monday and each 1st). */
export const booksNow = (b: PeriodBooks | undefined): PeriodBooks => {
  const today = todayKey();
  const now = (p: Period) => (b?.[p] && b[p].period === periodOf(p, today) ? b[p] : freshBook(p, today));
  return { week: now('week'), month: now('month') };
};

/** The books with a few more done (`count`: kind -> how many). */
function countLong(b: PeriodBooks | undefined, count: Partial<Record<LongKind, number>>): PeriodBooks {
  const books = booksNow(b);
  const bump = (p: Period) => {
    const counters = { ...books[p].counters };
    for (const [k, n] of Object.entries(count)) if (n) counters[k as LongKind] = (counters[k as LongKind] ?? 0) + n;
    return { ...books[p], counters };
  };
  return { week: bump('week'), month: bump('month') };
}

/** This week's boss book (a new one each Monday). */
export const bossWeekNow = (b: BossWeek | undefined): BossWeek => (b && b.week === weekOf(todayKey()) ? b : { week: weekOf(todayKey()), keys: [] });

/**
 * Coins earned, written into the day's book: a game's coins (`arcade`: its key) come in full up to
 * the daily amount, then as a token; a game that saves as it goes pays once per spacing. Mission
 * counters move on.
 */
function earn(
  s: Pick<ProgressState, 'coins' | 'econ' | 'missionBooks'>,
  amount: number,
  opts: { arcade?: string; count?: Partial<Record<MissionKind, number>>; boss?: string } = {},
): Partial<Pick<ProgressState, 'coins' | 'econ' | 'missionBooks'>> {
  const e = econToday(s.econ);
  const now = Date.now();
  if (opts.arcade && now - (e.lastPaid?.[opts.arcade] ?? 0) < ARCADE_SPACING_MS) return {};
  const left = ARCADE_CAP - e.arcade;
  // Past the daily amount, half: what remains of it in full, the rest at half.
  const paid = opts.arcade ? (left >= amount ? amount : Math.max(1, Math.max(0, left) + Math.round((amount - Math.max(0, left)) * ARCADE_AFTER_CAP))) : amount;
  const counters = { ...e.counters };
  for (const [k, n] of Object.entries(opts.count ?? {})) counters[k as MissionKind] = (counters[k as MissionKind] ?? 0) + (n ?? 0);
  return {
    coins: (s.coins ?? 0) + paid,
    ...(opts.count ? { missionBooks: countLong(s.missionBooks, opts.count) } : {}),
    econ: {
      ...e,
      arcade: e.arcade + (opts.arcade ? paid : 0),
      bosses: opts.boss ? [...e.bosses, opts.boss] : e.bosses,
      lastPaid: opts.arcade ? { ...e.lastPaid, [opts.arcade]: now } : e.lastPaid,
      counters,
      earned: e.earned + paid,
    },
  };
}

/** A round that just finished (it was still being played, or not there yet). */
const justFinished = (before: RoundRecord | undefined, after: RoundRecord) => after.status !== 'playing' && (!before || before.status === 'playing');

/** How much history each "seen" scope keeps. */
const SEEN_LIMIT = 300;

/**
 * The part of a scope's history to avoid when drawing `needed` items out of `poolSize`: the most
 * recent ones, leaving the least recently seen (or never seen) available. Once everything has come
 * up, the oldest come back first.
 */
export function recentlySeen(seen: string[] | undefined, poolSize: number, needed = 1): string[] {
  return (seen ?? []).slice(0, Math.max(0, poolSize - needed));
}

/** A scope's history as recency ranks (higher = seen more recently), the shape `leastRecent` reads. */
export function seenOrder(seen: string[] | undefined): Map<string, number> {
  const list = seen ?? [];
  return new Map(list.map((id, i) => [id, list.length - i]));
}

export const useProgress = create<ProgressState>()(
  persist(
    (set, get) => ({
      days: {},
      specs: {},
      freePlay: { played: 0, won: 0, points: 0 },
      bosses: {},
      bossDifficulty: 'easy',
      whosThat: {},
      bests: {},
      coins: 0,
      cards: {},
      econ: freshEconomy(todayKey()),
      bossWeek: { week: weekOf(todayKey()), keys: [] },
      packsOpened: 0,
      pity: 0,
      missionBooks: booksNow(undefined),
      redeemed: [],
      groups: {},
      setGroup: (key, group) => set((s) => ({ groups: { ...(s.groups ?? {}), [key]: group } })),
      avatar: null,
      backdrop: null,
      cardReactions: true,
      setCardReactions: (cardReactions) => set({ cardReactions }),
      omniAura: true,
      setOmniAura: (omniAura) => set({ omniAura }),
      voiceLines: true,
      setVoiceLines: (voiceLines) => set({ voiceLines }),
      renewCards: (spent, gained) =>
        set((s) => {
          const cards = { ...s.cards };
          // Only spare copies go: one of each card always stays.
          for (const [id, n] of Object.entries(spent)) cards[id] = Math.max(1, (cards[id] ?? 0) - n);
          cards[gained] = (cards[gained] ?? 0) + 1;
          return { cards };
        }),
      grades: {},
      gradesPaid: {},
      gradeUp: (id, rarity) => {
        const s = get();
        const grade = gradeOf(s.grades, id);
        if (!canGradeUp(s.cards[id] ?? 0, grade)) return false;
        // A grade pays once, even if the card was traded away and graded again.
        const paid = s.gradesPaid?.[id] ?? 1;
        const coins = grade + 1 > paid ? gradeReward(rarity, grade + 1) : 0;
        set({
          cards: { ...s.cards, [id]: s.cards[id] - GRADE_COST },
          grades: { ...s.grades, [id]: grade + 1 },
          gradesPaid: { ...s.gradesPaid, [id]: Math.max(paid, grade + 1) },
          ...(coins ? earn(s, coins) : {}),
        });
        return true;
      },
      foldRetiredCards: () => {
        const s = get();
        const cards = { ...s.cards };
        const grades = { ...s.grades };
        const gradesPaid = { ...s.gradesPaid };
        let { avatar, backdrop } = s;
        let coins = 0;
        const folded: { name: string; intoName: string; copies: number }[] = [];
        for (const [id, r] of Object.entries(RETIRED)) {
          const copies = cards[id] ?? 0;
          if (!copies) continue;
          cards[r.into] = (cards[r.into] ?? 0) + copies;
          delete cards[id];
          // The better grade of the two stays, and is never paid again.
          if (grades[id]) grades[r.into] = Math.max(grades[r.into] ?? 1, grades[id]);
          if (gradesPaid[id]) gradesPaid[r.into] = Math.max(gradesPaid[r.into] ?? 1, gradesPaid[id]);
          delete grades[id];
          delete gradesPaid[id];
          if (avatar === id) avatar = r.into;
          if (backdrop === id) backdrop = r.into;
          coins += copies * r.coins;
          folded.push({ name: r.name, intoName: r.intoName, copies });
        }
        if (folded.length) set({ cards, grades, gradesPaid, avatar, backdrop, ...(coins ? earn(s, coins) : {}) });
        return { folded, coins };
      },
      payGradeBacklog: (rarityOf) => {
        const s = get();
        let coins = 0;
        let count = 0;
        const gradesPaid = { ...s.gradesPaid };
        for (const [id, g] of Object.entries(s.grades ?? {})) {
          const paid = gradesPaid[id] ?? 1;
          const rarity = rarityOf(id);
          if (!rarity || g <= paid) continue;
          coins += gradeRewards(rarity, paid, g);
          count += g - paid;
          gradesPaid[id] = g;
        }
        if (count) set({ gradesPaid, ...(coins ? earn(s, coins) : {}) });
        return { coins, grades: count };
      },
      setAvatar: (avatar) => set({ avatar }),
      setBackdrop: (backdrop) => set({ backdrop }),
      openPack: (cost, cardIds, packs = 1, pity) => {
        if (get().coins < cost) return false;
        set((s) => {
          const cards = { ...s.cards };
          for (const id of cardIds) cards[id] = (cards[id] ?? 0) + 1;
          return { coins: s.coins - cost, cards, packsOpened: (s.packsOpened ?? 0) + packs, missionBooks: countLong(s.missionBooks, { packs }), ...(pity !== undefined ? { pity: clampPity(pity) } : {}) };
        });
        return true;
      },
      exchangeCards: (copies, coins) =>
        set((s) => {
          const cards = { ...s.cards };
          for (const [id, n] of Object.entries(copies)) cards[id] = Math.max(1, (cards[id] ?? 0) - n);
          return { cards, coins: (s.coins ?? 0) + coins };
        }),
      moveCards: (delta) =>
        set((s) => {
          const cards = { ...s.cards };
          for (const [id, n] of Object.entries(delta)) {
            const left = (cards[id] ?? 0) + n;
            if (left > 0) cards[id] = left;
            else delete cards[id];
          }
          // A card traded away for good takes its grade with it.
          const grades = { ...(s.grades ?? {}) };
          for (const id of Object.keys(grades)) if (!cards[id]) delete grades[id];
          return { cards, grades };
        }),
      earnCoins: (amount) => set((s) => earn(s, amount)),
      claimLongMission: (p, kind) =>
        set((s) => {
          const books = booksNow(s.missionBooks);
          const book = books[p];
          const m = LONG_MISSIONS[p][kind];
          if (book.claimed.includes(kind) || !longMissionsFor(p, book.period).includes(kind) || (book.counters[kind] ?? 0) < m.need) return {};
          const e = econToday(s.econ);
          return {
            coins: (s.coins ?? 0) + m.reward,
            econ: { ...e, earned: e.earned + m.reward },
            missionBooks: { ...books, [p]: { ...book, claimed: [...book.claimed, kind] } },
          };
        }),
      redeemCode: (raw) => {
        const code = normalizeCode(raw);
        const gift = CODES[code];
        if (!gift) return { ok: false, reason: 'unknown' };
        const s = get();
        if ((s.redeemed ?? []).includes(code)) return { ok: false, reason: 'used' };
        set({ coins: (s.coins ?? 0) + gift.coins, redeemed: [...(s.redeemed ?? []), code] });
        return { ok: true, coins: gift.coins, note: gift.note };
      },
      claimMission: (kind) =>
        set((s) => {
          const e = econToday(s.econ);
          const m = MISSIONS[kind];
          if (e.claimed.includes(kind) || !missionsFor(e.date).includes(kind) || (e.counters[kind] ?? 0) < m.need) return {};
          return { coins: (s.coins ?? 0) + m.reward, econ: { ...e, claimed: [...e.claimed, kind], earned: e.earned + m.reward } };
        }),
      rogueRun: null,
      setRogueRun: (rogueRun) => set({ rogueRun }),
      special: {},
      sound: true,
      sfxVolume: 100,
      clipVolume: 80,
      theme: 'system',
      nameLang: 'en',
      setNameLang: (nameLang) => set({ nameLang }),
      seen: {},
      markSeen: (scope, ids) =>
        set((s) => {
          const old = (s.seen[scope] ?? []).filter((x) => !ids.includes(x));
          return { seen: { ...s.seen, [scope]: [...ids, ...old].slice(0, SEEN_LIMIT) } };
        }),
      setRound: (domain, date, index, record) =>
        set((s) => {
          const key = dayKey(domain, date);
          const day = { ...s.days[key], [index]: record };
          const update = { days: { ...s.days, [key]: day } };
          if (!justFinished(s.days[key]?.[index], record)) return update;
          // Coins for the round, and a bonus once all ten are played.
          const won = record.status === 'won';
          const complete = summarizeDay(day).finished >= ROUNDS_PER_DAY && summarizeDay(s.days[key]).finished < ROUNDS_PER_DAY;
          return { ...update, ...earn(s, roundCoins(won, record.score) + (complete ? CATEGORY_BONUS : 0), { count: { rounds: won ? 1 : 0, category: complete ? 1 : 0 } }) };
        }),
      saveSpecs: (domain, date, specs) => set((s) => ({ specs: { ...s.specs, [dayKey(domain, date)]: specs } })),
      recordFreePlay: (record) =>
        set((s) => ({
          ...earn(s, arcadeCoins({ won: record.status === 'won' }), { arcade: 'freeplay' }),
          freePlay: {
            played: s.freePlay.played + 1,
            won: s.freePlay.won + (record.status === 'won' ? 1 : 0),
            points: s.freePlay.points + record.score,
          },
        })),
      setBossDifficulty: (bossDifficulty) => set({ bossDifficulty }),
      recordBest: (key, score, result) =>
        set((s) => {
          const bests = { ...s.bests, [key]: Math.max(s.bests[key] ?? 0, score) };
          // A best kept mid-run: nothing paid, nothing counted (the run's end will).
          if ('save' in result) return { bests };
          const bonus = bestCounts(result) && score > 0 && score > (s.bests[key] ?? 0) ? ARCADE_BEST_BONUS : 0;
          return { bests, ...earn(s, arcadeCoins(result) + bonus, { arcade: key, count: { arcade: 1 } }) };
        }),
      recordWhosThat: (key, score, result) =>
        set((s) => {
          const bonus = bestCounts(result) && score > 0 && score > (s.whosThat[key] ?? 0) ? ARCADE_BEST_BONUS : 0;
          return {
            whosThat: { ...s.whosThat, [key]: Math.max(s.whosThat[key] ?? 0, score) },
            ...earn(s, arcadeCoins(result) + bonus, { arcade: `whos:${key}`, count: { whos: 1 } }),
          };
        }),
      setSpecialRound: (key, index, record) =>
        set((s) => {
          const update = { special: { ...s.special, [key]: { ...s.special[key], [index]: record } } };
          if (!justFinished(s.special[key]?.[index], record)) return update;
          const won = record.status === 'won';
          return { ...update, ...earn(s, roundCoins(won, record.score), { count: { special: won ? 1 : 0 } }) };
        }),
      recordBoss: (key, { won, score, time }) =>
        set((s) => {
          const r = s.bosses[key] ?? EMPTY_BOSS_RECORD;
          // Every fight pays: a win by difficulty (plus the week's first win over this boss at this difficulty), a loss a token.
          const difficulty = (key.split(':')[1] ?? 'easy') as BossDifficulty;
          const week = bossWeekNow(s.bossWeek);
          const weekly = won && !week.keys.includes(key);
          const coins = earn(s, won ? BOSS_WIN[difficulty] + (weekly ? BOSS_WEEKLY[difficulty] : 0) : BOSS_LOSS, { count: { boss: won ? 1 : 0 } });
          return {
            ...coins,
            bossWeek: weekly ? { ...week, keys: [...week.keys, key] } : week,
            bosses: {
              ...s.bosses,
              [key]: {
                plays: r.plays + 1,
                wins: r.wins + (won ? 1 : 0),
                bestScore: Math.max(r.bestScore, score),
                bestTime: won ? Math.min(r.bestTime ?? Infinity, time) : r.bestTime,
              },
            },
          };
        }),
      toggleSound: () => set((s) => ({ sound: !s.sound })),
      setVolume: (kind, value) => set({ [kind]: Math.max(0, Math.min(kind === 'sfxVolume' ? 200 : 100, Math.round(value))) }),
      cycleTheme: () => set((s) => ({ theme: s.theme === 'system' ? 'light' : s.theme === 'light' ? 'dark' : 'system' })),
      resetAll: () =>
        set({ days: {}, specs: {}, freePlay: { played: 0, won: 0, points: 0 }, bosses: {}, whosThat: {}, bests: {}, rogueRun: null, special: {}, seen: {}, coins: 0, cards: {}, econ: freshEconomy(todayKey()), bossWeek: { week: weekOf(todayKey()), keys: [] }, packsOpened: 0, missionBooks: booksNow(undefined), avatar: null, backdrop: null }),
    }),
    {
      name: 'omnidle-progress',
      version: 4,
      // v1 had a single mixed daily keyed by date; its rounds don't map onto per-category dailies.
      migrate: (persisted, version) => {
        const s = persisted as Partial<ProgressState>;
        if (version < 2) return { ...s, days: {}, specs: {}, sound: true } as ProgressState;
        // v3 added round snapshots; days played before it simply get one on next open.
        const specs = { ...(s.specs ?? {}) };
        const days = { ...(s.days ?? {}) };
        if (version < 4) {
          // v4 replaced the Credits mini-game with Cover Puzzle: regenerate days that contained it.
          for (const [key, list] of Object.entries(specs)) {
            if (list.some((r) => (r.type as string) === 'creator')) {
              delete specs[key];
              delete days[key];
            }
          }
        }
        return { ...s, specs, days } as ProgressState;
      },
    },
  ),
);

export interface DaySummary {
  finished: number;
  won: number;
  score: number;
  complete: boolean;
}

export function summarizeDay(rounds: DayRounds | undefined): DaySummary {
  const done = Object.values(rounds ?? {}).filter((r) => r.status !== 'playing');
  return {
    finished: done.length,
    won: done.filter((r) => r.status === 'won').length,
    score: done.reduce((sum, r) => sum + r.score, 0),
    complete: done.length >= ROUNDS_PER_DAY,
  };
}

/**
 * Consecutive completed days ending today (or yesterday, if today is still in progress).
 * With a domain: that category's daily. Without: any category completed counts for the day.
 */
export function computeStreak(days: ProgressState['days'], domain?: Domain): { current: number; best: number } {
  const completeOn = (date: string) =>
    domain
      ? summarizeDay(days[dayKey(domain, date)]).complete
      : Object.keys(days).some((k) => k.endsWith(`:${date}`) && summarizeDay(days[k]).complete);

  let cursor = todayKey();
  if (!completeOn(cursor)) cursor = addDays(cursor, -1);
  let current = 0;
  while (completeOn(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }

  const dates = [...new Set(Object.keys(days).map((k) => k.split(':')[1]))].filter(completeOn).sort();
  let best = 0;
  let run = 0;
  let prev = '';
  for (const d of dates) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return { current, best: Math.max(best, current) };
}

/**
 * Consecutive Specialist dailies completed (all `rounds` rounds played) for one universe, ending
 * today or yesterday.
 */
export function specialStreak(special: ProgressState['special'], universe: string, rounds: number): number {
  const done = (date: string) => Object.values(special[`${universe}:${date}`] ?? {}).filter((r) => r.status !== 'playing').length >= rounds;
  let cursor = todayKey();
  if (!done(cursor)) cursor = addDays(cursor, -1);
  let n = 0;
  while (done(cursor)) {
    n++;
    cursor = addDays(cursor, -1);
  }
  return n;
}
