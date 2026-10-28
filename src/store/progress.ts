import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { RunState } from '../rogue/run';
import { addDays, todayKey } from '../lib/date';
import { ROUNDS_PER_DAY } from '../lib/rounds';
import type { Domain, RoundRecord, RoundSpec } from '../types';

type DayRounds = Record<number, RoundRecord>;

/** Lifetime results against one boss. Times are in milliseconds, for victories only. */
export interface BossRecord {
  plays: number;
  wins: number;
  bestScore: number;
  bestTime: number | null;
}

export const EMPTY_BOSS_RECORD: BossRecord = { plays: 0, wins: 0, bestScore: 0, bestTime: null };

export type BossDifficulty = 'easy' | 'medium' | 'hard';

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
  recordWhosThat: (key: string, score: number) => void;
  recordBest: (key: string, score: number) => void;
  setSpecialRound: (key: string, index: number, record: RoundRecord) => void;
  setRound: (domain: Domain, date: string, index: number, record: RoundRecord) => void;
  saveSpecs: (domain: Domain, date: string, specs: RoundSpec[]) => void;
  recordFreePlay: (record: RoundRecord) => void;
  toggleSound: () => void;
  setVolume: (kind: 'sfxVolume' | 'clipVolume', value: number) => void;
  cycleTheme: () => void;
  resetAll: () => void;
}

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
    (set) => ({
      days: {},
      specs: {},
      freePlay: { played: 0, won: 0, points: 0 },
      bosses: {},
      bossDifficulty: 'easy',
      whosThat: {},
      bests: {},
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
          return { days: { ...s.days, [key]: { ...s.days[key], [index]: record } } };
        }),
      saveSpecs: (domain, date, specs) => set((s) => ({ specs: { ...s.specs, [dayKey(domain, date)]: specs } })),
      recordFreePlay: (record) =>
        set((s) => ({
          freePlay: {
            played: s.freePlay.played + 1,
            won: s.freePlay.won + (record.status === 'won' ? 1 : 0),
            points: s.freePlay.points + record.score,
          },
        })),
      setBossDifficulty: (bossDifficulty) => set({ bossDifficulty }),
      recordBest: (key, score) => set((s) => ({ bests: { ...s.bests, [key]: Math.max(s.bests[key] ?? 0, score) } })),
      recordWhosThat: (key, score) => set((s) => ({ whosThat: { ...s.whosThat, [key]: Math.max(s.whosThat[key] ?? 0, score) } })),
      setSpecialRound: (key, index, record) => set((s) => ({ special: { ...s.special, [key]: { ...s.special[key], [index]: record } } })),
      recordBoss: (key, { won, score, time }) =>
        set((s) => {
          const r = s.bosses[key] ?? EMPTY_BOSS_RECORD;
          return {
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
      resetAll: () => set({ days: {}, specs: {}, freePlay: { played: 0, won: 0, points: 0 }, bosses: {}, whosThat: {}, bests: {}, rogueRun: null, special: {}, seen: {} }),
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
