import type { Work } from '../types';

export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function matchesQuery(w: Work, query: string): boolean {
  const q = normalize(query);
  if (!q) return false;
  return [w.name, w.subtitle ?? '', ...(w.aliases ?? [])].some((s) => normalize(s).includes(q));
}
