import { frNow } from './langNow';
/** First playable daily challenge. */
export const EPOCH = '2026-10-01';
/** The day Omnidle went online (its first deploy): its birthday, marked every year in the Archive. */
export const LAUNCH = '2026-10-18';
/** Is this date Omnidle's birthday (the launch day, or its anniversary)? */
export const isBirthday = (key: string) => key >= LAUNCH && key.slice(5) === LAUNCH.slice(5);

export function toKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// ── The real time ─────────────────────────────────────────────────────
// "Today" decides what can be earned each day (the dailies' rewards, the casino's daily spins and cards, quests,
// missions, gift codes, the day's earning caps), so it doesn't come from the device's clock alone. The site's own
// server tells the time (syncClock: at start, coming back online, now and then) and the device's clock is only
// corrected by it. Until it has (offline), today is the last day the server confirmed. And today never goes back
// before a day already confirmed (a time zone switched back and forth doesn't open the same day twice).
const VERIFIED_KEY = 'omnidle:clock:day';
// Once told: the real time then, and the page's own steady timer then (a clock moved later doesn't move it).
let realAt = 0;
let perfAt = 0;
let synced = false;
const steady = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const verified = {
  get: () => {
    try {
      return localStorage.getItem(VERIFIED_KEY);
    } catch {
      return null;
    }
  },
  set: (k: string) => {
    try {
      localStorage.setItem(VERIFIED_KEY, k);
    } catch {
      // Not kept: the next start asks the server again.
    }
  },
};

/** The real time (ms): the device's clock, corrected by the server's once known. */
export const now = () => (synced ? realAt + (steady() - perfAt) : Date.now());
/** Whether the server has told the time since the page opened. */
export const clockSynced = () => synced;
/** How far the device's clock is from the real time (ms), once known. */
export const clockOffset = () => (synced ? now() - Date.now() : null);

export function todayKey(): string {
  const last = verified.get();
  const k = synced || !last ? toKey(new Date(now())) : last;
  return last && k < last ? last : k;
}

/**
 * Asks the site's server for the time (the Date of a response to a tiny request, which no clock on the device
 * changes) and sets the device's offset from it. False when it can't (offline, or no answer in time).
 */
export async function syncClock(timeoutMs = 4000): Promise<boolean> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const t0 = Date.now();
    const res = await fetch(`${import.meta.env?.BASE_URL ?? './'}?clock=${t0}`, { method: 'HEAD', cache: 'no-store', signal: ctrl.signal });
    const t1 = Date.now();
    const server = Date.parse(res.headers.get('date') ?? '');
    if (!Number.isFinite(server)) return false;
    // The header is to the second: its middle, at the middle of the round trip.
    realAt = server + 500;
    perfAt = steady() - (t1 - t0) / 2;
    synced = true;
    const k = toKey(new Date(now()));
    const last = verified.get();
    if (!last || k > last) verified.set(k);
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** Keeps the clock told: now (waited for at most `firstWaitMs`), coming back online, and every ten minutes. */
export function keepClockSynced(firstWaitMs = 2500): Promise<void> {
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => void syncClock());
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void syncClock());
    window.setInterval(() => void syncClock(), 10 * 60_000);
  }
  return Promise.race([syncClock().then(() => undefined), new Promise<void>((r) => setTimeout(r, firstWaitMs))]);
}

export function addDays(key: string, delta: number): string {
  const d = fromKey(key);
  d.setDate(d.getDate() + delta);
  return toKey(d);
}

/** Puzzle number, starting at #1 on the epoch. */
export function dayNumber(key: string): number {
  const ms = fromKey(key).getTime() - fromKey(EPOCH).getTime();
  return Math.round(ms / 86_400_000) + 1;
}

export function isPlayableDay(key: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(key) && key >= EPOCH && key <= todayKey();
}

/** Dates in the player's language (the EN/FR setting), not the browser's. */
export const dateLocale = () => (frNow() ? 'fr-FR' : 'en-GB');

export function formatLong(key: string): string {
  return fromKey(key).toLocaleDateString(dateLocale(), {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

const nowMs = () => now();
export function msUntilTomorrow(): number {
  const now = new Date(nowMs());
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next.getTime() - now.getTime();
}
