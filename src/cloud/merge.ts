// What a cloud save holds, and how two saves (this device's and the account's) become one.
// Nothing played is ever lost: days and rounds, bosses and bests are combined, keeping the better of
// each. What can go down as well as up — the coin balance, the cards, the Expedition run — follows
// the save changed last. The first time a device joins an account that already has a save, the account's
// coins, cards and everything bought or won with them stay as they are: the device's aren't added (they
// could have been farmed without an account, or copied in from another account). A brand-new account
// takes the device's save whole.
import { clampGolden, clampPity } from '../gacha/economy';
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
  'hotGame',
  'quests',
  'pity',
  'golden',
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
  'engraved',
  'elements',
  'missionBooks',
  'redeemed',
  'favorites',
  'pulledAt',
  'groups',
  'jlptReview',
  'jlptCustom',
  'jlptGrammarReview',
  'frames',
  'frame',
  'cosmetics',
  'nameStyle',
  'wrapper',
  'title',
  'casinoMeter',
  'capsuleTokens',
  'freeBalls',
  'chips',
  'chipCoins',
  'cardShop',
  'scratch',
  'claw',
  'freePacks',
  'rouletteStreak',
  'omniPity',
  'shownPlush',
  'doodle',
  'tradeLock',
  'cardVolume',
] as const;
export type SaveData = Pick<Progress, (typeof SYNCED)[number]>;

/** The keys kept month by month, in their own documents (they grow every day). */
export const BY_MONTH = ['days', 'special', 'specs'] as const;
/** "games:2026-10-18", "rank-lol:2026-10-18" → "2026-10". */
export const monthOf = (key: string) => key.slice(-10, -3);

/** Two counts by key: the larger of each. */
const mergeMax = (a: Record<string, number> | undefined, b: Record<string, number> | undefined) => {
  const out = { ...(a ?? {}) };
  for (const [k, v] of Object.entries(b ?? {})) out[k] = Math.max(out[k] ?? 0, v);
  return out;
};

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
    expedition: Math.max(a.expedition ?? 0, b.expedition ?? 0),
    spins: Math.max(a.spins ?? 0, b.spins ?? 0),
    slots: Math.max(a.slots ?? 0, b.slots ?? 0),
    balls: Math.max(a.balls ?? 0, b.balls ?? 0),
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
function laterHot(a: SaveData['hotGame'], b: SaveData['hotGame']): SaveData['hotGame'] {
  if (!a || !b) return a ?? b;
  if (a.date !== b.date) return a.date > b.date ? a : b;
  return a.moves * 100 + a.played >= b.moves * 100 + b.played ? a : b;
}

function laterQuests(a: SaveData['quests'], b: SaveData['quests']): SaveData['quests'] {
  if (!a || !b) return a ?? b;
  if (a.date !== b.date) return a.date > b.date ? a : b;
  const sum = (q: NonNullable<SaveData['quests']>) => q.done.easy + q.done.medium + q.done.hard;
  return sum(a) >= sum(b) ? a : b;
}

