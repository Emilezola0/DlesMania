/** First playable daily challenge. */
export const EPOCH = '2026-10-01';

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

export function todayKey(): string {
  return toKey(new Date());
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

export function formatLong(key: string): string {
  return fromKey(key).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function msUntilTomorrow(): number {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next.getTime() - now.getTime();
}
