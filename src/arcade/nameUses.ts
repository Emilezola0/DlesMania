// Name Them All, played your way: answers you'd rather not see banned from a list (a theme's rabbit and
// horse), and a bonus for the names you rarely give — every name you've named before is counted, per list,
// on this device: a new one is worth 3 points, a rare one 2, a usual one 1 (and the DleCoins follow the points).

const usesKey = (list: string) => `omnidle-ntl-uses:${list}`;
const banKey = (list: string) => `omnidle-ntl-banned:${list}`;

const read = <T,>(key: string, fallback: T): T => {
  try {
    return (JSON.parse(localStorage.getItem(key) ?? 'null') as T) ?? fallback;
  } catch {
    return fallback;
  }
};
const write = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Not kept, that's all.
  }
};

/** How many runs each name of a list has been named in. */
export const usesOf = (list: string): Record<string, number> => read(usesKey(list), {});
export function addUses(list: string, names: string[]) {
  const uses = usesOf(list);
  for (const n of names) uses[n] = (uses[n] ?? 0) + 1;
  write(usesKey(list), uses);
}

/** Points for a name: never named before 3, named once or twice 2, more 1. */
export const pointsFor = (timesBefore: number) => (timesBefore === 0 ? 3 : timesBefore <= 2 ? 2 : 1);
export const RARE_LABEL = (timesBefore: number) => (timesBefore === 0 ? 'new' : timesBefore <= 2 ? 'rare' : '');

export const bannedOf = (list: string): string[] => read<string[]>(banKey(list), []);
export const setBanned = (list: string, names: string[]) => write(banKey(list), names);
