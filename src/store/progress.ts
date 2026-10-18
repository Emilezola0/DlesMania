import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { addDays, todayKey } from '../lib/date';
import { ROUNDS_PER_DAY } from '../lib/rounds';
import type { RoundRecord } from '../types';

interface ProgressState {
  /** date key -> round index -> record */
  days: Record<string, Record<number, RoundRecord>>;
  freePlay: { played: number; won: number; points: number };
  setRound: (date: string, index: number, record: RoundRecord) => void;
  recordFreePlay: (record: RoundRecord) => void;
  resetAll: () => void;
}

export const useProgress = create<ProgressState>()(
  persist(
    (set) => ({
      days: {},
      freePlay: { played: 0, won: 0, points: 0 },
      setRound: (date, index, record) =>
        set((s) => ({ days: { ...s.days, [date]: { ...s.days[date], [index]: record } } })),
      recordFreePlay: (record) =>
        set((s) => ({
          freePlay: {
            played: s.freePlay.played + 1,
            won: s.freePlay.won + (record.status === 'won' ? 1 : 0),
            points: s.freePlay.points + record.score,
          },
        })),
      resetAll: () => set({ days: {}, freePlay: { played: 0, won: 0, points: 0 } }),
    }),
    { name: 'omnidle-progress', version: 1 },
  ),
);

export interface DaySummary {
  finished: number;
  won: number;
  score: number;
  complete: boolean;
}

export function summarizeDay(rounds: Record<number, RoundRecord> | undefined): DaySummary {
  const list = Object.values(rounds ?? {});
  const done = list.filter((r) => r.status !== 'playing');
  return {
    finished: done.length,
    won: done.filter((r) => r.status === 'won').length,
    score: done.reduce((sum, r) => sum + r.score, 0),
    complete: done.length >= ROUNDS_PER_DAY,
  };
}

/** Consecutive completed days ending today (or yesterday, if today is still in progress). */
export function computeStreak(days: ProgressState['days']): { current: number; best: number } {
  const isComplete = (k: string) => summarizeDay(days[k]).complete;
  let cursor = todayKey();
  if (!isComplete(cursor)) cursor = addDays(cursor, -1);
  let current = 0;
  while (isComplete(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }

  const keys = Object.keys(days).filter(isComplete).sort();
  let best = 0;
  let run = 0;
  let prev = '';
  for (const k of keys) {
    run = prev && addDays(prev, 1) === k ? run + 1 : 1;
    best = Math.max(best, run);
    prev = k;
  }
  return { current, best: Math.max(best, current) };
}
