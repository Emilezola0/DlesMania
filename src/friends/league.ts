// The Weekly League (Friends → Weekly League): the points each player made in the dailies, day by day, added up from
// Monday to Sunday. Each day's points ride in the score log friends already share (scores/<uid>, DayEntry index
// DAILY_POINTS): no new database. Last week's best (if at least two played) is paid once (src/data/tuning/friends.json).
import type { DayEntry } from '../cloud/friends';
import T from '../data/tuning/friends.json';
import { weekOf } from '../gacha/economy';
import { addDays } from '../lib/date';
import type { Domain } from '../types';

export const LEAGUE = T.league;

/** Where a day's dailies points sit in a score log's DayEntry. */
export const DAILY_POINTS = 9;

/** The dailies' categories (src/data DOMAINS, not imported: it would bring every work along). */
const DAILY_DOMAINS: Domain[] = ['games', 'anime', 'cinema', 'music'];

/** The points a save made in a day's dailies (their own day's, not an archive day played later). */
export function dailyPoints(days: Record<string, Record<number, { score: number }>>, date: string): number {
  let n = 0;
  for (const d of DAILY_DOMAINS) for (const r of Object.values(days[`${d}:${date}`] ?? {})) n += r?.score ?? 0;
  return n;
}

/** The seven days of a week (from its Monday), up to `last`. */
export function weekDays(monday: string, last: string): string[] {
  const out: string[] = [];
  for (let k = 0; k < 7; k++) {
    const d = addDays(monday, k);
    if (d > last) break;
    out.push(d);
  }
  return out;
}

export interface LeagueRow {
  uid: string;
  /** Points each day of the week (0 for a day not played or not logged). */
  byDay: number[];
  total: number;
}

/** Everyone's week, best first. */
export function standings(players: { uid: string; log: Record<string, DayEntry> }[], monday: string, last: string): LeagueRow[] {
  const days = weekDays(monday, last);
  return players
    .map((p) => {
      const byDay = days.map((d) => p.log?.[d]?.[DAILY_POINTS] ?? 0);
      return { uid: p.uid, byDay, total: byDay.reduce((a, b) => a + b, 0) };
    })
    .sort((a, b) => b.total - a.total);
}

/** Last week's champions (several on a tie): only if at least LEAGUE.minPlayers scored. */
export function champions(rows: LeagueRow[]): string[] {
  const scored = rows.filter((r) => r.total > 0);
  if (scored.length < LEAGUE.minPlayers) return [];
  return scored.filter((r) => r.total === scored[0].total).map((r) => r.uid);
}

export const thisMonday = (today: string) => weekOf(today);
export const lastMonday = (today: string) => addDays(weekOf(today), -7);
