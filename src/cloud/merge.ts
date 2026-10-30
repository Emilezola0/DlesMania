// What a cloud save holds, and how two saves (this device's and the account's) become one.
// Nothing played is ever lost: days and rounds, bosses and bests are combined, keeping the better of
// each. What can go down as well as up — the coin balance, the cards, the Expedition run — follows
// the save changed last; except the first time a device joins an account, when its coins and cards
// are added to the account's (they were earned apart).
import { clampPity } from '../gacha/economy';
import type { Economy, PeriodBook } from '../gacha/economy';
import type { useProgress } from '../store/progress';
import type { RoundRecord, RoundSpec } from '../types';

type Progress = ReturnType<typeof useProgress.getState>;

/** The synced part of the progress (sound, volumes, theme and recency lists stay per device). */
export const SYNCED = [
  'days',
  'specs',
  'special',
  'freePlay',
  'bosses',
  'bossDifficulty',
  'whosThat',
  'bests',
  'rogueRun',
  'coins',
  'cards',
  'econ',
  'bossWeek',
  'packsOpened',
  'pity',
  'nameLang',
  'avatar',
  'backdrop',
  'cardReactions',
  'omniAura',
  'voiceLines',
  'cardMotion',
  'uiTheme',
  'companions',
  'grades',
  'gradesPaid',
  'missionBooks',
  'redeemed',
  'groups',
] as const;
export type SaveData = Pick<Progress, (typeof SYNCED)[number]>;

/** The keys kept month by month, in their own documents (they grow every day). */
export const BY_MONTH = ['days', 'special', 'specs'] as const;
/** "games:2026-10-18", "rank-lol:2026-10-18" → "2026-10". */
export const monthOf = (key: string) => key.slice(-10, -3);

export const pickSave = (s: Progress): SaveData => Object.fromEntries(SYNCED.map((k) => [k, s[k]])) as SaveData;

type DayRounds = Record<number, RoundRecord>;

/** A round finished beats one still being played; between two finished ones, the one played further. */
function betterRound(a: RoundRecord | undefined, b: RoundRecord | undefined): RoundRecord | undefined {
  if (!a) return b;
  if (!b) return a;
  const done = (r: RoundRecord) => r.status !== 'playing';
  if (done(a) !== done(b)) return done(a) ? a : b;
  return (b.guesses?.length ?? 0) > (a.guesses?.length ?? 0) ? b : a;
}

function mergeDays(a: Record<string, DayRounds> = {}, b: Record<string, DayRounds> = {}): Record<string, DayRounds> {
  const out: Record<string, DayRounds> = { ...a };
  for (const [key, rounds] of Object.entries(b)) {
    const mine = out[key] ?? {};
    const merged: DayRounds = { ...mine };
    for (const [i, r] of Object.entries(rounds)) merged[Number(i)] = betterRound(mine[Number(i)], r)!;
    out[key] = merged;
  }
  return out;
}

const finishedIn = (rounds: DayRounds | undefined) => Object.values(rounds ?? {}).filter((r) => r.status !== 'playing').length;

/** A day's rounds as first drawn: the side that played that day further keeps its draw (the guesses refer to it). */
function mergeSpecs(local: SaveData, cloud: SaveData): Record<string, RoundSpec[]> {
  const out: Record<string, RoundSpec[]> = { ...(cloud.specs ?? {}) };
  for (const [key, spec] of Object.entries(local.specs ?? {})) {
    if (!out[key] || finishedIn(local.days?.[key]) >= finishedIn(cloud.days?.[key])) out[key] = spec;
  }
  return out;
}

const maxBy = (a: Record<string, number> = {}, b: Record<string, number> = {}) => {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = Math.max(out[k] ?? 0, v);
  return out;
};

const sumBy = (a: Record<string, number> = {}, b: Record<string, number> = {}) => {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = (out[k] ?? 0) + v;
  return out;
};

function mergeBosses(a: SaveData['bosses'] = {}, b: SaveData['bosses'] = {}): SaveData['bosses'] {
  const out = { ...a };
  for (const [k, r] of Object.entries(b)) {
    const m = out[k];
    if (!m) {
      out[k] = r;
      continue;
    }
    const times = [m.bestTime, r.bestTime].filter((t): t is number => typeof t === 'number');
    out[k] = { plays: Math.max(m.plays, r.plays), wins: Math.max(m.wins, r.wins), bestScore: Math.max(m.bestScore, r.bestScore), bestTime: times.length ? Math.min(...times) : null };
  }
  return out;
}

/** The same day's books: the most of each, both lists combined. Different days: the later one. */
function mergeEcon(a: Economy | undefined, b: Economy | undefined): Economy | undefined {
  if (!a) return b;
  if (!b) return a;
  if (a.date !== b.date) return a.date > b.date ? a : b;
  const counters = { ...a.counters };
  for (const [k, v] of Object.entries(b.counters)) counters[k as keyof typeof counters] = Math.max(counters[k as keyof typeof counters] ?? 0, v ?? 0);
  return {
    date: a.date,
    arcade: Math.max(a.arcade, b.arcade),
    bosses: [...new Set([...a.bosses, ...b.bosses])],
    counters,
    claimed: [...new Set([...a.claimed, ...b.claimed])],
    earned: Math.max(a.earned, b.earned),
  };
}

