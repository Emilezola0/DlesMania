import { candidates, connectionsPuzzles, connectionThemes, DOMAINS, getWork } from '../data';
import { THEME_PREFIX, themesFor } from './connections';
import { GAME_TYPES } from '../games/meta';
import type { Domain, GameType, RoundSpec, Work } from '../types';
import { EPOCH, addDays, dayNumber } from './date';
import { hashString, mulberry32, pick, shuffle } from './rng';

export { ROUNDS_PER_DAY } from './date';
import { ROUNDS_PER_DAY } from './date';

/** Works with real media are more fun in these rounds, so they're drawn more often. */
const MEDIA_WEIGHT: Partial<Record<GameType, (w: Work) => boolean>> = {
  visual: (w) => !!w.cover?.image,
  item: (w) => !!w.item?.image,
  location: (w) => !!w.location?.image,
  audio: (w) => !!w.audio?.youtubeId,
};

function weightedPick(pool: Work[], type: GameType, rand: () => number): Work {
  const boosted = MEDIA_WEIGHT[type];
  if (!boosted) return pick(pool, rand);
  const weights = pool.map((w) => (boosted(w) ? 4 : 1));
  let r = rand() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r < 0) return pool[i];
  }
  return pool[pool.length - 1];
}

/** Four works from different years, the least recently used first when `lastUsed` is given. */
function timelineWorks(domain: Domain | undefined, rand: () => number, lastUsed?: Map<string, number>, only?: (w: Work) => boolean, oneBySource = false): string[] {
  const chosen: Work[] = [];
  const order = shuffle(candidates('timeline', domain).filter((w) => !only || only(w)), rand);
  if (lastUsed) order.sort((x, y) => (lastUsed.get(x.id) ?? -1) - (lastUsed.get(y.id) ?? -1));
  for (const w of order) {
    if (chosen.every((c) => c.year !== w.year && (!oneBySource || !w.studio || c.studio !== w.studio))) chosen.push(w);
    if (chosen.length === 4) break;
  }
  return chosen.map((w) => w.id);
}

/** How many songs a Blind Test plays. */
export const BLIND_TEST_SONGS = 5;

/** A Blind Test's songs: the least recently used first, each from a different game or anime. */
function blindTestWorks(domain: Domain | undefined, rand: () => number, avoid: Set<string>, lastUsed?: Map<string, number>, only?: (w: Work) => boolean): string[] {
  const order = shuffle(candidates('blindtest', domain).filter((w) => !avoid.has(w.id) && (!only || only(w))), rand);
  if (lastUsed) order.sort((x, y) => (lastUsed.get(x.id) ?? -1) - (lastUsed.get(y.id) ?? -1));
  const chosen: Work[] = [];
  for (const w of order) {
    if (chosen.every((c) => !w.studio || c.studio !== w.studio)) chosen.push(w);
    if (chosen.length === BLIND_TEST_SONGS) break;
  }
  return chosen.map((w) => w.id);
}

export function puzzlesFor(domain: Domain | undefined) {
  const own = connectionsPuzzles.filter((p) => p.domain === domain);
  return domain && own.length ? own : connectionsPuzzles;
}

/** How far past the least recently used item a pick may still reach, to keep some variety. */
const RECENCY_SLACK = 3;

/**
 * Least recently used first: items never used yet, else the ones last used longest ago (with a
 * little slack). `lastUsed` maps an id to the day number it last came up.
 */
export function leastRecent<T>(items: T[], id: (item: T) => string, lastUsed?: Map<string, number>): T[] {
  if (!lastUsed || !items.length) return items;
  const never = items.filter((x) => !lastUsed.has(id(x)));
  if (never.length) return never;
  const oldest = Math.min(...items.map((x) => lastUsed.get(id(x))!));
  return items.filter((x) => lastUsed.get(id(x))! <= oldest + RECENCY_SLACK);
}

/**
 * Builds one round of the given type. `avoid` keeps targets unique within a day or a free-play
 * session; `lastUsed` (dailies) prefers what hasn't come up for the longest time.
 */
