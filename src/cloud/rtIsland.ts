// An island as kept on the Realtime Database (src/cloud/islands.ts, src/cloud/teams.ts): `state` holds the island in
// two parts, so the rules can let a visiting friend change one plot (watering) and nothing else:
//  - `island`: the island without its plots, as JSON text (its cells are numbers; the database would turn a map of
//    numbered keys into a list, and the island is only ever written whole by those who may build);
//  - `plots`: each plot as JSON text, under `c<cell>`.
// The book (`log`) is a list of lines added one by one (push ids, in order).
import { getDatabase, type Database } from 'firebase/database';
import { newIsland, upgradeIsland, type Island, type Plot } from '../island/island';
import { DATABASE_URL } from './config';
import { app } from './firebase';

let base: Database | null = null;
export const rdb = () => (base ??= getDatabase(app, DATABASE_URL));

export interface StoredState {
  island: string;
  plots?: Record<string, string>;
}
export interface StoredLine {
  uid: string;
  name: string;
  what: string;
  day: string;
}
/** How many lines a book keeps (the oldest go). */
export const LOG = 30;

/** The island to keep. (JSON drops what a move left undefined: the database refuses it.) */
export function encodeState(isl: Island): StoredState {
  const plots: Record<string, string> = {};
  for (const [k, p] of Object.entries(isl.plots ?? {})) plots[`c${k}`] = JSON.stringify(p);
  return { island: JSON.stringify({ ...isl, plots: {} }), plots };
}
/** The island as kept, back (moved into today's world if it was made before). */
export function decodeState(s: StoredState | null | undefined): Island {
  if (!s?.island) return newIsland();
  const isl = JSON.parse(s?.island ?? '{}') as Partial<Island>;
  const plots: Record<string, Plot> = {};
  for (const [k, p] of Object.entries(s?.plots ?? {})) plots[k.slice(1)] = JSON.parse(p) as Plot;
  return upgradeIsland({ fg: {}, bg: {}, shown: {}, crossed: [], ...isl, plots });
}
/** The book's lines, oldest first, the last LOG. */
export function linesOf(log: Record<string, StoredLine> | null | undefined): StoredLine[] {
  return Object.keys(log ?? {})
    .sort()
    .map((k) => log![k])
    .slice(-LOG);
}
/** The book's keys to drop (all but the last LOG). */
export function oldLines(log: Record<string, StoredLine> | null | undefined): string[] {
  const keys = Object.keys(log ?? {}).sort();
  return keys.slice(0, Math.max(0, keys.length - LOG));
}
/** An error the island pages show as "not allowed" (the database's refusal). */
export const refused = (e: unknown) => /permission/i.test(String((e as { code?: string })?.code ?? (e as Error)?.message ?? e));
