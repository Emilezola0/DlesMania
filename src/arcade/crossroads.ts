// Crossroads: vertical lines, a character falling down one of them, franchises at the bottom.
// The player draws bridges between neighbouring lines, at any angle, and the character takes every bridge
// whose end it meets — along the slant, to the other line — then keeps falling. Lead it to its
// own franchise. Bridges stay from one character to the next and are cleared every ten rounds,
// when the franchises at the bottom change. Later on, two characters fall at once, a moment apart; and a
// falling character can be sped up, for a bonus point if it lands home.
import { BOSSES } from '../data/bosses';
import { shuffle } from '../lib/rng';
import type { NameLang } from '../store/progress';

export interface Traveller {
  name: string;
  /** The French name, when it differs. */
  fr?: string;
  image: string;
  franchise: string;
}

/** Franchises whose French title differs. */
const FRANCHISE_FR: Record<string, string> = {
  'The Lord of the Rings': 'Le Seigneur des anneaux',
  'Marvel Cinematic Universe': 'Univers cinématographique Marvel',
};

/** A name or franchise in the chosen language. */
export const travellerName = (t: Traveller, lang: NameLang) => (lang === 'fr' && t.fr) || t.name;
export const franchiseName = (f: string, lang: NameLang) => (lang === 'fr' && FRANCHISE_FR[f]) || f;

/** A bridge from line `a` at height `ya` to the next line `b` at height `yb` (any slant). */
export interface Bridge {
  id: number;
  a: number;
  ya: number;
  b: number;
  yb: number;
}

export const CROSS_LIVES = 3;
/** The franchises change, and the bridges are cleared, every this many rounds. */
export const ROUNDS_PER_BOARD = 10;
/** The fewest franchises (lines) a board can have. */
export const MIN_LINES = 3;
/** A sped-up character falls this many times faster, and is worth this many more points if it lands home. */
export const FAST_FACTOR = 2.4;
export const FAST_BONUS = 1;
/** Ladder geometry, in SVG units: lines COL_W apart, falling from TOP to BOTTOM. */
export const COL_W = 100;
export const HEIGHT = 560;
export const TOP = 30;
export const BOTTOM = HEIGHT - 16;
/** Bridge ends can't sit closer than this on one line (it would be unclear which comes first). */
export const MIN_GAP = 16;
/** Bridge ends stay this far inside the top and the bottom of the lines. */
export const EDGE = 12;
/** The highest and lowest a bridge end can sit. */
export const DRAW_TOP = TOP + EDGE;
export const DRAW_BOTTOM = BOTTOM - EDGE;

export const lineX = (col: number) => col * COL_W + COL_W / 2;

// The difficulty never stops growing, by characters brought home (`home`): quick at first, then slower and
// slower, but always a little harder — there's no level where it settles.

/** Units per second: a gentle fall at first, 5% quicker with every character home up to 160 (33 home), then on and on, ever more slowly. */
export const fallSpeed = (home: number) => (home <= 100 / 3 ? 60 * (1 + 0.05 * home) : 160 + 14 * Math.sqrt(home - 100 / 3));

/** How long a character waits at the top before falling (ms): time to see who it is and to build — shorter and shorter, never under 800. */
export const waitFor = (home: number) => (home <= 30 ? 3000 - 40 * home : 800 + 1000 * Math.exp(-(home - 30) / 40));

/** More lines as the score grows: 4, 5 from 10 home, 6 from 25, 7 from 50, 8 from 90 (a phone's width can't take more). */
export const linesFor = (home: number) => (home >= 90 ? 8 : home >= 50 ? 7 : home >= 25 ? 6 : home >= 10 ? 5 : 4);

/** How often a round drops two characters instead of one: from 12 home, now and then; from 30, always. */
export const pairChance = (home: number) => (home >= 30 ? 1 : home >= 20 ? 0.6 : home >= 12 ? 0.35 : 0);
/** And three: from 45 home, now and then, more and more often, always from 105. */
export const tripleChance = (home: number) => Math.max(0, Math.min(1, (home - 45) / 60));
/** How long each of a pair (or three) waits after the one before (ms): a clear gap at first, tighter and tighter, never under 300. */
export const pairGap = (home: number) => (home <= 50 ? Math.max(450, 1400 - 25 * Math.max(0, home - 12)) : 300 + 150 * Math.exp(-(home - 50) / 40));

