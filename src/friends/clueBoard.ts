// Clue Grid (Friends → Clue Grid): every day the same grid of well-known characters for everyone. Each player is
// given a few of them in secret (their colour, src/cloud/clueGrid.ts) and writes one clue, a single word, saying how
// many of their characters it points to; their friends pick that many characters. Everything shows the next day:
// whose characters were whose, and who picked what. A clue pays its writer for every right pick of a friend, and a
// friend for answering, more for each right pick. Numbers in src/data/tuning/friends.json.
import T from '../data/tuning/friends.json';
import type { Card } from '../gacha/cards';
import { hashString, mulberry32, shuffle } from '../lib/rng';
import { characters } from './choiceQuestions';

export const CLUE = T.clueGrid;

/** "Son Goku" → "son goku": a name or clue as it's compared. */
const normName = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * A day's grid: the same characters for everyone, from the Daily Choice's characters (Legendary or better, the ones
 * people know) as they stood that day, so cards added later never change a grid. Franchises are spread out: no
 * franchise twice until every franchise is in.
 */
export function gridOf(day: string): Card[] {
  const rand = mulberry32(hashString(`clue-grid:${day}`));
  const pool = shuffle(characters(day), rand);
  const out: Card[] = [];
  const sets = new Set<string>();
  for (const c of pool) {
    if (out.length >= CLUE.size) break;
    if (!sets.has(c.set)) {
      out.push(c);
      sets.add(c.set);
    }
  }
  for (const c of pool) {
    if (out.length >= CLUE.size) break;
    if (!out.includes(c)) out.push(c);
  }
  return out;
}

/** A player's secret characters for a day: places in the grid, all different, picked at random. */
export function randomTargets(): number[] {
  return shuffle(
    Array.from({ length: CLUE.size }, (_, i) => i),
    Math.random,
  )
    .slice(0, CLUE.targets)
    .sort((a, b) => a - b);
}

/** Places in the grid, cleaned: whole numbers on the grid, each once, at most `max` (data written by other players). */
export function cells(xs: unknown, max: number = CLUE.size): number[] {
  if (!Array.isArray(xs)) return [];
  const out: number[] = [];
  for (const x of xs) if (Number.isInteger(x) && x >= 0 && x < CLUE.size && !out.includes(x as number) && out.length < max) out.push(x as number);
  return out;
}

/** The longest a clue can be. */
export const CLUE_MAX = 24;

/** Why a clue can't be used (null when it can): one word, and none of the grid's names or a piece of one. */
export function clueProblem(clue: string, grid: Card[]): string | null {
  const word = clue.trim();
  if (!word) return 'Write a clue first.';
  if (/\s/.test(word)) return 'One word only.';
  if (word.length > CLUE_MAX) return `${CLUE_MAX} letters at most.`;
  if (!/^[\p{L}\p{N}'’-]+$/u.test(word)) return 'Letters and numbers only.';
  const n = normName(word).replace(/ /g, '');
  for (const c of grid) {
    const parts = normName(c.name).split(' ').filter((p) => p.length >= 3);
    if (n === normName(c.name).replace(/ /g, '') || parts.some((p) => n.includes(p) || (n.length >= 3 && p.includes(n))))
      return `Too close to “${c.name}”, who is on the grid.`;
  }
  return null;
}

/** How many of a pick's characters are among a player's secret ones. */
export const rightOf = (picked: number[], targets: number[]) => picked.filter((i) => targets.includes(i)).length;