export function mergeSaves(local: SaveData, cloud: SaveData | null, { firstLink, cloudNewer }: { firstLink: boolean; cloudNewer: boolean }): SaveData {
  if (!cloud) return local;
  // Joining an account (firstLink): the account's save is the one that counts for all that can be spent.
  const latest = firstLink || cloudNewer ? cloud : local;
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
    // The latest save's cards (the account's on a first link: cards also go — traded, exchanged for coins —
    // so the higher count isn't the true one), and their grades with them.
    cards: latest.cards ?? {},
    grades: latest.grades ?? {},
    // A grade paid on either side stays paid (never twice).
    gradesPaid: maxBy(local.gradesPaid, cloud.gradesPaid),
    engraved: { ...cloud.engraved, ...local.engraved },
    // Elements go with the grades (and can be changed): the latest save's.
    elements: latest.elements ?? {},
    econ: mergeEcon(local.econ, cloud.econ)!,
    missionBooks: {
      week: mergeBook(local.missionBooks?.week, cloud.missionBooks?.week)!,
      month: mergeBook(local.missionBooks?.month, cloud.missionBooks?.month)!,
    },
    // A code redeemed on either side stays redeemed.
    redeemed: [...new Set([...(local.redeemed ?? []), ...(cloud.redeemed ?? [])])],
    // Starred cards: both sides' on a first link; then the latest (a star taken off stays off).
    favorites: firstLink ? { ...(cloud.favorites ?? {}), ...(local.favorites ?? {}) } : (latest.favorites ?? local.favorites ?? {}),
    // When each card was last pulled: the later of the two.
    pulledAt: maxBy(local.pulledAt, cloud.pulledAt),
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
    coins: latest.coins ?? 0,
    // The luck and the golden pack's counter of the latest save.
    pity: clampPity(latest.pity),
    golden: clampGolden(latest.golden),
    // The same day: the further along of the two. Otherwise the later day's.
    hotGame: laterHot(local.hotGame, cloud.hotGame),
    // Today's quests: the book further on (more claimed), else the latest save's.
    quests: laterQuests(local.quests, cloud.quests),
    packsOpened: firstLink ? (cloud.packsOpened ?? 0) : Math.max(local.packsOpened ?? 0, cloud.packsOpened ?? 0),
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
    // The JLPT review list: both lists on a first link; then the latest (words learned leave it).
    jlptReview: firstLink ? { ...(cloud.jlptReview ?? {}), ...(local.jlptReview ?? {}) } : (latest.jlptReview ?? local.jlptReview ?? {}),
    // The player's own words: every one either side has (a word is never changed, only added or taken off).
    jlptGrammarReview: firstLink ? { ...(cloud.jlptGrammarReview ?? {}), ...(local.jlptGrammarReview ?? {}) } : (latest.jlptGrammarReview ?? local.jlptGrammarReview ?? {}),
    jlptCustom: firstLink ? { ...(cloud.jlptCustom ?? {}), ...(local.jlptCustom ?? {}) } : (latest.jlptCustom ?? local.jlptCustom ?? {}),
    // Icon frames won on either side stay won; the one worn, the meter and free capsules: the latest save's.
    // (On a first link, the account's: they're bought or won with coins.)
    frames: firstLink ? (cloud.frames ?? []) : [...new Set([...(local.frames ?? []), ...(cloud.frames ?? [])])],
    frame: latest.frame ?? null,
    // Cosmetics bought on either side stay bought; the ones in use, and the title: the latest save's.
    cosmetics: firstLink ? (cloud.cosmetics ?? []) : [...new Set([...(local.cosmetics ?? []), ...(cloud.cosmetics ?? [])])],
    nameStyle: latest.nameStyle ?? null,
    wrapper: latest.wrapper ?? null,
    title: latest.title ?? null,
    casinoMeter: latest.casinoMeter ?? 0,
    capsuleTokens: latest.capsuleTokens ?? 0,
    freeBalls: latest.freeBalls ?? 0,
    // Casino tokens and the day's shop purchases: the latest save's.
    chips: latest.chips ?? 0,
    chipCoins: latest.chipCoins ?? 0,
    cardShop: latest.cardShop ?? { day: '', bought: [] },
    // Scratch cards: the latest save's day and card being scratched; the best win either side has.
    scratch: { ...(latest.scratch ?? { day: '', bought: {}, pending: null }), best: Math.max(local.scratch?.best ?? 0, cloud.scratch?.best ?? 0) },
    // The claw: the latest save's day, tries and box; the plushies won either side, each at the most won.
    claw: firstLink ? cloud.claw : latest.claw ? { ...latest.claw, plush: mergeMax(local.claw?.plush, cloud.claw?.plush), wins: Math.max(local.claw?.wins ?? 0, cloud.claw?.wins ?? 0) } : (local.claw ?? cloud.claw),
    freePacks: latest.freePacks ?? 0,
    rouletteStreak: latest.rouletteStreak ?? 0,
    omniPity: latest.omniPity ?? 0,
    shownPlush: latest.shownPlush ?? null,
    // The Daily Doodle's rewards paid on either side stay paid.
    doodle: mergeMax(local.doodle, cloud.doodle),
    // What was earned without an account stays locked: the latest save's, with its cards.
    tradeLock: latest.tradeLock ?? { cards: {}, coins: 0 },
    // Each card's own volumes: as last set (with the save changed last).
    cardVolume: latest.cardVolume ?? local.cardVolume ?? {},
  };
}
