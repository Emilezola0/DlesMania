import type { AnomalyId } from '../gacha/anomalies';
import { create } from 'zustand';
import { canGradeUp, ELEMENT_GRADE, ELEMENT_SWITCH_COST, gradeOf, gradeReward, gradeRewards, GRADE_COST, HELL_GRADE, isElement, type ElementId, type Engraving } from '../gacha/grades';
import type { Rarity } from '../gacha/cards';
import { RETIRED } from '../gacha/retired';
import { UPGRADES } from '../gacha/upgrades';
import { persist } from 'zustand/middleware';
import { isCustomId, newCustomId, setCustomWords, type CustomWord } from '../arcade/jlptCustom';
import type { RunState } from '../rogue/run';
import { addDays, now as realNow, todayKey } from '../lib/date';
import { ROUNDS_PER_DAY } from '../lib/rounds';
import type { Domain, RoundRecord, RoundSpec } from '../types';
import {
  clampGolden,
  clampPity,
  ARCADE_AFTER_CAP,
  ARCADE_BEST_BONUS,
  arcadeCoins,
  payHot,
  type HotBook,
  bestCounts,
  type ArcadeResult,
  ARCADE_CAP,
  clearReward,
  clearRepeatReward,
  EXPEDITION_AFTER_CAP,
  EXPEDITION_CAP,
  ARCADE_SPACING_MS,
  BOSS_LOSS,
  BOSS_WEEKLY,
  BOSS_WIN,
  CATEGORY_BONUS,
  DAILY_COMPLETE,
  dailyCompleteCoins,
  MISSIONS,
  freshEconomy,
  missionsFor,
  roundCoins,
  weekOf,
  type BossWeek,
  type Economy,
  type MissionKind,
  isLearnKey,
  questAt,
  questReward,
  questsNow,
  type QuestBook,
  type QuestCounter,
  type QuestTier,
  freshBook,
  LONG_MISSIONS,
  longMissionsFor,
  periodOf,
  type LongKind,
  type Period,
  type PeriodBooks,
  ROULETTE,
  rouletteChain,
  roulettePay,
  type RoulettePrize,
} from '../gacha/economy';
import { giftFor, normalizeCode } from '../gacha/codes';
import { rollScratch, SCRATCH_BY_ID, type ScratchTicket } from '../casino/scratchCards';
import type { ClawItem } from '../casino/clawMachine';
import { PLUSH_BY_ID, PLUSH_RARITY } from '../casino/plushies';
import CASINO_T from '../data/tuning/casino.json';
import { CAPSULES, PACHINKO, SLOTS, dropBall, rollCapsule, rollSlots, slotCost, tokensFor, type Ball, type SlotResult } from '../casino/casino';
import type { Frame } from '../casino/frames';

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
/** The difficulties, easiest first: a win at one validates every one before it. */
export const DIFFICULTY_ORDER: BossDifficulty[] = ['easy', 'medium', 'hard', 'hell'];