export function buildRound(
  type: GameType,
  domain: Domain | undefined,
  rand: () => number,
  avoid: Set<string> = new Set(),
  lastUsed?: Map<string, number>,
  only?: (w: Work) => boolean,
  /** A daily's day: the hand-made grids added after it (`from`) stay out. */
  dateKey?: string,
): RoundSpec | null {
  const seed = Math.floor(rand() * 2 ** 31);
  if (type === 'connections') {
    // Six times in ten, a grid built from a theme's sub-categories; otherwise a hand-made one.
    const themes = themesFor(domain).filter((b) => !b.from || !dateKey || b.from <= dateKey);
    if (themes.length && rand() < 0.6) {
      const bank = pick(themes, rand);
      return { type, domain: bank.domain, seed, puzzleId: `${THEME_PREFIX}${bank.id}:${Math.floor(rand() * 2 ** 31)}` };
    }
    const p = pick(leastRecent(puzzlesFor(domain).filter((x) => !x.from || !dateKey || x.from <= dateKey), (x) => x.id, lastUsed), rand);
    return { type, domain: p.domain, seed, puzzleId: p.id };
  }
  if (type === 'blindtest') {
    const ids = blindTestWorks(domain, rand, avoid, lastUsed, only);
    return ids.length === BLIND_TEST_SONGS ? { type, domain: 'music', seed, workIds: ids } : null;
  }
  if (type === 'timeline') {
    // Music from MUSIC_MIX_FROM: four songs from four different games or anime.
    const ids = timelineWorks(domain, rand, lastUsed, only, domain === 'music' && !!dateKey && dateKey >= MUSIC_MIX_FROM);
    return ids.length === 4 ? { type, domain: domain ?? 'mixed', seed, workIds: ids } : null;
  }
  const all = candidates(type, domain).filter((w) => !only || only(w));
  let pool = all.filter((w) => !avoid.has(w.id));
  if (!pool.length) pool = all;
  if (!pool.length) return null;
  const target = weightedPick(leastRecent(pool, (w) => w.id, lastUsed), type, rand);
  return { type, domain: target.domain, seed, targetId: target.id };
}

/**
 * Deterministic 10-round challenge for one category on one calendar day.
 * The seed is a hash of the date and the category, so every player gets the same rounds.
 */
/**
 * From this day on, the daily Music draws only video game and anime songs (the owner's call, a ticket); the
 * other songs stay in Free Play. Days before it keep the rounds they always had.
 */
export const MUSIC_GAMES_ANIME_FROM = '2026-11-12';
const gameOrAnimeSong = (w: Work) => /^(video game|anime|console)/i.test(w.format ?? '');

/**
 * From this day on, Music's two free places (it has eight mini-games for ten rounds) go to its listening rounds
 * instead of two more Classics, and its songs are spread by source: a game or an anime waits as long as possible
 * before coming back, and gives one song a day at most (the owner's call). Days before it keep their rounds.
 */
export const MUSIC_MIX_FROM = '2026-11-23';
/** Music's listening rounds, drawn only into Music's dailies from MUSIC_MIX_FROM (and in Free Play). */
const LISTENING: GameType[] = ['intro', 'needle', 'blindtest'];

/** Music from MUSIC_MIX_FROM: a game or an anime whose song came up fewer days ago than this sits out, when there's a choice. */
const SOURCE_REST = 5;

/** When each source (a song's game or anime) last gave a song: source → day number since EPOCH. */
function sourceDays(lastUsed: Map<string, number>, domain: Domain): Map<string, number> {
  const days = new Map<string, number>();
  for (const w of candidates('classic', domain)) {
    const day = lastUsed.get(w.id);
    if (w.studio && day !== undefined) days.set(w.studio, Math.max(day, days.get(w.studio) ?? -1));
  }
  return days;
}

