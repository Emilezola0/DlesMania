import type { Domain } from '../types';
import raw from './silhouettes.json';

/** One thing to recognise from its silhouette; any of its names counts. */
export interface SilhouetteEntry {
  name: string;
  aliases: string[];
  /** Transparent-background picture, blacked out until it's named. */
  image: string;
}

/** A roster for "Who's That?", built by scripts/build-silhouettes.mjs. */
export interface SilhouetteSeries {
  id: string;
  domain: Domain;
  label: string;
  /** What one entry is called ("champion", "mob"...). */
  noun: string;
  /** Pictures on a white background, cut out at play time (src/lib/cutout.ts) before blacking out. */
  cutout?: boolean;
  entries: SilhouetteEntry[];
}

export const SILHOUETTES = raw as unknown as SilhouetteSeries[];

/** "all-<domain>" plays every series of a domain at once. */
export const ALL_PREFIX = 'all-';

export const silhouetteDomains = (): Domain[] => [...new Set(SILHOUETTES.map((s) => s.domain))];

/** The entries for a series id or "all-<domain>", each tagged with its series. */
export function deckFor(key: string): (SilhouetteEntry & { series: SilhouetteSeries })[] | null {
  const series = key.startsWith(ALL_PREFIX)
    ? SILHOUETTES.filter((s) => s.domain === key.slice(ALL_PREFIX.length))
    : SILHOUETTES.filter((s) => s.id === key);
  if (!series.length) return null;
  return series.flatMap((s) => s.entries.map((e) => ({ ...e, series: s })));
}