/** What a boss fight paid: one line per difficulty it validated (the one fought last), and the total. */
export interface BossPay {
  total: number;
  lines: { difficulty: BossDifficulty; win: number; weekly: number; loss?: boolean }[];
}

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
  /** Where the player is in the day's Hot Games (src/gacha/economy.ts). */
  hotGame?: HotBook;
  /** Today's quests (an Easy, a Medium, a Hard; see src/gacha/economy.ts). */
  quests?: QuestBook;
  /** The quest of a tier claimed, if done: its coins, and the next one comes up. False if it isn't done. */
  claimQuest: (tier: QuestTier) => number | false;
  /** Packs opened since the last Legendary or better: the luck that raises their odds (see pityLuck). */
  pity: number;
  /** Packs opened since the last golden one: at GOLDEN.packs - 1, the next pack is golden (see GOLDEN). */
  golden?: number;
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
  /** Light animations (GIF art, small clips) run all the time on cards; off: still pictures, except up close. */
  cardMotion: boolean;
  /** The site's look: 'icon' follows the icon's franchise, a set id that franchise's theme, 'off' none. */
  uiTheme: string;
  setUiTheme: (theme: string) => void;
  /** The franchise's other owned characters pop up to talk. */
  companions: boolean;
  setCompanions: (on: boolean) => void;
  setCardMotion: (on: boolean) => void;
  setVoiceLines: (on: boolean) => void;
  /** Five spare copies of one rarity traded for one new card of it (card id -> copies given). */
  renewCards: (spent: Record<string, number>, gained: string) => void;
  /** Each card's grade, I to VII (1 when missing). */
  grades: Record<string, number>;
  /** The highest grade already paid for, per card (grades reached before the rewards existed are paid once, later). */
  gradesPaid: Record<string, number>;
  /** The cards taken to the last grade: who by (`by`, when signed in) and when. */
  engraved: Record<string, Engraving>;
  /** The element picked for each card at the element grade (src/gacha/grades.ts), by card id. */
  elements: Record<string, ElementId>;
  /** A card's element changed, for ELEMENT_SWITCH_COST coins: false if it can't (not at the element grade, too few coins). */
  switchElement: (id: string, element: ElementId) => boolean;
  /** Cards that came back from a black hole with an anomaly (src/gacha/anomalies.ts), by card id. */
  anomalies: Record<string, AnomalyId>;
  setAnomaly: (cardId: string, anomaly: AnomalyId | null) => void;
  /** Cards starred in the Album. */
  favorites: Record<string, true>;
  toggleFavorite: (cardId: string) => void;
  /** When each card was last pulled (a pack, Renew, a trade), by card id: the Album's "Newest" sort. */
  pulledAt: Record<string, number>;
  /** `times` roulette spins at once (×1, ×5, ×25): each one's prize, or null if it can't (too few coins or spins left today). */
  /** Each paid spin lands on `chain` in turn (free spins set it off again by themselves); the last landing pays. */
  spinRoulette: (times?: number) => { prize: RoulettePrize; chain: RoulettePrize[]; coins: number }[] | null;
  /** A slot spin at a bet (×1, ×5…): what came up and what it paid, or null if it can't (coins, spins left today). */
  /** A spin of 1, 5 or 10 machines at once, at a bet and a luck level (an index into SLOT_LUCK): each machine's result, or null if it can't. */
  playSlots: (bet: number, luck?: number, machines?: number) => SlotResult[] | null;
  /** `n` pachinko balls: each one's way down and pay, or null if it can't. Fills the meter (a free capsule when full). */
  dropBalls: (n: number) => Ball[] | null;
  /** DleCoins played at the pachinko towards its meter's next free capsule. */
  casinoMeter: number;
  /** Free capsules waiting (from the pachinko meter). */
  capsuleTokens: number;
  /** Free pachinko balls waiting (PACHINKO.freeBalls each time the meter fills), dropped before paid ones. */
  freeBalls?: number;
  /** Casino tokens, one per CARD_SHOP.coinsPerToken DleCoins paid into the casino: spent in the Daily Card Shop and the Boutique. */
  chips: number;
  /** DleCoins paid into the casino towards the next token. */
  chipCoins: number;
  /** The Daily Card Shop: the day, and the cards bought from it that day. */
  cardShop: { day: string; bought: string[] };
  /** Scratch cards (src/casino/scratchCards.ts): the day and how many of each were bought that day, the one being scratched, the best win. */
  scratch?: { day: string; bought: Record<string, number>; pending: ScratchTicket | null; best: number; free?: string[] };
  /** The claw machine (src/casino/clawMachine.ts): the day, tries played that day, tries paid for, the meter (tries without a win), the box, the plushies won, prizes won in all. */
  claw?: { day: string; tries: number; credits: number; meter: number; box: ClawItem[]; plush: Record<string, number>; wins: number };
  /** Free card packs (won at the claw), opened in the Shop for nothing. */
  freePacks?: number;
  /** The plush shown next to the player's name for friends (src/casino/plushies.ts); null: the best one. */
  shownPlush?: string | null;
  /** The Daily Doodle's rewards paid (src/friends/Doodle.tsx): "g:<drawing>" a guess paid (its coins), "a:<drawing>" the friends who guessed one of this player's drawings, paid for. */
  doodle?: Record<string, number>;
  /**
   * What this save earned while no account was signed in on this device: those copies and coins stay the player's,
   * but can't be traded (src/cloud/trades.ts, the Black Market) — so a save farmed without an account can't be
   * linked to a throwaway account and handed over. Kept up to date below the store; undefined until first set.
   */
  tradeLock?: TradeLock;
  /** A right guess at a friend's drawing: `coins` once per drawing. What was paid (0 if it was already). */
  rewardDoodleGuess: (id: string, coins: number) => number;
  /** This player's drawing guessed by `solvers` friends: `each` coins for every one not paid for yet. What was paid. */
  rewardDoodleArt: (id: string, solvers: number, each: number) => number;
  setShownPlush: (id: string | null) => void;
  /** The day's claw box, set the first time the machine is opened that day (the tries start again). */
  clawDay: (day: string, box: ClawItem[]) => void;
  /** Tries for the claw, in casino tokens: one, or the bundle. False if it can't (too few tokens, past the day's tries). */
  buyClaw: (bundle: boolean) => boolean;
  /** A try starts: one paid try used. False if there's none. */
  startClaw: () => boolean;
  /** A try ends: the box as it now lies and, if something was won, the prize (and the card, for a capsule). What a plush won again paid. */
  endClaw: (box: ClawItem[], prize: string | null, cardId?: string) => { duplicate: number };
  /** A free pack used: false if there's none. */
  useFreePack: () => boolean;
  /** Buys a scratch card: the ticket, or null if it can't (too few coins, none left today, one still being scratched). */
  buyScratch: (id: string) => ScratchTicket | null;
  /** Cashes in the card being scratched: what it won (paid in DleCoins), or null if there's none. */
  claimScratch: () => number | null;
  /** A card from today's Daily Card Shop for `price` tokens: false if it can't (too few tokens, bought already today). */
  buyShopCard: (id: string, price: number) => boolean;
  /** A capsule from the machine (a free one first, if any): the frame inside, or null if it can't. */
  openCapsule: () => { frame: Frame; duplicate: boolean; coins: number; free: boolean } | null;
  /** Icon frames won (src/casino/frames.ts), and the one worn around the icon. */
  frames: string[];
  frame: string | null;
  setFrame: (frame: string | null) => void;
  /** The Boutique's cosmetics bought (src/casino/cosmetics.ts: name styles, pack wrappers), and the ones in use. */
  cosmetics: string[];
  nameStyle: string | null;
  wrapper: string | null;
  /** The title shown under the player's name (src/casino/unlocks.ts TITLES). */
  title: string | null;
  setNameStyle: (id: string | null) => void;
  setWrapper: (id: string | null) => void;
  setTitle: (id: string | null) => void;
  /** Buys a cosmetic for `price` DleCoins, or `price` casino tokens with `inTokens` (and puts it on): false if it can't (too few, owned already). */
  buyCosmetic: (id: string, price: number, inTokens?: boolean) => boolean;
  /** Five copies of a card into one a grade higher (the card and four spares); pays the grade's reward. The element grade needs its element. */
  gradeUp: (id: string, rarity: Rarity, by?: string, element?: ElementId) => boolean;
  /** Pays every grade reached and not paid for yet (rarityOf: a card id's rarity): the coins and grades paid. */
  payGradeBacklog: (rarityOf: (id: string) => Rarity | undefined) => { coins: number; grades: number };
  /** Folds the copies of retired cards into the cards that replace them (see RETIRED): what was folded, and the coins. */
  foldRetiredCards: () => { folded: { name: string; intoName: string; copies: number }[]; coins: number };
  /**
   * A vaulted card raised to its new rarity (see UPGRADES) for its price in DleCoins, paid once: every copy, the
   * grade, element, anomaly and star go over to the new card. False (and nothing done) without the card or the coins.
   */
  upgradeCard: (id: string) => boolean;
  setAvatar: (cardId: string | null) => void;
  setBackdrop: (cardId: string | null) => void;
  /** Pays for a pack and adds its cards; false (and nothing done) when the coins aren't there. */
  /** `packs`: how many packs that was (five opened at once count as five). */
  openPack: (cost: number, cardIds: string[], packs?: number, pity?: number, golden?: number) => boolean;
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
  redeemCode: (code: string) => { ok: true; coins: number; note: string } | { ok: false; reason: 'used' | 'unknown' | 'expired' };
  /** Coins earned outside the capped games (an Expedition room or boss): paid in full. */
  /** An Expedition's coins, through its own daily amount: what was really paid. */
  earnExpedition: (amount: number) => number;
  /** Spare copies traded in for coins: card id -> how many (one copy of each always stays), and the coins they're worth. */
  exchangeCards: (copies: Record<string, number>, coins: number) => void;
  /** A card bought off a friend's Black Market stall (src/casino/BlackMarket.tsx): false if there aren't enough coins. */
  buyStallCard: (id: string, price: number) => boolean;
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
  /**
   * The JLPT words and kanji the player keeps for review (missed ones go in by themselves), by entry id
   * ("N3:vocab:12") -> right answers in a row in Review; JLPT_LEARNED in a row and it leaves the list.
   */
  jlptReview: Record<string, number>;
  /** Puts entries on the list (`keep`: added by hand — a right answer elsewhere doesn't count against it). */
  addJlptReview: (ids: string[]) => void;
  removeJlptReview: (id: string) => void;
  /** The words the player added to the list themselves (src/arcade/jlptCustom.ts), by their id ("Custom:word:…"). */
  jlptCustom: Record<string, CustomWord>;
  /** A word of the player's own, put on the review list: its id. */
  addJlptCustom: (w: Omit<CustomWord, 'at'>) => string;
  /** A Review answer: right ones add up (until it's learned and leaves), a wrong one starts over. */
  reviewJlpt: (id: string, right: boolean) => void;
  /**
   * The grammar points kept for review, their own list: "N4|～ばよかった" (level and pattern, as the list
   * writes it) -> right answers in a row in Grammar Review; JLPT_LEARNED in a row and it leaves the list.
   */
  jlptGrammarReview: Record<string, number>;
  addJlptGrammarReview: (keys: string[]) => void;
  removeJlptGrammarReview: (key: string) => void;
  reviewJlptGrammar: (key: string, right: boolean) => void;
  /** Records a fight and pays it; returns what it paid, line by line (the end screen lists them). */
  recordBoss: (key: string, result: { won: boolean; score: number; time: number }) => BossPay;
  setBossDifficulty: (d: BossDifficulty) => void;
  /** A finished run's score, and how it went (src/gacha/economy.ts' ArcadeResult): what it pays. */
  recordWhosThat: (key: string, score: number, result: ArcadeResult) => void;
  /** A whole list cleared: clearReward the first time today, a token after. Returns what was paid. */
  payCleared: (key: string, answers: number, seconds?: number) => number;
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
const CLAW_T = CASINO_T.claw;

