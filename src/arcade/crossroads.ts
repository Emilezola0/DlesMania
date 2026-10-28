// Crossroads: a ladder of vertical lines, characters at the top, their franchises at the bottom.
// Each character slides straight down and takes every bridge (a rung between two neighbouring
// lines) it meets. Some bridges are already there; the player draws the rest so everyone lands
// on their own franchise. Any order can be reached with bridges, so every puzzle is solvable:
// it's built from a hidden solution, and the bridge budget is that solution's size.
import { BOSSES } from '../data/bosses';
import { mulberry32, shuffle } from '../lib/rng';

export interface Traveller {
  name: string;
  image: string;
  franchise: string;
}

/** A bridge between line `col` and line `col + 1`, at height `row`. */
export interface Rung {
  col: number;
  row: number;
}

export interface CrossPuzzle {
  lines: number;
  rows: number;
  /** Top of line i. */
  travellers: Traveller[];
  /** Bottom of line i: a franchise. */
  goals: string[];
  /** Bridges already in place: they can't be removed. */
  fixed: Rung[];
  /** How many bridges the player may draw. */
  budget: number;
}

export const CROSS_LIVES = 3;

/** Smash Bros. members belong to other franchises too: they'd make two right answers. */
const SKIP = new Set(['smash']);

/** The best-known faces of each franchise (a boss's radar members come best-known first). */
const POOL: { franchise: string; people: Traveller[] }[] = (() => {
  const count = new Map<string, number>();
  for (const b of BOSSES) for (const m of b.radar.members) count.set(m.label, (count.get(m.label) ?? 0) + 1);
  return BOSSES.filter((b) => !SKIP.has(b.id))
    .map((b) => ({
      franchise: b.franchise,
      people: b.radar.members
        .filter((m) => m.image && count.get(m.label) === 1)
        .slice(0, 10)
        .map((m) => ({ name: m.label, image: m.image!, franchise: b.franchise })),
    }))
    .filter((f) => f.people.length >= 3);
})();

export const rungKey = (r: Rung) => `${r.col}:${r.row}`;

/** Bridges at the same height can't share a line. */
export function clashes(rungs: Set<string>, r: Rung): boolean {
  return rungs.has(rungKey({ col: r.col - 1, row: r.row })) || rungs.has(rungKey({ col: r.col + 1, row: r.row }));
}

/** Where a traveller starting on line `start` ends up, and the turns on the way (line, row) for drawing. */
export function walk(start: number, rows: number, rungs: Set<string>): { end: number; steps: { col: number; row: number }[] } {
  let col = start;
  const steps: { col: number; row: number }[] = [];
  for (let row = 0; row < rows; row++) {
    if (rungs.has(rungKey({ col, row }))) (steps.push({ col, row }), (col += 1), steps.push({ col, row }));
    else if (rungs.has(rungKey({ col: col - 1, row }))) (steps.push({ col, row }), (col -= 1), steps.push({ col, row }));
  }
  return { end: col, steps };
}

/** How each level is shaped: more lines, more fixed bridges, a tighter budget. */
export function levelShape(level: number) {
  const lines = Math.min(6, 3 + Math.floor((level - 1) / 2));
  return {
    lines,
    rows: 5 + lines,
    fixed: Math.min(lines + 3, lines - 2 + Math.floor(level / 2)),
    hidden: lines - 1 + Math.floor(level / 3),
    slack: level <= 2 ? 1 : 0,
  };
}

/** Random bridges on free, non-clashing spots. */
function scatter(count: number, lines: number, rows: number, taken: Set<string>, rand: () => number): Rung[] {
  const out: Rung[] = [];
  for (let tries = 0; out.length < count && tries < 500; tries++) {
    const r = { col: Math.floor(rand() * (lines - 1)), row: Math.floor(rand() * rows) };
    if (taken.has(rungKey(r)) || clashes(taken, r)) continue;
    taken.add(rungKey(r));
    out.push(r);
  }
  return out;
}

export function crossPuzzle(level: number, seed = Math.floor(Math.random() * 1e9)): CrossPuzzle {
  const rand = mulberry32(seed);
  const { lines, rows, fixed: nFixed, hidden: nHidden, slack } = levelShape(level);
  for (let attempt = 0; ; attempt++) {
    const taken = new Set<string>();
    const fixed = scatter(nFixed, lines, rows, taken, rand);
    const fixedOnly = new Set(taken);
    const hidden = scatter(nHidden, lines, rows, taken, rand);
    const ends = Array.from({ length: lines }, (_, i) => walk(i, rows, taken).end);
    const alone = Array.from({ length: lines }, (_, i) => walk(i, rows, fixedOnly).end);
    // The bridges already there mustn't solve it, and nobody should just go straight down every time.
    const same = ends.every((e, i) => e === alone[i]);
    if ((same || ends.every((e, i) => e === i)) && attempt < 50) continue;
    const franchises = shuffle(POOL, rand).slice(0, lines);
    const travellers = franchises.map((f) => f.people[Math.floor(rand() * f.people.length)]);
    const goals: string[] = Array(lines);
    ends.forEach((end, i) => (goals[end] = travellers[i].franchise));
    return { lines, rows, travellers, goals, fixed, budget: hidden.length + slack };
  }
}
