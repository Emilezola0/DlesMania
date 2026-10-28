// Crossroads: vertical lines, a character falling down one of them, franchises at the bottom.
// The player draws bridges between neighbouring lines, at any angle, and the character takes every bridge
// whose end it meets — along the slant, to the other line — then keeps falling. Lead it to its
// own franchise. Bridges stay from one character to the next and are cleared every few rounds,
// when the franchises at the bottom change.
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
/** The franchises change, and the bridges are cleared, every this many characters. */
export const ROUNDS_PER_BOARD = 5;
/** Ladder geometry, in SVG units: lines COL_W apart, falling from TOP to BOTTOM. */
export const COL_W = 100;
export const HEIGHT = 560;
export const TOP = 30;
export const BOTTOM = HEIGHT - 16;
/** Bridge ends can't sit closer than this on one line (it would be unclear which comes first). */
export const MIN_GAP = 18;

export const lineX = (col: number) => col * COL_W + COL_W / 2;

/** Units per second: a gentle fall at first, quicker with every point, up to about three times. */
export const fallSpeed = (score: number) => Math.min(230, 75 * (1 + 0.07 * score));

/** More lines as the score grows. */
export const linesFor = (score: number) => (score >= 25 ? 6 : score >= 10 ? 5 : 4);

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
        .map((m) => ({ name: m.label, fr: m.fr, image: m.image!, franchise: b.franchise })),
    }))
    .filter((f) => f.people.length >= 3);
})();

/** The franchises at the bottom of a new board. */
export const boardGoals = (lines: number, rand: () => number = Math.random) => shuffle(POOL, rand).slice(0, lines).map((f) => f.franchise);

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