/** Smash Bros. members belong to other franchises too: they'd make two right answers. */
const SKIP = new Set(['smash']);

/** The best-known faces of each franchise (a boss's radar members come best-known first). */
const POOL: { id: string; franchise: string; people: Traveller[] }[] = (() => {
  const count = new Map<string, number>();
  for (const b of BOSSES) for (const m of b.radar.members) count.set(m.label, (count.get(m.label) ?? 0) + 1);
  return BOSSES.filter((b) => !SKIP.has(b.id))
    .map((b) => ({
      id: b.id,
      franchise: b.franchise,
      people: b.radar.members
        .filter((m) => m.image && count.get(m.label) === 1)
        .slice(0, 10)
        .map((m) => ({ name: m.label, fr: m.fr, image: m.image!, franchise: b.franchise })),
    }))
    .filter((f) => f.people.length >= 3);
})();

/** The franchises at the bottom of a new board. */
export const boardGoals = (lines: number, rand: () => number = Math.random, allowed?: string[]) =>
  shuffle(allowed ? POOL.filter((f) => allowed.includes(f.id)) : POOL, rand)
    .slice(0, lines)
    .map((f) => f.franchise);

/** The franchises a board can be made of (Customise picks among them), by Boss Battle id. */
export const CROSS_FRANCHISES = POOL.map((f) => f.id);

/** Someone from one of the board's franchises, not one of the last few seen. */
export function nextTraveller(goals: string[], recent: string[], rand: () => number = Math.random): Traveller {
  const people = POOL.filter((f) => goals.includes(f.franchise)).flatMap((f) => f.people);
  const fresh = people.filter((p) => !recent.includes(p.name));
  const from = fresh.length ? fresh : people;
  return from[Math.floor(rand() * from.length)];
}

/** Where a bridge meets a line, if it does: the height there. */
export const endOn = (br: Bridge, line: number) => (br.a === line ? br.ya : br.b === line ? br.yb : null);

/** Whether a new bridge's ends would crowd an existing end on the same line. */
export function crowded(bridges: Bridge[], line: number, y: number): boolean {
  return bridges.some((br) => {
    const e = endOn(br, line);
    return e !== null && Math.abs(e - y) < MIN_GAP;
  });
}

/** A bridge being drawn, before it's placed. */
export type Plan = { ok: true; bridges: Omit<Bridge, 'id'>[] } | { ok: false; reason: string; bridges: Omit<Bridge, 'id'>[] };

/**
 * The bridges a stroke from `p` to `q` builds, forgivingly: each end goes to the nearest line, however far
 * from it the stroke starts or stops; a short stroke beside one line reaches for the next line its way;
 * a stroke across several lines makes a bridge over each gap, along its slant; an end too close to
 * another one slides a little out of its way; and ends too high or too low come back inside the lines.
 */