export function buildDaily(dateKey: string, domain: Domain): RoundSpec[] {
  const key = `${domain}:${dateKey}`;
  const cached = dailyCache.get(key);
  if (cached) return cached;
  const rand = mulberry32(hashString(`omnidle:${dateKey}:${domain}`));
  const used = new Set<string>();
  // No repeats across days: each pick prefers what hasn't been an answer for the longest time.
  const lastUsed = usageBefore(dateKey, domain);
  // Every mini-game this category has content for, ten of them a day (voice lines only exist for
  // anime and games, so those categories rotate one game out each day).
  let types = shuffle(GAME_TYPES.filter((t) => !LISTENING.includes(t) && isAvailable(t, domain)), rand).slice(0, ROUNDS_PER_DAY);
  const musicOnly = domain === 'music' && dateKey >= MUSIC_GAMES_ANIME_FROM ? gameOrAnimeSong : undefined;
  // Works added later (`from`) stay out of the days before they came, so those days keep their rounds.
  const live = (w: Work) => !w.from || w.from <= dateKey;
  const only = (w: Work) => live(w) && (!musicOnly || musicOnly(w));
  const mix = domain === 'music' && dateKey >= MUSIC_MIX_FROM;
  if (mix) {
    // Music's free places (the rounds no game or anime song has content for, like Item and Location, which used
    // to fall back to Classic) go to two of its three listening rounds (rotating), mixed in among the others.
    types = types.filter((t) => t === 'connections' || t === 'timeline' || candidates(t, domain).some(only));
    types.push(...shuffle(LISTENING, rand).slice(0, ROUNDS_PER_DAY - types.length));
    types = shuffle(types, rand);
  }
  while (types.length < ROUNDS_PER_DAY) types.push('classic');
  if (dateKey >= ONE_ANSWER_FROM) {
    const specs = buildOneAnswerEach(dateKey, domain, types, rand, lastUsed, live, only, mix ? sourceDays(lastUsed, domain) : undefined);
    dailyCache.set(key, specs);
    return specs;
  }
  const specs = types.map((type) => {
    const spec = buildRound(type, domain, rand, used, lastUsed, only, dateKey) ?? buildRound('classic', domain, rand, used, lastUsed, only) ?? buildRound('classic', domain, rand, used, lastUsed, live)!;
    if (spec.targetId) used.add(spec.targetId);
    return spec;
  });
  dailyCache.set(key, specs);
  return specs;
}

/**
 * From this day on, a work is to be found once a day: not the answer of one round and shown in another (a Timeline, a
 * Connections grid naming it or about its franchise), and a song is not drawn from a game or an anime that is an answer
 * in that day's Video Games or Anime (the owner's call). Days before it keep the rounds they always had.
 */
export const ONE_ANSWER_FROM = '2026-11-20';

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
const namesOf = (w: Work) => [w.name, w.nameFr, ...(w.aliases ?? [])].filter((n): n is string => !!n).map(norm);
/** Whether two titles are the same work, or one the other's franchise ("The Legend of Zelda", "…: Ocarina of Time"). */
const sameSeries = (a: string, b: string) => !!a && !!b && (a === b || (Math.min(a.length, b.length) >= 5 && (a.startsWith(b) || b.startsWith(a))));

/** The works of a category a round shows or is about, beyond its own answer: a Timeline's four, a grid's titles and franchise. */
function worksShownBy(spec: RoundSpec, domain: Domain): Set<string> {
  const shown = new Set(spec.workIds ?? []);
  if (!spec.puzzleId) return shown;
  let titles: string[] = [];
  let fandoms: string[] = [];
  if (spec.puzzleId.startsWith(THEME_PREFIX)) {
    const bank = connectionThemes.find((b) => b.id === spec.puzzleId!.slice(THEME_PREFIX.length).split(':')[0]);
    if (bank) {
      titles = [bank.theme];
      // Its works by their wiki: the bank's own id ("zelda") or the wiki its pictures come from ("marvelcinematicuniverse").
      fandoms = [bank.id, ...(bank.images.startsWith('fandom:') ? [bank.images.slice('fandom:'.length)] : [])];
    }
  } else {
    const p = connectionsPuzzles.find((x) => x.id === spec.puzzleId);
    if (p) titles = [...(p.theme ? [p.theme] : []), ...p.groups.flatMap((g) => g.items.map((t) => t.label))];
  }
  const keys = titles.map(norm);
  for (const w of candidates('classic', domain)) if ((!!w.fandom && fandoms.includes(w.fandom)) || namesOf(w).some((n) => keys.some((k) => sameSeries(n, k)))) shown.add(w.id);
  return shown;
}