/** The Daily Doodle's paid rewards, keeping only the last two weeks' (a key ends with its drawing's day). */
function pruneDoodle(d: Record<string, number>): Record<string, number> {
  const keep = addDays(todayKey(), -14);
  return Object.fromEntries(Object.entries(d).filter(([k]) => k.slice(-10) >= keep));
}

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
/** Cards just pulled, marked with the time (the Album's "Newest" sort). */
/** What a casino payment of `paid` DleCoins adds to the tokens. */
function paidIn(s: { chips?: number; chipCoins?: number }, paid: number) {
  const [tokens, left] = tokensFor(paid, s.chipCoins ?? 0);
  return { chips: (s.chips ?? 0) + tokens, chipCoins: left };
}

function stamp(pulledAt: Record<string, number> | undefined, ids: string[]): Record<string, number> {
  const now = Date.now();
  const out = { ...(pulledAt ?? {}) };
  for (const id of ids) out[id] = now;
  return out;
}

function earn(
  s: Pick<ProgressState, 'coins' | 'econ' | 'missionBooks'>,
  amount: number,
  opts: { arcade?: string; count?: Partial<Record<QuestCounter, number>>; boss?: string } = {},
): Partial<Pick<ProgressState, 'coins' | 'econ' | 'missionBooks'>> {
  const e = econToday(s.econ);
  const now = realNow();
  if (opts.arcade && now - (e.lastPaid?.[opts.arcade] ?? 0) < ARCADE_SPACING_MS) return {};
  const left = ARCADE_CAP - e.arcade;
  // Past the daily amount, half: what remains of it in full, the rest at half.
  const paid = opts.arcade ? (left >= amount ? amount : Math.max(1, Math.max(0, left) + Math.round((amount - Math.max(0, left)) * ARCADE_AFTER_CAP))) : amount;
  const counters = { ...e.counters };
  for (const [k, n] of Object.entries(opts.count ?? {})) counters[k as QuestCounter] = (counters[k as QuestCounter] ?? 0) + (n ?? 0);
  return {
    coins: (s.coins ?? 0) + paid,
    ...(opts.count ? { missionBooks: countLong(s.missionBooks, opts.count as Partial<Record<LongKind, number>>) } : {}),
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
/** Right answers in a row in JLPT Review for a word to count as learned and leave the list. */
export const JLPT_LEARNED = 3;

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
      golden: 0,
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
      cardMotion: true,
      uiTheme: 'icon',
      setUiTheme: (uiTheme) => set({ uiTheme }),
      companions: true,
      setCompanions: (companions) => set({ companions }),
      setCardMotion: (cardMotion) => set({ cardMotion }),
      setVoiceLines: (voiceLines) => set({ voiceLines }),
      renewCards: (spent, gained) =>
        set((s) => {
          const cards = { ...s.cards };
          // Only spare copies go: one of each card always stays.
          for (const [id, n] of Object.entries(spent)) cards[id] = Math.max(1, (cards[id] ?? 0) - n);
          cards[gained] = (cards[gained] ?? 0) + 1;
          return { cards, pulledAt: stamp(s.pulledAt, [gained]) };
        }),
      grades: {},
      gradesPaid: {},
      engraved: {},
      elements: {},
      anomalies: {},
      favorites: {},
      pulledAt: {},
      playSlots: (bet, luck = 0, machines = 1) => {
        const s = get();
        const e = econToday(s.econ);
        const spins = e.slots ?? 0;
        // Each machine is a spin of its own: its cost, and one of the day's spins.
        const cost = slotCost(bet, luck) * machines;
        if (!SLOTS.bets.includes(bet) || !SLOTS.luck[luck] || !SLOTS.machines.includes(machines) || s.coins < cost || spins + machines > SLOTS.dailySpins) return null;
        const rs = Array.from({ length: machines }, () => rollSlots(bet, luck));
        const won = rs.reduce((t, r) => t + r.coins, 0);
        set({ coins: s.coins - cost + won, econ: { ...e, slots: spins + machines, earned: e.earned + won }, ...paidIn(s, cost) });
        return rs;
      },
      casinoMeter: 0,
      capsuleTokens: 0,
      chips: 0,
      chipCoins: 0,
      cardShop: { day: '', bought: [] },
      scratch: { day: '', bought: {}, pending: null, best: 0 },
      buyScratch: (id) => {
        const s = get();
        const card = SCRATCH_BY_ID.get(id);
        const day = todayKey();
        const sc = s.scratch ?? { day: '', bought: {}, pending: null, best: 0 };
        const bought = sc.day === day ? sc.bought : {};
        const free = sc.free ?? [];
        // A free card (won at the claw): no coins, and the day's limit untouched.
        if (card && !sc.pending && free.includes(id)) {
          const ticket = rollScratch(card);
          const rest = [...free];
          rest.splice(rest.indexOf(id), 1);
          set({ scratch: { ...sc, day, bought, free: rest, pending: ticket } });
          return ticket;
        }
        if (!card || sc.pending || s.coins < card.cost || (bought[id] ?? 0) >= card.perDay) return null;
        const ticket = rollScratch(card);
        set({ coins: s.coins - card.cost, scratch: { ...sc, day, bought: { ...bought, [id]: (bought[id] ?? 0) + 1 }, pending: ticket } });
        return ticket;
      },
      claw: undefined,
      freePacks: 0,
      shownPlush: null,
      doodle: {},
      rewardDoodleGuess: (id, coins) => {
        const s = get();
        const d = s.doodle ?? {};
        if (d[`g:${id}`] !== undefined || coins <= 0) return 0;
        set({ coins: s.coins + coins, doodle: pruneDoodle({ ...d, [`g:${id}`]: coins }) });
        return coins;
      },
      rewardDoodleArt: (id, solvers, each) => {
        const s = get();
        const d = s.doodle ?? {};
        const fresh = solvers - (d[`a:${id}`] ?? 0);
        if (fresh <= 0) return 0;
        set({ coins: s.coins + fresh * each, doodle: pruneDoodle({ ...d, [`a:${id}`]: solvers }) });
        return fresh * each;
      },
      setShownPlush: (shownPlush) => set({ shownPlush }),
      clawDay: (day, box) => {
        const c = get().claw;
        if (c?.day === day) return;
        set({ claw: { credits: 0, meter: 0, plush: {}, wins: 0, ...c, day, tries: 0, box } });
      },
      buyClaw: (bundle) => {
        const s = get();
        const c = s.claw;
        if (!c) return false;
        const n = bundle ? CLAW_T.bundle.tries : 1;
        const cost = bundle ? CLAW_T.bundle.cost : CLAW_T.cost;
        if ((s.chips ?? 0) < cost || c.tries + c.credits + n > CLAW_T.dailyTries) return false;
        set({ chips: s.chips - cost, claw: { ...c, credits: c.credits + n } });
        return true;
      },
      startClaw: () => {
        const c = get().claw;
        if (!c || c.credits <= 0) return false;
        set({ claw: { ...c, credits: c.credits - 1, tries: c.tries + 1 } });
        return true;
      },
      endClaw: (box, prize, cardId) => {
        const s = get();
        const c = s.claw;
        if (!c) return { duplicate: 0 };
        const claw = { ...c, box, meter: prize ? 0 : Math.min(CLAW_T.meter, c.meter + 1), wins: c.wins + (prize ? 1 : 0) };
        if (!prize) {
          set({ claw });
          return { duplicate: 0 };
        }
        const [kind, ...rest] = prize.split(':');
        const arg = rest.join(':');
        let duplicate = 0;
        const more: Partial<ProgressState> = {};
        if (kind === 'plush') {
          const had = c.plush?.[arg] ?? 0;
          if (had) duplicate = PLUSH_RARITY[PLUSH_BY_ID.get(arg)?.rarity ?? 'common'].duplicate;
          claw.plush = { ...(c.plush ?? {}), [arg]: had + 1 };
        } else if (kind === 'coins') more.coins = s.coins + Number(arg);
        else if (kind === 'tokens') more.chips = (s.chips ?? 0) + Number(arg);
        else if (kind === 'pack') more.freePacks = (s.freePacks ?? 0) + 1;
        else if (kind === 'scratch') {
          const sc = s.scratch ?? { day: '', bought: {}, pending: null, best: 0 };
          more.scratch = { ...sc, free: [...(sc.free ?? []), 'chest'] };
        } else if (kind === 'capsule' && cardId) {
          more.cards = { ...s.cards, [cardId]: (s.cards[cardId] ?? 0) + 1 };
          more.pulledAt = stamp(s.pulledAt, [cardId]);
        } else if (kind === 'cosmetic') {
          const owned = s.cosmetics ?? [];
          if (owned.includes(arg)) duplicate = 500;
          else more.cosmetics = [...owned, arg];
        }
        if (duplicate) more.coins = (more.coins ?? s.coins) + duplicate;
        set({ ...more, claw });
        return { duplicate };
      },
      useFreePack: () => {
        const n = get().freePacks ?? 0;
        if (n <= 0) return false;
        set({ freePacks: n - 1 });
        return true;
      },
      claimScratch: () => {
        const s = get();
        const sc = s.scratch;
        if (!sc?.pending) return null;
        const won = sc.pending.prize;
        set({ coins: s.coins + won, scratch: { ...sc, pending: null, best: Math.max(sc.best ?? 0, won) } });
        return won;
      },
      buyShopCard: (id, price) => {
        const s = get();
        const day = todayKey();
        const bought = s.cardShop?.day === day ? s.cardShop.bought : [];
        if (bought.includes(id) || (s.chips ?? 0) < price || price <= 0) return false;
        set({ chips: s.chips - price, cards: { ...s.cards, [id]: (s.cards[id] ?? 0) + 1 }, pulledAt: stamp(s.pulledAt, [id]), cardShop: { day, bought: [...bought, id] } });
        return true;
      },
      dropBalls: (n) => {
        const s = get();
        const e = econToday(s.econ);
        const balls = e.balls ?? 0;
        // Free balls first: they cost nothing, fill no meter, earn no tokens and don't count against the day's balls.
        const free = Math.min(n, Math.max(0, s.freeBalls ?? 0));
        const paid = n - free;
        const cost = PACHINKO.cost * paid;
        if (n < 1 || s.coins < cost || balls + paid > PACHINKO.dailyBalls) return null;
        const out = Array.from({ length: n }, dropBall);
        const won = out.reduce((t, b) => t + b.coins, 0);
        const meter = (s.casinoMeter ?? 0) + cost;
        const fills = Math.floor(meter / PACHINKO.meter);
        set({
          coins: s.coins - cost + won,
          econ: { ...e, balls: balls + paid, earned: e.earned + won },
          casinoMeter: meter % PACHINKO.meter,
          capsuleTokens: (s.capsuleTokens ?? 0) + fills,
          freeBalls: (s.freeBalls ?? 0) - free + fills * PACHINKO.freeBalls,
          ...paidIn(s, cost),
        });
        return out;
      },
      frames: [],
      frame: null,
      setFrame: (frame) => set({ frame }),
      cosmetics: [],
      nameStyle: null,
      wrapper: null,
      title: null,
      setNameStyle: (nameStyle) => set({ nameStyle }),
      setWrapper: (wrapper) => set({ wrapper }),
      setTitle: (title) => set({ title }),
      buyCosmetic: (id, price, inTokens = false) => {
        const s = get();
        const owned = s.cosmetics ?? [];
        const have = inTokens ? (s.chips ?? 0) : s.coins;
        if (owned.includes(id) || !(price > 0) || have < price) return false;
        const kind = id.split(':')[0];
        set({
          ...(inTokens ? { chips: have - price } : { coins: s.coins - price }),
          cosmetics: [...owned, id],
          ...(kind === 'name' ? { nameStyle: id } : kind === 'wrap' ? { wrapper: id } : kind === 'title' ? { title: id.slice('title:'.length) } : {}),
        });
        return true;
      },
      openCapsule: () => {
        const s = get();
        const free = (s.capsuleTokens ?? 0) > 0;
        if (!free && s.coins < CAPSULES.cost) return null;
        const owned = s.frames ?? [];
        const r = rollCapsule(owned);
        set({
          coins: s.coins - (free ? 0 : CAPSULES.cost) + r.coins,
          capsuleTokens: free ? s.capsuleTokens - 1 : (s.capsuleTokens ?? 0),
          frames: r.duplicate ? owned : [...owned, r.frame.id],
          ...paidIn(s, free ? 0 : CAPSULES.cost),
        });
        return { ...r, free };
      },
      spinRoulette: (times = 1) => {
        const s = get();
        const e = econToday(s.econ);
        const spins = e.spins ?? 0;
        const n = Math.max(1, Math.floor(times));
        if (s.coins < ROULETTE.cost * n || spins + n > ROULETTE.dailySpins) return null;
        const results = Array.from({ length: n }, () => {
          const chain = rouletteChain();
          const prize = chain[chain.length - 1];
          return { prize, chain, coins: roulettePay(prize) };
        });
        const won = results.reduce((t, r) => t + r.coins, 0);
        set({ coins: s.coins - ROULETTE.cost * n + won, econ: { ...e, spins: spins + n, earned: e.earned + won }, ...paidIn(s, ROULETTE.cost * n) });
        return results;
      },
      toggleFavorite: (cardId) =>
        set((s) => {
          const { [cardId]: was, ...rest } = s.favorites ?? {};
          return { favorites: was ? rest : { ...rest, [cardId]: true } };
        }),
      setAnomaly: (cardId, anomaly) =>
        set((s) => {
          const { [cardId]: _, ...rest } = s.anomalies ?? {};
          return { anomalies: anomaly ? { ...rest, [cardId]: anomaly } : rest };
        }),
      gradeUp: (id, rarity, by, element) => {
        const s = get();
        const grade = gradeOf(s.grades, id);
        if (grade + 1 === ELEMENT_GRADE && !isElement(element)) return false;
        // A card's id starts with its franchise.
        const hellBeaten = (s.bosses[bossKey(id.split(':')[0], 'hell')]?.wins ?? 0) > 0;
        if (!canGradeUp(s.cards[id] ?? 0, grade, hellBeaten)) return false;
        // A grade pays once, even if the card was traded away and graded again.
        const paid = s.gradesPaid?.[id] ?? 1;
        const coins = grade + 1 > paid ? gradeReward(rarity, grade + 1) : 0;
        set({
          cards: { ...s.cards, [id]: s.cards[id] - GRADE_COST },
          grades: { ...s.grades, [id]: grade + 1 },
          gradesPaid: { ...s.gradesPaid, [id]: Math.max(paid, grade + 1) },
          ...(grade + 1 === HELL_GRADE ? { engraved: { ...s.engraved, [id]: { by, date: todayKey() } } } : {}),
          ...(grade + 1 === ELEMENT_GRADE && element ? { elements: { ...s.elements, [id]: element } } : {}),
          ...(coins ? earn(s, coins) : {}),
        });
        return true;
      },
      switchElement: (id, element) => {
        const s = get();
        if (gradeOf(s.grades, id) < ELEMENT_GRADE || !isElement(element) || s.elements?.[id] === element || s.coins < ELEMENT_SWITCH_COST) return false;
        set({ coins: s.coins - ELEMENT_SWITCH_COST, elements: { ...s.elements, [id]: element } });
        return true;
      },
      upgradeCard: (id) => {
        const s = get();
        const up = UPGRADES[id];
        const copies = s.cards[id] ?? 0;
        if (!up || !copies || s.coins < up.coins) return false;
        const into = up.into;
        const cards = { ...s.cards, [into]: (s.cards[into] ?? 0) + copies };
        delete cards[id];
        const grades = { ...s.grades };
        const gradesPaid = { ...s.gradesPaid };
        const elements = { ...s.elements };
        const anomalies = { ...s.anomalies };
        const favorites = { ...s.favorites };
        // The better grade of the two stays, and is never paid again.
        if (grades[id]) grades[into] = Math.max(grades[into] ?? 1, grades[id]);
        if (gradesPaid[id]) gradesPaid[into] = Math.max(gradesPaid[into] ?? 1, gradesPaid[id]);
        if (elements[id] && !elements[into]) elements[into] = elements[id];
        if (anomalies[id] && !anomalies[into]) anomalies[into] = anomalies[id];
        if (favorites[id]) favorites[into] = true;
        for (const x of [grades, gradesPaid, elements, anomalies, favorites]) delete x[id];
        set({
          coins: s.coins - up.coins,
          cards,
          grades,
          gradesPaid,
          elements,
          anomalies,
          favorites,
          pulledAt: stamp(s.pulledAt, [into]),
          avatar: s.avatar === id ? into : s.avatar,
          backdrop: s.backdrop === id ? into : s.backdrop,
        });
        return true;
      },
      foldRetiredCards: () => {
        const s = get();
        const cards = { ...s.cards };
        const grades = { ...s.grades };
        const gradesPaid = { ...s.gradesPaid };
        const elements = { ...s.elements };
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
          if (elements[id] && !elements[r.into]) elements[r.into] = elements[id];
          delete grades[id];
          delete gradesPaid[id];
          delete elements[id];
          if (avatar === id) avatar = r.into;
          if (backdrop === id) backdrop = r.into;
          coins += copies * r.coins;
          folded.push({ name: r.name, intoName: r.intoName, copies });
        }
        if (folded.length) set({ cards, grades, gradesPaid, elements, avatar, backdrop, ...(coins ? earn(s, coins) : {}) });
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
      openPack: (cost, cardIds, packs = 1, pity, golden) => {
        if (get().coins < cost) return false;
        set((s) => {
          const cards = { ...s.cards };
          for (const id of cardIds) cards[id] = (cards[id] ?? 0) + 1;
          return { coins: s.coins - cost, cards, pulledAt: stamp(s.pulledAt, cardIds), packsOpened: (s.packsOpened ?? 0) + packs, missionBooks: countLong(s.missionBooks, { packs }), ...(pity !== undefined ? { pity: clampPity(pity) } : {}), ...(golden !== undefined ? { golden: clampGolden(golden) } : {}) };
        });
        return true;
      },
      exchangeCards: (copies, coins) =>
        set((s) => {
          const cards = { ...s.cards };
          for (const [id, n] of Object.entries(copies)) cards[id] = Math.max(1, (cards[id] ?? 0) - n);
          return { cards, coins: (s.coins ?? 0) + coins };
        }),
      buyStallCard: (id, price) => {
        const s = get();
        if (price <= 0 || s.coins < price) return false;
        set({ coins: s.coins - price, cards: { ...s.cards, [id]: (s.cards[id] ?? 0) + 1 }, pulledAt: stamp(s.pulledAt, [id]) });
        return true;
      },
      moveCards: (delta) =>
        set((s) => {
          const cards = { ...s.cards };
          for (const [id, n] of Object.entries(delta)) {
            const left = (cards[id] ?? 0) + n;
            if (left > 0) cards[id] = left;
            else delete cards[id];
          }
          const got = Object.entries(delta).filter(([, n]) => n > 0).map(([id]) => id);
          // A card traded away for good takes its grade with it.
          const grades = { ...(s.grades ?? {}) };
          for (const id of Object.keys(grades)) if (!cards[id]) delete grades[id];
          return { cards, grades, ...(got.length ? { pulledAt: stamp(s.pulledAt, got) } : {}) };
        }),
      earnExpedition: (amount) => {
        const s = get();
        const done = econToday(s.econ).expedition ?? 0;
        const left = Math.max(0, EXPEDITION_CAP - done);
        const paid = amount <= left ? amount : Math.max(1, left + Math.round((amount - left) * EXPEDITION_AFTER_CAP));
        const earned = earn(s, paid);
        set({ ...earned, econ: { ...earned.econ!, expedition: done + paid } });
        return paid;
      },
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
        const gift = giftFor(code);
        if (!gift) return { ok: false, reason: 'unknown' };
        // A one-day code works on its day only.
        if (gift.only && gift.only !== todayKey()) return { ok: false, reason: 'expired' };
        const s = get();
        // A daily code is kept with the day it was redeemed: it works again tomorrow.
        const mark = gift.daily ? `${code}@${todayKey()}` : code;
        if ((s.redeemed ?? []).includes(mark)) return { ok: false, reason: 'used' };
        set({ coins: (s.coins ?? 0) + gift.coins, redeemed: [...(s.redeemed ?? []).filter((r) => !r.startsWith(`${code}@`)), mark] });
        return { ok: true, coins: gift.coins, note: gift.note };
      },
      claimQuest: (tier) => {
        const s = get();
        const e = econToday(s.econ);
        const book = questsNow(s.quests, e.date);
        const slot = book.slots[tier];
        const q = questAt(e.date, tier, slot.n);
        const counter = (k: QuestCounter) => e.counters[k] ?? 0;
        if (counter(q.kind) - slot.start < q.need) return false;
        const coins = questReward(q, book.done[tier]);
        const next = questAt(e.date, tier, slot.n + 1);
        set({
          coins: (s.coins ?? 0) + coins,
          econ: { ...e, earned: e.earned + coins },
          quests: { ...book, slots: { ...book.slots, [tier]: { n: slot.n + 1, start: counter(next.kind) } }, done: { ...book.done, [tier]: book.done[tier] + 1 } },
        });
        return coins;
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
      jlptReview: {},
      addJlptReview: (ids) => set((s) => ({ jlptReview: { ...s.jlptReview, ...Object.fromEntries(ids.map((id) => [id, 0])) } })),
      removeJlptReview: (id) =>
        set((s) => {
          const { [id]: _, ...rest } = s.jlptReview;
          // A word of the player's own taken off the list goes with it.
          if (!isCustomId(id)) return { jlptReview: rest };
          const { [id]: __, ...words } = s.jlptCustom;
          return { jlptReview: rest, jlptCustom: words };
        }),
      jlptCustom: {},
      addJlptCustom: (w) => {
        const id = newCustomId();
        set((s) => ({ jlptCustom: { ...s.jlptCustom, [id]: { ...w, at: Date.now() } }, jlptReview: { ...s.jlptReview, [id]: 0 } }));
        return id;
      },
      reviewJlpt: (id, right) =>
        set((s) => {
          if (!(id in s.jlptReview)) return {};
          const n = right ? s.jlptReview[id] + 1 : 0;
          if (n < JLPT_LEARNED) return { jlptReview: { ...s.jlptReview, [id]: n } };
          const { [id]: _, ...rest } = s.jlptReview;
          return { jlptReview: rest };
        }),
      jlptGrammarReview: {},
      addJlptGrammarReview: (keys) => set((s) => ({ jlptGrammarReview: { ...s.jlptGrammarReview, ...Object.fromEntries(keys.filter((k) => !(k in s.jlptGrammarReview)).map((k) => [k, 0])) } })),
      removeJlptGrammarReview: (key) =>
        set((s) => {
          const { [key]: _, ...rest } = s.jlptGrammarReview;
          return { jlptGrammarReview: rest };
        }),
      reviewJlptGrammar: (key, right) =>
        set((s) => {
          if (!(key in s.jlptGrammarReview)) return {};
          const n = right ? s.jlptGrammarReview[key] + 1 : 0;
          if (n < JLPT_LEARNED) return { jlptGrammarReview: { ...s.jlptGrammarReview, [key]: n } };
          const { [key]: _, ...rest } = s.jlptGrammarReview;
          return { jlptGrammarReview: rest };
        }),
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
          // Coins for the round, and a bonus once all ten are played: today's, by its score (and more once all
          // four of today's are done); a past day's (the Archive), a small one.
          const won = record.status === 'won';
          const complete = summarizeDay(day).finished >= ROUNDS_PER_DAY && summarizeDay(s.days[key]).finished < ROUNDS_PER_DAY;
          let bonus = 0;
          if (complete && date === todayKey()) {
            bonus = dailyCompleteCoins(summarizeDay(day).score);
            const days = update.days;
            if (DAILY_DOMAINS.every((d) => summarizeDay(days[dayKey(d, date)]).complete)) bonus += DAILY_COMPLETE.allFour;
          } else if (complete) bonus = CATEGORY_BONUS;
          return { ...update, ...earn(s, roundCoins(won, record.score) + bonus, { count: { rounds: won ? 1 : 0, category: complete ? 1 : 0 } }) };
        }),
      saveSpecs: (domain, date, specs) => set((s) => ({ specs: { ...s.specs, [dayKey(domain, date)]: specs } })),
      recordFreePlay: (record) =>
        set((s) => ({
          ...earn(s, arcadeCoins({ won: record.status === 'won' }), { arcade: 'freeplay', count: { freeplay: record.status === 'won' ? 1 : 0 } }),
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
          const hot = payHot(s.hotGame, todayKey(), key, arcadeCoins(result) + bonus);
          // The games to learn with pay, but don't count for the missions or the quests.
          const paid = earn(s, hot.amount, { arcade: key, ...(isLearnKey(key) ? {} : { count: { arcade: 1 } }) });
          // A game too soon after the last pays nothing, and doesn't count for the Hot Game either.
          return { bests, ...paid, ...(paid.coins !== undefined ? { hotGame: hot.book } : {}) };
        }),
      payCleared: (key, answers, seconds) => {
        const s = get();
        const e = econToday(s.econ);
        const full = clearReward(answers, seconds);
        if (full <= 0) return 0;
        // Again today: only a token.
        const again = !!e.cleared?.includes(key);
        const amount = again ? clearRepeatReward(full) : full;
        const paid = earn(s, amount);
        set({ ...paid, econ: { ...paid.econ!, cleared: again ? (e.cleared ?? []) : [...(e.cleared ?? []), key] } });
        return amount;
      },
      recordWhosThat: (key, score, result) =>
        set((s) => {
          const bonus = bestCounts(result) && score > 0 && score > (s.whosThat[key] ?? 0) ? ARCADE_BEST_BONUS : 0;
          const hot = payHot(s.hotGame, todayKey(), `whos:${key}`, arcadeCoins(result) + bonus);
          const paid = earn(s, hot.amount, { arcade: `whos:${key}`, count: { whos: 1 } });
          return {
            whosThat: { ...s.whosThat, [key]: Math.max(s.whosThat[key] ?? 0, score) },
            ...paid,
            ...(paid.coins !== undefined ? { hotGame: hot.book } : {}),
          };
        }),
      setSpecialRound: (key, index, record) =>
        set((s) => {
          const update = { special: { ...s.special, [key]: { ...s.special[key], [index]: record } } };
          if (!justFinished(s.special[key]?.[index], record)) return update;
          const won = record.status === 'won';
          return { ...update, ...earn(s, roundCoins(won, record.score), { count: { special: won ? 1 : 0 } }) };
        }),
      recordBoss: (key, { won, score, time }) => {
        let pay: BossPay = { total: 0, lines: [] };
        set((s) => {
          const r = s.bosses[key] ?? EMPTY_BOSS_RECORD;
          // Every fight pays: a win by difficulty (plus the week's first win over this boss at this difficulty), a loss a token.
          const difficulty = (key.split(':')[1] ?? 'easy') as BossDifficulty;
          const week = bossWeekNow(s.bossWeek);
          // A win at a difficulty validates every one below it: each one never beaten counts as beaten now and pays
          // its own win (what it unlocks, a franchise pack, an awakening, comes with it), and each pays its first win
          // of the week if not yet taken. A difficulty beaten before pays no win again.
          const id = key.split(':')[0];
          const below = won ? DIFFICULTY_ORDER.slice(0, DIFFICULTY_ORDER.indexOf(difficulty)) : [];
          const fresh = below.filter((d) => (s.bosses[bossKey(id, d)]?.wins ?? 0) === 0);
          const weeklyKeys = won ? [...below.map((d) => bossKey(id, d)), key].filter((k) => !week.keys.includes(k)) : [];
          const weeklyOf = (d: BossDifficulty) => (weeklyKeys.includes(bossKey(id, d)) ? BOSS_WEEKLY[d] : 0);
          const lines: BossPay['lines'] = won
            ? [
                ...below.map((d) => ({ difficulty: d, win: fresh.includes(d) ? BOSS_WIN[d] : 0, weekly: weeklyOf(d) })).filter((l) => l.win + l.weekly > 0),
                { difficulty, win: BOSS_WIN[difficulty], weekly: weeklyOf(difficulty) },
              ]
            : [{ difficulty, win: BOSS_LOSS, weekly: 0, loss: true }];
          const total = lines.reduce((n, l) => n + l.win + l.weekly, 0);
          pay = { total, lines };
          const coins = earn(s, total, { count: { boss: won ? 1 : 0 } });
          const lower = Object.fromEntries(
            fresh.map((d) => {
              const k = bossKey(id, d);
              const x = s.bosses[k] ?? EMPTY_BOSS_RECORD;
              return [k, { ...x, plays: x.plays + 1, wins: x.wins + 1 }];
            }),
          );
          return {
            ...coins,
            bossWeek: weeklyKeys.length ? { ...week, keys: [...week.keys, ...weeklyKeys] } : week,
            bosses: {
              ...s.bosses,
              ...lower,
              [key]: {
                plays: r.plays + 1,
                wins: r.wins + (won ? 1 : 0),
                bestScore: Math.max(r.bestScore, score),
                bestTime: won ? Math.min(r.bestTime ?? Infinity, time) : r.bestTime,
              },
            },
          };
        });
        return pay;
      },
      toggleSound: () => set((s) => ({ sound: !s.sound })),
      setVolume: (kind, value) => set({ [kind]: Math.max(0, Math.min(kind === 'sfxVolume' ? 200 : 100, Math.round(value))) }),
      cycleTheme: () => set((s) => ({ theme: s.theme === 'system' ? 'light' : s.theme === 'light' ? 'dark' : 'system' })),
      resetAll: () =>
        set({ days: {}, specs: {}, freePlay: { played: 0, won: 0, points: 0 }, bosses: {}, whosThat: {}, bests: {}, rogueRun: null, special: {}, seen: {}, coins: 0, cards: {}, econ: freshEconomy(todayKey()), bossWeek: { week: weekOf(todayKey()), keys: [] }, packsOpened: 0, missionBooks: booksNow(undefined), avatar: null, backdrop: null, pulledAt: {}, frames: [], frame: null, cosmetics: [], nameStyle: null, wrapper: null, title: null, casinoMeter: 0, capsuleTokens: 0, freeBalls: 0, chips: 0, chipCoins: 0, cardShop: { day: '', bought: [] }, scratch: { day: '', bought: {}, pending: null, best: 0 }, claw: undefined, freePacks: 0, shownPlush: null, doodle: {}, quests: undefined }),
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

// The player's own JLPT words, known to the JLPT data as they are now and whenever they change.
setCustomWords(useProgress.getState().jlptCustom);

// ── The trade lock (tradeLock above) ─────────────────────────────────────
export interface TradeLock {
  cards: Record<string, number>;
  coins: number;
}
const flagOf = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
/** An account is signed in on this device (src/cloud/state.ts SIGNED_IN_FLAG, kept here so the store stays light). */
const accountHere = () => flagOf('omnidle:cloud') === '1';
/** Copies of a card the player can trade: those not earned before their account was linked. */
export const tradableCopies = (s: Pick<ProgressState, 'cards' | 'tradeLock'>, id: string) => Math.max(0, (s.cards[id] ?? 0) - (s.tradeLock?.cards[id] ?? 0));
/** DleCoins the player can trade. */
export const tradableCoins = (s: Pick<ProgressState, 'coins' | 'tradeLock'>) => Math.max(0, (s.coins ?? 0) - (s.tradeLock?.coins ?? 0));
/** How many copies and coins are locked (only what the player still has). */
export function lockedCount(s: Pick<ProgressState, 'cards' | 'coins' | 'tradeLock'>) {
  let cards = 0;
  for (const [id, n] of Object.entries(s.tradeLock?.cards ?? {})) cards += Math.min(n, s.cards[id] ?? 0);
  return { cards, coins: Math.min(s.tradeLock?.coins ?? 0, s.coins ?? 0) };
}
// First time: a save that never had an account on this device is locked whole; one that did starts free.
if (!useProgress.getState().tradeLock) {
  const s = useProgress.getState();
  const linked = accountHere() || !!flagOf('omnidle:cloud:linked');
  useProgress.setState({ tradeLock: linked ? { cards: {}, coins: 0 } : { cards: { ...s.cards }, coins: s.coins ?? 0 } });
}
// Then: what comes in with no account signed in is locked; what goes out leaves the lock no bigger than what's left.
useProgress.subscribe((s, before) => {
  if (s.cards === before.cards && s.coins === before.coins) return;
  const lock = s.tradeLock ?? { cards: {}, coins: 0 };
  const away = !accountHere();
  const cards = { ...lock.cards };
  let changed = false;
  for (const id of new Set([...Object.keys(s.cards), ...Object.keys(before.cards), ...Object.keys(cards)])) {
    const now = s.cards[id] ?? 0;
    const was = before.cards[id] ?? 0;
    let n = cards[id] ?? 0;
    if (away && now > was) n += now - was;
    n = Math.min(n, now);
    if (n !== (cards[id] ?? 0)) {
      changed = true;
      if (n > 0) cards[id] = n;
      else delete cards[id];
    }
  }
  let coins = lock.coins;
  if (away && s.coins > before.coins) coins += s.coins - before.coins;
  coins = Math.max(0, Math.min(coins, s.coins ?? 0));
  if (coins !== lock.coins) changed = true;
  if (changed) useProgress.setState({ tradeLock: { cards, coins } });
});
useProgress.subscribe((s, before) => s.jlptCustom !== before.jlptCustom && setCustomWords(s.jlptCustom));

/** The four category dailies (as in src/data DOMAINS, kept here so the store stays light). */
export const DAILY_DOMAINS: Domain[] = ['games', 'anime', 'cinema', 'music'];

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