export function planBridges(p: { x: number; y: number }, q: { x: number; y: number }, lines: number, bridges: Bridge[]): Plan {
  const clampY = (y: number) => Math.max(DRAW_TOP, Math.min(DRAW_BOTTOM, y));
  const nearest = (x: number) => Math.max(0, Math.min(lines - 1, Math.round((x - COL_W / 2) / COL_W)));
  // Left to right, whichever way it was drawn.
  const [a, b] = p.x <= q.x ? [p, q] : [q, p];
  let la = nearest(a.x);
  let lb = nearest(b.x);
  if (la === lb) {
    // Both ends by one line: the stroke points at the neighbour on its side.
    if (b.x - a.x < 24) return { ok: false, reason: 'Draw sideways, from one line to the next.', bridges: [] };
    const left = (a.x + b.x) / 2 < lineX(la);
    if ((left && la > 0) || lb === lines - 1) la -= 1;
    else lb += 1;
    if (la < 0) return { ok: false, reason: 'Draw sideways, from one line to the next.', bridges: [] };
    if (la === lb) return { ok: false, reason: 'Draw sideways, from one line to the next.', bridges: [] };
  }
  // The stroke's height where it crosses a line (its own ends for the end lines).
  const yAt = (line: number) => {
    if (line === la) return a.y;
    if (line === lb) return b.y;
    return a.y + ((b.y - a.y) * (lineX(line) - a.x)) / (b.x - a.x || 1);
  };
  const placed: Bridge[] = [...bridges];
  const out: Omit<Bridge, 'id'>[] = [];
  // Slide an end out of the way of the others on its line, if a little nudge does it.
  const settle = (line: number, y: number) => {
    const free = (v: number) => v >= DRAW_TOP && v <= DRAW_BOTTOM && !crowded(placed, line, v);
    if (free(y)) return y;
    for (let d = 2; d <= MIN_GAP * 1.5; d += 2) {
      if (free(y + d)) return y + d;
      if (free(y - d)) return y - d;
    }
    return null;
  };
  for (let line = la; line < lb; line++) {
    const ya = settle(line, clampY(yAt(line)));
    const yb = settle(line + 1, clampY(yAt(line + 1)));
    if (ya === null || yb === null) return { ok: false, reason: 'Too close to another bridge on that line.', bridges: out };
    const br = { a: line, ya, b: line + 1, yb };
    out.push(br);
    placed.push({ ...br, id: -1 - line });
  }
  return { ok: true, bridges: out };
}

/** The falling character: going down a line, or across a bridge. */
export type Fall =
  | { mode: 'down'; line: number; y: number; taken: number[] }
  | { mode: 'across'; bridge: Bridge; from: 'a' | 'b'; k: number; taken: number[] };

export const fallStart = (line: number): Fall => ({ mode: 'down', line, y: TOP, taken: [] });

/** Where the character is drawn. */
export function fallPoint(f: Fall): { x: number; y: number } {
  if (f.mode === 'down') return { x: lineX(f.line), y: f.y };
  const { bridge: br, from, k } = f;
  const [x1, y1, x2, y2] = from === 'a' ? [lineX(br.a), br.ya, lineX(br.b), br.yb] : [lineX(br.b), br.yb, lineX(br.a), br.ya];
  return { x: x1 + (x2 - x1) * k, y: y1 + (y2 - y1) * k };
}

/**
 * One step of `dist` units. Going down, the first bridge end met (one not taken yet this fall) sends
 * the character across; across, it comes out on the far line and falls on from there. Each bridge is
 * taken once a fall, so a fall always ends. Returns the line it landed on once it reaches the bottom.
 */
export function stepFall(f: Fall, bridges: Bridge[], dist: number): { fall: Fall; landed: number | null } {
  let cur = f;
  for (let guard = 0; dist > 0 && guard < 50; guard++) {
    if (cur.mode === 'down') {
      const { line, y, taken } = cur;
      const next = bridges
        .filter((br) => !taken.includes(br.id))
        .map((br) => ({ br, at: endOn(br, line) }))
        .filter((e): e is { br: Bridge; at: number } => e.at !== null && e.at > y && e.at <= y + dist)
        .sort((p, q) => p.at - q.at)[0];
      if (!next) {
        const ny = y + dist;
        if (ny >= BOTTOM) return { fall: { ...cur, y: BOTTOM }, landed: line };
        return { fall: { ...cur, y: ny }, landed: null };
      }
      dist -= next.at - y;
      cur = { mode: 'across', bridge: next.br, from: next.br.a === line ? 'a' : 'b', k: 0, taken: [...taken, next.br.id] };
    } else {
      const { bridge: br, from, k, taken } = cur;
      const len = Math.hypot(lineX(br.b) - lineX(br.a), br.yb - br.ya) || 1;
      const left = (1 - k) * len;
      if (dist < left) return { fall: { ...cur, k: k + dist / len }, landed: null };
      dist -= left;
      const line = from === 'a' ? br.b : br.a;
      const y = from === 'a' ? br.yb : br.ya;
      cur = { mode: 'down', line, y, taken };
    }
  }
  return { fall: cur, landed: null };
}
