// The birthday and special-date rewards, worked out from the calendar: which ones are open today.
// Claiming them (once each, checked by the server) is src/cloud/rewards.ts; the dates and coins are
// src/data/rewards.json (firestore.rules keeps its own copy of the dates: data:validate compares them).
import REWARDS from '../data/rewards.json';
import { addDays, toKey } from './date';

export type Birthday = { month: number; day: number };
export type RewardDate = (typeof REWARDS.dates)[number];
/** A reward open today: its claim id (birthday-2026, christmas-2026...), its coins, and the date it's for. */
export type DueReward = { id: string; coins: number; date: RewardDate | null };

export const BIRTHDAY_COINS = REWARDS.birthday.coins;
export const REWARD_DATES: RewardDate[] = REWARDS.dates;
export const REWARD_WINDOW_DAYS = REWARDS.windowDays;

/** Days in a month (February: 29, so a 29 February birthday can be picked). */
export const daysIn = (month: number) => [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 31;

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const key = (y: number, month: number, day: number) => toKey(new Date(y, month - 1, day));

/** This year's birthday as a date key (a 29 February one falls on the 28th in other years). */
export const birthdayKey = (b: Birthday, year: number) => key(year, b.month, b.month === 2 && b.day === 29 && !isLeap(year) ? 28 : b.day);

/**
 * The rewards open on `today` (a date key): the birthday once it has come this year (until the year
 * ends), and each special date from its day for REWARD_WINDOW_DAYS days (Christmas runs into January).
 */
export function dueRewards(birthday: Birthday | null, today: string): DueReward[] {
  const year = Number(today.slice(0, 4));
  const out: DueReward[] = [];
  if (birthday && today >= birthdayKey(birthday, year)) out.push({ id: `birthday-${year}`, coins: BIRTHDAY_COINS, date: null });
  for (const d of REWARD_DATES) {
    for (const y of [year - 1, year]) {
      const start = key(y, d.month, d.day);
      if (today >= start && today < addDays(start, REWARD_WINDOW_DAYS)) out.push({ id: `${d.id}-${y}`, coins: d.coins, date: d });
    }
  }
  return out;
}
