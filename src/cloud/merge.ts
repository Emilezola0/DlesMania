// What a cloud save holds, and how two saves (this device's and the account's) become one.
// Nothing played is ever lost: days and rounds, bosses, bests and cards are combined, keeping the
// better of each. What can go down as well as up — the coin balance, the Expedition run — follows
// the save changed last; except the first time a device joins an account, when its coins are added
// to the account's (they were earned apart).
import type { Economy } from '../gacha/economy';
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
  'packsOpened',
  'nameLang',
  'avatar',
  'backdrop',
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
    // Cards pulled apart add up; once in step, the counts only grow, so the higher is the true one.
    cards: firstLink ? sumBy(local.cards, cloud.cards) : maxBy(local.cards, cloud.cards),
    econ: mergeEcon(local.econ, cloud.econ)!,
    coins: firstLink ? (local.coins ?? 0) + (cloud.coins ?? 0) : (latest.coins ?? 0),
    packsOpened: firstLink ? (local.packsOpened ?? 0) + (cloud.packsOpened ?? 0) : Math.max(local.packsOpened ?? 0, cloud.packsOpened ?? 0),
    // A run in progress: the latest one (on a first link, the account's if it has one).
    rogueRun: firstLink ? (cloud.rogueRun ?? local.rogueRun) : latest.rogueRun,
    bossDifficulty: (firstLink ? cloud : latest).bossDifficulty ?? local.bossDifficulty,
    nameLang: (firstLink ? cloud : latest).nameLang ?? local.nameLang,
    // The icon and background: the account's on a first link (when it has them), else the latest.
    avatar: (firstLink ? cloud.avatar ?? local.avatar : latest.avatar) ?? null,
    backdrop: (firstLink ? cloud.backdrop ?? local.backdrop : latest.backdrop) ?? null,
  };
}