/** A week's or month's missions: the same period, the most of each and both claims; else the later one. */
function mergeBook(a: PeriodBook | undefined, b: PeriodBook | undefined): PeriodBook | undefined {
  if (!a) return b;
  if (!b) return a;
  if (a.period !== b.period) return a.period > b.period ? a : b;
  const counters = { ...a.counters };
  for (const [k, v] of Object.entries(b.counters)) counters[k as keyof typeof counters] = Math.max(counters[k as keyof typeof counters] ?? 0, v ?? 0);
  return { period: a.period, counters, claimed: [...new Set([...a.claimed, ...b.claimed])] };
}

/**
 * One save from two. `firstLink`: this device has never synced with this account (its coins were
 * earned apart, so they add up). `cloudNewer`: the account's save changed after this device's.
 */
export function mergeSaves(local: SaveData, cloud: SaveData | null, { firstLink, cloudNewer }: { firstLink: boolean; cloudNewer: boolean }): SaveData {
  if (!cloud) return local;
  const latest = cloudNewer ? cloud : local;
  return {
    days: mergeDays(local.days, cloud.days),
    special: mergeDays(local.special, cloud.special),
    specs: mergeSpecs(local, cloud),
    freePlay: {
      played: Math.max(local.freePlay?.played ?? 0, cloud.freePlay?.played ?? 0),
      won: Math.max(local.freePlay?.won ?? 0, cloud.freePlay?.won ?? 0),
      points: Math.max(local.freePlay?.points ?? 0, cloud.freePlay?.points ?? 0),
    },
    bosses: mergeBosses(local.bosses, cloud.bosses),
    whosThat: maxBy(local.whosThat, cloud.whosThat),
    bests: maxBy(local.bests, cloud.bests),
    // Cards pulled apart add up; once in step, the latest save is the true one (cards also go — traded,
    // exchanged for coins — so the higher count isn't).
    cards: firstLink ? sumBy(local.cards, cloud.cards) : (latest.cards ?? {}),
    // Grades go with the cards: the higher of the two on a first link, then the latest save's.
    grades: firstLink ? maxBy(local.grades, cloud.grades) : (latest.grades ?? {}),
    // A grade paid on either side stays paid (never twice).
    gradesPaid: maxBy(local.gradesPaid, cloud.gradesPaid),
    econ: mergeEcon(local.econ, cloud.econ)!,
    missionBooks: {
      week: mergeBook(local.missionBooks?.week, cloud.missionBooks?.week)!,
      month: mergeBook(local.missionBooks?.month, cloud.missionBooks?.month)!,
    },
    // A code redeemed on either side stays redeemed.
    redeemed: [...new Set([...(local.redeemed ?? []), ...(cloud.redeemed ?? [])])],
    // Group codes made or joined on either side.
    groups: { ...(cloud.groups ?? {}), ...(local.groups ?? {}) },
    // The same week: every boss paid on either side stays paid. Different weeks: the later one.
    bossWeek:
      !local.bossWeek || !cloud.bossWeek
        ? (local.bossWeek ?? cloud.bossWeek)
        : local.bossWeek.week === cloud.bossWeek.week
          ? { week: local.bossWeek.week, keys: [...new Set([...local.bossWeek.keys, ...cloud.bossWeek.keys])] }
          : local.bossWeek.week > cloud.bossWeek.week
            ? local.bossWeek
            : cloud.bossWeek,
    coins: firstLink ? (local.coins ?? 0) + (cloud.coins ?? 0) : (latest.coins ?? 0),
    // The luck of the latest save (pulled apart on a first link: the lower, so it's never doubled).
    pity: clampPity(firstLink ? Math.min(local.pity ?? 0, cloud.pity ?? 0) : (cloudNewer ? cloud.pity : local.pity)),
    packsOpened: firstLink ? (local.packsOpened ?? 0) + (cloud.packsOpened ?? 0) : Math.max(local.packsOpened ?? 0, cloud.packsOpened ?? 0),
    // A run in progress: the latest one (on a first link, the account's if it has one).
    rogueRun: firstLink ? (cloud.rogueRun ?? local.rogueRun) : latest.rogueRun,
    bossDifficulty: (firstLink ? cloud : latest).bossDifficulty ?? local.bossDifficulty,
    nameLang: (firstLink ? cloud : latest).nameLang ?? local.nameLang,
    // The icon and background: the account's on a first link (when it has them), else the latest.
    avatar: (firstLink ? cloud.avatar ?? local.avatar : latest.avatar) ?? null,
    backdrop: (firstLink ? cloud.backdrop ?? local.backdrop : latest.backdrop) ?? null,
    cardReactions: (firstLink ? cloud : latest).cardReactions ?? local.cardReactions ?? true,
    omniAura: (firstLink ? cloud : latest).omniAura ?? local.omniAura ?? true,
    voiceLines: (firstLink ? cloud : latest).voiceLines ?? local.voiceLines ?? true,
    cardMotion: (firstLink ? cloud : latest).cardMotion ?? local.cardMotion ?? true,
    uiTheme: (firstLink ? cloud : latest).uiTheme ?? local.uiTheme ?? 'icon',
    companions: (firstLink ? cloud : latest).companions ?? local.companions ?? true,
  };
}
