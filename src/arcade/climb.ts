// Summit: climb a wall one hand at a time. Every hold within reach shows a face; type the name to
// grab it. Stamina drains all the while — faster on poor holds, steep walls and awkward positions
// (hands far apart or crossed) — and comes back on the ledges every few metres. Out of stamina, you
// fall to the last ledge (or piton) and lose a rope. The score is the height reached.
import { BOSSES } from '../data/bosses';
import { mulberry32 } from '../lib/rng';

export type HoldKind = 'jug' | 'pinch' | 'crimp' | 'sloper';
export type WallAngle = 'slab' | 'vertical' | 'overhang';

export interface Face {
  name: string;
  /** The French name, when it differs. */
  fr?: string;
  image: string;
  /** What can be typed to grab it, compacted (see `compact`). */
  spellings: string[];
}

export interface Hold {
  id: number;
  x: number;
  y: number;
  kind: HoldKind;
  face: Face;
}

/** Where a hand is: on a hold, on a ledge, or on the start jugs. */
export interface Grip {
  x: number;
  y: number;
  kind: HoldKind | 'ledge';
  holdId?: number;
}

export const WALL_W = 4;
/** How far a hand can reach from the other one, in metres. */
export const REACH = 1.55;
/** A long reach: possible when nothing nearer is up there, but it costs. */
export const FAR_REACH = 1.95;
export const LEDGE_EVERY = 6;
export const MAX_STAMINA = 100;
export const ROPES = 3;
/** Lit holds show their name after this long, at a price: the clock kept running. */
export const REVEAL_MS = 4500;
/** A wrong name: the hand slips. */
export const SLIP_COST = 4;

export const HOLD_INFO: Record<HoldKind | 'ledge', { name: string; drain: number }> = {
  jug: { name: 'Jug', drain: 0.55 },
  pinch: { name: 'Pinch', drain: 1 },
  crimp: { name: 'Crimp', drain: 1.45 },
  sloper: { name: 'Sloper', drain: 1.7 },
  ledge: { name: 'Ledge', drain: 0.3 },
};

export const ANGLE_INFO: Record<WallAngle, { name: string; drain: number }> = {
  slab: { name: 'Slab', drain: 0.8 },
  vertical: { name: 'Vertical', drain: 1 },
  overhang: { name: 'Overhang', drain: 1.35 },
};

/** Lowercase letters and digits only: "Monkey D. Luffy" → "monkeydluffy". */
export const compact = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const SMALL_WORDS = new Set(['the', 'of', 'and', 'von', 'van', 'del', 'des']);

/** The full name, its aliases, and any word of it (or of its French name) long enough to stand alone ("Luffy", "Chopper"). */
function spellingsOf(name: string, aliases: string[] = [], fr?: string): string[] {
  const words = [name, fr ?? ''].join(' ').split(/[\s.]+/).filter((w) => compact(w).length >= 4 && !SMALL_WORDS.has(w.toLowerCase()));
  return [...new Set([name, ...aliases, ...words].map(compact).filter(Boolean))];
}

/** Every well-known face of the Boss Battle franchises, once each. */
export const FACES: Face[] = (() => {
  const seen = new Set<string>();
  return BOSSES.flatMap((b) => b.radar.members)
    .filter((m) => m.image && !seen.has(m.label) && seen.add(m.label))
    .map((m) => ({ name: m.label, fr: m.fr, image: m.image!, spellings: spellingsOf(m.label, [...(m.aliases ?? []), ...(m.fr ? [m.fr] : [])], m.fr) }));
})();

export const sectionOf = (y: number) => Math.floor(y / LEDGE_EVERY);
export const ledgeAbove = (y: number) => (sectionOf(y + 0.01) + 1) * LEDGE_EVERY;

export function angleOf(section: number, seed: number): WallAngle {
  if (section === 0) return 'vertical';
  const r = mulberry32(seed * 7 + section * 131)();
  return r < 0.3 ? 'slab' : r < 0.65 ? 'vertical' : 'overhang';
}

/** Higher up, fewer jugs and more crimps and slopers. */
function kindFor(section: number, r: number): HoldKind {
  const w = { jug: Math.max(1, 5 - section), pinch: 3, crimp: 1 + section, sloper: section * 0.8 };
  let x = r * (w.jug + w.pinch + w.crimp + w.sloper);
  for (const k of ['jug', 'pinch', 'crimp'] as const) if ((x -= w[k]) < 0) return k;
  return 'sloper';
}

/**
 * The holds between one ledge and the next: rows every half metre or so, two or three holds a
 * row, spread across the wall. Same seed, same wall.
 */
