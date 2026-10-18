import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { addDays, todayKey } from '../lib/date';
import { ROUNDS_PER_DAY } from '../lib/rounds';
import type { Domain, RoundRecord } from '../types';

type DayRounds = Record<number, RoundRecord>;

/** Storage key for one category's daily on one date, e.g. "anime:2026-10-18". */
export const dayKey = (domain: Domain, date: string) => `${domain}:${date}`;

interface ProgressState {
  /** dayKey(domain, date) -> round index -> record */
  days: Record<string, DayRounds>;
  freePlay: { played: number; won: number; points: number };
  sound: boolean;
  setRound: (domain: Domain, date: string, index: number, record: RoundRecord) => void;
  recordFreePlay: (record: RoundRecord) => void;
  toggleSound: () => void;
  resetAll: () => void;
}

export const useProgress = create<ProgressState>()(
  persist(
    (set) => ({
      days: {},
      freePlay: { played: 0, won: 0, points: 0 },
      sound: true,
      setRound: (domain, date, index, record) =>
        set((s) => {
          const key = dayKey(domain, date);
          return { days: { ...s.days, [key]: { ...s.days[key], [index]: record } } };
        }),
      recordFreePlay: (record) =>
        set((s) => ({
          freePlay: {
            played: s.freePlay.played + 1,
            won: s.freePlay.won + (record.status === 'won' ? 1 : 0),
            points: s.freePlay.points + record.score,
          },
        })),
      toggleSound: () => set((s) => ({ sound: !s.sound })),
      resetAll: () => set({ days: {}, freePlay: { played: 0, won: 0, points: 0 } }),
    }),
    {
      name: 'omnidle-progress',
      version: 2,
      // v1 had a single mixed daily keyed by date; its rounds don't map onto per-category dailies.
      migrate: (persisted, version) => {
        const s = persisted as Partial<ProgressState>;
        return (version < 2 ? { ...s, days: {}, sound: true } : s) as ProgressState;
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