/**
 * A day's rounds with each work found once: the rounds that show several works (Timeline, Connections) are drawn first,
 * then every other round's answer among the works none of them shows. Music leaves out the songs of that day's Video
 * Games and Anime answers.
 */
function buildOneAnswerEach(
  dateKey: string,
  domain: Domain,
  types: GameType[],
  rand: () => number,
  lastUsed: Map<string, number>,
  live: (w: Work) => boolean,
  only: (w: Work) => boolean,
  /**
   * Music from MUSIC_MIX_FROM, when each source last gave a song: one song per game or anime a day, and none from a
   * source rested for fewer than SOURCE_REST days, when there's a choice.
   */
  restBySource?: Map<string, number>,
): RoundSpec[] {
  const oneBySource = !!restBySource;
  const today = dayNumber(dateKey) - 1;
  const rested = (source: string) => today - (restBySource?.get(source) ?? -Infinity) > SOURCE_REST;
  const used = new Set<string>();
  const sources = new Set<string>();
  // A song's source (its `studio`: the game or anime it comes from) against the answers of the other categories.
  let fromOtherAnswer = (_w: Work) => false;
  if (domain === 'music') {
    const others = (['games', 'anime'] as Domain[]).flatMap((d) => {
      const ids = new Set(buildDaily(dateKey, d).flatMap((s) => [s.targetId, ...worksShownBy(s, d)]).filter((x): x is string => !!x));
      return candidates('classic', d).filter((w) => ids.has(w.id)).flatMap(namesOf);
    });
    fromOtherAnswer = (w) => !!w.studio && others.some((n) => sameSeries(norm(w.studio), n));
  }
  const free = (w: Work) => only(w) && !used.has(w.id) && !fromOtherAnswer(w);
  const fresh = (w: Work) => free(w) && !(w.studio && (sources.has(w.studio) || !rested(w.studio)));
  const specs: RoundSpec[] = new Array(types.length);
  const order = types.map((t, i) => [t, i] as const);
  const showsSeveral = (t: GameType) => t === 'timeline' || t === 'connections';
  for (const [type, i] of [...order.filter(([t]) => showsSeveral(t)), ...order.filter(([t]) => !showsSeveral(t))]) {
    const spec =
      (oneBySource ? buildRound(type, domain, rand, used, lastUsed, fresh, dateKey) : null) ??
      buildRound(type, domain, rand, used, lastUsed, free, dateKey) ??
      buildRound('classic', domain, rand, used, lastUsed, free) ??
      buildRound('classic', domain, rand, used, lastUsed, live)!;
    if (spec.targetId) used.add(spec.targetId);
    for (const id of worksShownBy(spec, domain)) used.add(id);
    if (oneBySource) for (const id of [spec.targetId, ...(spec.workIds ?? [])]) if (id) sources.add(getWork(id).studio);
    specs[i] = spec;
  }
  return specs;
}

/** Dailies already built, by "domain:date" (each day depends on all the days before it). */
const dailyCache = new Map<string, RoundSpec[]>();

/** The answers a round uses: its target, its works, or its hand-made puzzle. */
const answersOf = (s: RoundSpec) => [s.targetId, ...(s.workIds ?? []), s.puzzleId && !s.puzzleId.startsWith(THEME_PREFIX) ? s.puzzleId : undefined].filter((x): x is string => !!x);

/** When each answer last came up in a category's dailies before `dateKey`: id → day number since EPOCH. */
function usageBefore(dateKey: string, domain: Domain): Map<string, number> {
  const lastUsed = new Map<string, number>();
  for (let day = EPOCH, n = 0; day < dateKey; day = addDays(day, 1), n++) {
    for (const s of buildDaily(day, domain)) for (const id of answersOf(s)) lastUsed.set(id, n);
  }
  return lastUsed;
}

export function isAvailable(type: GameType, domain?: Domain): boolean {
  if (type === 'connections') return true;
  if (type === 'timeline') return new Set(candidates(type, domain).map((w) => w.year)).size >= 4;
  return candidates(type, domain).length > 0;
}

export const isDomain = (s: string | undefined): s is Domain => DOMAINS.some((d) => d.id === s);