export function makeSection(section: number, seed: number, firstId: number): Hold[] {
  const rand = mulberry32(seed * 977 + section * 7919);
  const holds: Hold[] = [];
  const base = section * LEDGE_EVERY;
  const recent: string[] = [];
  let id = firstId;
  for (let y = base + 0.45; y < base + LEDGE_EVERY - 0.35; y += 0.42 + rand() * 0.18) {
    const n = rand() < 0.4 ? 3 : 2;
    const xs: number[] = [];
    for (let tries = 0; xs.length < n && tries < 40; tries++) {
      const x = 0.35 + rand() * (WALL_W - 0.7);
      if (xs.every((o) => Math.abs(o - x) > 0.75)) xs.push(x);
    }
    for (const x of xs) {
      let face = FACES[Math.floor(rand() * FACES.length)];
      for (let t = 0; t < 10 && recent.includes(face.name); t++) face = FACES[Math.floor(rand() * FACES.length)];
      recent.push(face.name);
      if (recent.length > 14) recent.shift();
      holds.push({ id: id++, x, y: y + (rand() - 0.5) * 0.12, kind: kindFor(section, rand()), face });
    }
  }
  return holds;
}

export const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

/** Crossed hands: the left one well to the right of the right one. */
export const crossed = (left: Grip, right: Grip) => left.x > right.x + 0.05;

/** How hard the position is, ×1 when comfortable. */
export function poseFactor(left: Grip, right: Grip): number {
  const d = dist(left, right);
  const spread = d > 1.1 ? 1 + (d - 1.1) * 1.6 : d < 0.35 ? 1.25 : 1;
  return spread * (crossed(left, right) ? 1.6 : 1);
}

/** Stamina lost per second. */
export function drainRate(left: Grip, right: Grip, angle: WallAngle, section: number, chalk: boolean): number {
  const holds = (HOLD_INFO[left.kind].drain + HOLD_INFO[right.kind].drain) / 2;
  return 2.2 * (1 + 0.06 * section) * ANGLE_INFO[angle].drain * holds * poseFactor(left, right) * (chalk ? 0.6 : 1);
}

/** What a move costs on top of the drain: more for a long reach. */
export const moveCost = (anchor: Grip, to: { x: number; y: number }) => {
  const d = dist(anchor, to);
  return 1.5 + d * 1.2 + (d > REACH ? 6 : d > 1.3 ? 3 : 0);
};

/**
 * The holds the moving hand can go for, up to four: above it, within reach of the other hand —
 * no two starting with the same letter or sharing a spelling, so typing never hesitates between
 * them. When nothing is in reach, the long reaches come in. Nothing past the next ledge: the way
 * up goes over it.
 */
export function reachable(holds: Hold[], anchor: Grip, mover: Grip): Hold[] {
  const ledge = ledgeAbove(Math.max(anchor.y, mover.y));
  const pick = (maxReach: number, minRise: number) =>
    holds
      .filter((h) => h.id !== anchor.holdId && h.id !== mover.holdId && h.y > mover.y + minRise && h.y < ledge && h.y <= anchor.y + maxReach && dist(h, anchor) <= maxReach)
      .sort((a, b) => b.y - a.y);
  let cands = pick(REACH, 0.05);
  if (cands.length < 2) cands = [...cands, ...pick(FAR_REACH, -0.3).filter((h) => !cands.includes(h))];
  const out: Hold[] = [];
  for (const h of cands) {
    if (out.length >= 4) break;
    const clash = out.some((o) => o.face.name[0].toLowerCase() === h.face.name[0].toLowerCase() || o.face.spellings.some((s) => h.face.spellings.includes(s)));
    if (!clash) out.push(h);
  }
  // Never stuck: the nearest hold up the wall, however far, when nothing else is there.
  if (!out.length && ledgeInReach(anchor, mover) === null) {
    const nearest = holds
      .filter((h) => h.id !== anchor.holdId && h.id !== mover.holdId && h.y > mover.y - 0.3 && h.y < ledge)
      .sort((a, b) => dist(a, anchor) - dist(b, anchor))[0];
    if (nearest) out.push(nearest);
  }
  return out;
}

/** Whether the ledge above is in reach of the moving hand. */
export const ledgeInReach = (anchor: Grip, mover: Grip) => {
  const y = ledgeAbove(Math.max(anchor.y, mover.y));
  return y > mover.y && y - anchor.y <= REACH ? y : null;
};

/** The lit hold a name grabs, if any. */
export const holdNamed = (lit: Hold[], typed: string) => {
  const t = compact(typed);
  return t ? lit.find((h) => h.face.spellings.includes(t)) : undefined;
};

/** The lit holds a beginning of a name still fits. */
export const holdsStarting = (lit: Hold[], typed: string) => {
  const t = compact(typed);
  return t ? lit.filter((h) => h.face.spellings.some((s) => s.startsWith(t))) : lit;
};

export type Item = 'chalk' | 'piton' | 'bar';
export const ITEM_INFO: Record<Item, { icon: string; name: string; blurb: string }> = {
  chalk: { icon: '🧂', name: 'Chalk', blurb: 'Stamina drains 40% slower for your next 6 moves.' },
  piton: { icon: '🔩', name: 'Piton', blurb: 'Hammer it in: your next fall stops right here.' },
  bar: { icon: '🍫', name: 'Energy bar', blurb: '+40 stamina, whenever you need it.' },
};
export const CHALK_MOVES = 6;
export const BAR_STAMINA = 40;
