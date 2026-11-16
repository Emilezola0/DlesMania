// The dungeon's mobs, the same for everyone on an island (src/island/IslandView.tsx). Nothing about where they are is
// ever sent: each mob follows its pattern on a shared clock (the Realtime Database's), so every player there sees it
// at the same spot doing the same thing. Only their life is shared (src/cloud/dmobs.ts: dmobs/<owner>/<week>/<id>):
// a hit lowers it for all, a mob slain is gone for all until it comes back (RESPAWN).
//
// Each kind has one move of its own, always shown before it lands (its "tell", "tele" below) and followed by a moment
// it's dizzy ("open": hits there count double). Read it, dodge it (jump, or dash: Shift), then strike:
//  - the skeleton (the crypt) stops, rattles, and throws a bone in an arc ahead of it;
//  - the frost slime (the frozen caves) squashes down, then slams: frost runs along the floor around it: jump;
//  - the cave spider (the overgrown ruins) waits on the ceiling, shakes, and drops where its shadow shows;
//  - the fire imp (the magma depths) flies, glows, and shoots a fireball down ahead of it;
//  - the Magma Lord (the boss) pounds the ground (a wave of lava runs both ways: jump it), and calls down meteors on
//    the spots it marks; under half its life, faster, and more meteors.
import { MOBS } from './combat';

export interface Mob {
  id: string;
  kind: string;
  /** Its patrol, along its room's floor (its left edge, in cells), the row it stands on, its room's ceiling row. */
  x0: number;
  x1: number;
  y: number;
  top: number;
}
/** A mob's shared life: hp left; slain (when); the boss: fallen (when, its question being answered), who hit it. */
export interface MobState {
  hp: number;
  dead?: number;
  fallen?: number;
  hitters?: Record<string, boolean>;
}
/** How long a slain mob stays gone, and the beaten boss (ms); a fallen boss whose question nobody answers gets up. */
export const RESPAWN = 3 * 60_000;
export const BOSS_RESPAWN = 10 * 60_000;
export const FALLEN_FOR = 60_000;

export type Phase = 'move' | 'tele' | 'act' | 'open' | 'fallen';
/** Something a mob throws or makes (cells): it hurts if `hurts`, else it only shows what's coming. */
export interface Hazard {
  kind: 'bone' | 'ring' | 'frost' | 'shadow' | 'thread' | 'fireball' | 'burst' | 'wave' | 'mark' | 'meteor';
  x: number;
  y: number;
  w: number;
  h: number;
  hurts: boolean;
  /** Turned (degrees), for a bone spinning. */
  rot?: number;
}
export interface MobPose {
  /** Its body's box (cells). */
  x: number;
  y: number;
  size: number;
  dir: 1 | -1;
  phase: Phase;
  hazards: Hazard[];
}

/** A number from a mob's id, so each starts its pattern at its own moment. */
function seedOf(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10_000) / 1000;
}

/** Back and forth along x0..x1 after walking `walked` cells. */
function patrol(walked: number, x0: number, x1: number): { x: number; dir: 1 | -1 } {
  const L = Math.max(0.01, x1 - x0);
  const s = ((walked % (2 * L)) + 2 * L) % (2 * L);
  return s < L ? { x: x0 + s, dir: 1 } : { x: x0 + 2 * L - s, dir: -1 };
}

/** A pattern's cycle: where in it we are, and how long it has walked so far (walking `walk` seconds a cycle). */
function cycle(t: number, len: number, walk: number) {
  const n = Math.floor(t / len);
  const ph = t - n * len;
  return { n, ph, walked: n * walk + Math.min(ph, walk) };
}

/** A small hash of numbers (0–1): which spots the boss marks in a cycle. */
const rand = (a: number, b: number) => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/** The skeleton's bone, thrown at `at` (seconds into its flight `f`). */
function bone(x: number, y: number, dir: 1 | -1, f: number, x0: number, x1: number): Hazard | null {
  if (f < 0 || f > 1.5) return null;
  const bx = x + 0.5 + dir * (0.3 + 5.5 * f);
  const by = y + 0.15 - 5.2 * f + 7 * f * f;
  if (by > y + 0.85 || bx < x0 - 0.5 || bx > x1 + 1.5) return null;
  return { kind: 'bone', x: bx - 0.22, y: by - 0.22, w: 0.44, h: 0.44, hurts: true, rot: f * 900 * dir };
}

/** The imp's fireball, shot at its spot, `f` seconds ago: down and ahead, then a burst on the floor. */
function fireball(x: number, y: number, dir: 1 | -1, f: number, floor: number): Hazard | null {
  if (f < 0) return null;
  const fall = floor - (y + 0.5);
  const land = fall / 5;
  if (f < land) return { kind: 'fireball', x: x + 0.5 + dir * 4 * f - 0.25, y: y + 0.5 + 5 * f - 0.25, w: 0.5, h: 0.5, hurts: true };
  if (f < land + 0.35) return { kind: 'burst', x: x + 0.5 + dir * 4 * land - 0.6, y: floor - 0.7, w: 1.2, h: 0.7, hurts: true };
  return null;
}

/** Where a mob is and what it's doing at `ms` (the shared clock), its life (0–1), as everyone sees it. */
export function mobAt(m: Mob, ms: number, life: number, state?: MobState): MobPose {
  const t = ms / 1000 + seedOf(m.id);
  const floor = m.y + 1;
  const hz: Hazard[] = [];
  if (m.kind === 'boss') return bossAt(m, t, life, state);
  if (m.kind === 'crypt') {
    // Walk 2.8 s, rattle 0.55 s, throw, dizzy 0.85 s.
    const C = 4.2;
    const { n, ph, walked } = cycle(t, C, 2.8);
    const { x, dir } = patrol(walked * MOBS.crypt.speed, m.x0, m.x1);
    const phase: Phase = ph < 2.8 ? 'move' : ph < 3.35 ? 'tele' : 'open';
    // This cycle's bone, and the last one's (still flying).
    for (const k of [n, n - 1]) {
      const end = patrol((k * 2.8 + 2.8) * MOBS.crypt.speed, m.x0, m.x1);
      const b = bone(end.x, m.y, end.dir, t - (k * C + 3.35), m.x0, m.x1);
      if (b) hz.push(b);
    }
    return { x, y: m.y + 0.08, size: 0.92, dir, phase, hazards: hz };
  }
  if (m.kind === 'ice') {
    // Hop about 3 s, squash 0.75 s (the ring shows how far), slam (frost along the floor), dizzy.
    const C = 4.6;
    const { ph, walked } = cycle(t, C, 3);
    const { x, dir } = patrol(walked * MOBS.ice.speed, m.x0, m.x1);
    const R = 2.6;
    let phase: Phase = 'open';
    let hop = 0;
    if (ph < 3) {
      phase = 'move';
      hop = Math.abs(Math.sin(ph * Math.PI * 1.6)) * 0.45;
    } else if (ph < 3.75) {
      phase = 'tele';
      hz.push({ kind: 'ring', x: x + 0.5 - R, y: floor - 0.35, w: R * 2, h: 0.5, hurts: false });
    } else if (ph < 4.1) {
      phase = 'act';
      const grow = Math.min(1, (ph - 3.75) / 0.12);
      hz.push({ kind: 'frost', x: x + 0.5 - R * grow, y: floor - 0.5, w: R * 2 * grow, h: 0.5, hurts: true });
    }
    return { x, y: m.y + 0.08 - hop, size: 0.92, dir, phase, hazards: hz };
  }
  if (m.kind === 'jungle') {
    // On the ceiling 2.8 s, shaking 0.5 s (its shadow below), the drop, 1.1 s on the floor (dizzy), back up 0.55 s.
    const C = 5.2;
    const { ph, walked } = cycle(t, C, 2.8);
    const { x, dir } = patrol(walked * MOBS.jungle.speed * 0.6, m.x0, m.x1);
    const high = m.top + 0.02;
    const low = m.y + 0.08;
    let y = high;
    let phase: Phase = 'move';
    let shake = 0;
    if (ph < 2.8) y = high;
    else if (ph < 3.3) {
      phase = 'tele';
      shake = Math.sin(ph * 60) * 0.06;
      hz.push({ kind: 'shadow', x: x + 0.05, y: floor - 0.18, w: 0.9, h: 0.22, hurts: false });
    } else if (ph < 3.55) {
      phase = 'act';
      y = high + (low - high) * ((ph - 3.3) / 0.25) ** 2;
    } else if (ph < 4.65) {
      phase = 'open';
      y = low;
    } else y = low + (high - low) * ((ph - 4.65) / 0.55);
    if (y > high + 0.1 || phase === 'tele') hz.push({ kind: 'thread', x: x + 0.47, y: m.top, w: 0.06, h: Math.max(0, y - m.top + 0.3), hurts: false });
    return { x: x + shake, y, size: 0.92, dir, phase, hazards: hz };
  }
  // The fire imp: flies 2.4 s, glows 0.6 s, shoots, hovers 0.8 s.
  const C = 3.8;
  const { n, ph, walked } = cycle(t, C, 2.4);
  const { x, dir } = patrol(walked * MOBS.magma.speed, m.x0, m.x1);
  const y = m.y - 1.1 + Math.sin(t * 2.4) * 0.25;
  const phase: Phase = ph < 2.4 ? 'move' : ph < 3 ? 'tele' : 'open';
  for (const k of [n, n - 1]) {
    const at = patrol((k * 2.4 + 2.4) * MOBS.magma.speed, m.x0, m.x1);
    const ay = m.y - 1.1 + Math.sin((k * C + 3) * 2.4) * 0.25;
    const f = fireball(at.x, ay, at.dir, t - (k * C + 3), floor);
    if (f) hz.push(f);
  }
  return { x, y, size: 0.92, dir, phase, hazards: hz };
}

/** The Magma Lord's fight. */
function bossAt(m: Mob, t: number, life: number, state?: MobState): MobPose {
  const size = 1.9;
  const floor = m.y + 1;
  const y = floor - size;
  const span = { x0: m.x0, x1: Math.max(m.x0, m.x1 - (size - 1)) };
  if (state?.fallen) return { x: (m.x0 + m.x1) / 2 - size / 2 + 0.5, y: floor - size * 0.55, size, dir: 1, phase: 'fallen', hazards: [] };
  // Under half its life: everything faster, more meteors.
  const fast = life <= 0.5;
  const k = fast ? 0.75 : 1;
  const C = 9 * k;
  const n = Math.floor(t / C);
  const ph = (t - n * C) / k;
  // Walking: 0–2.5, 4.3–5.8, 7.3–9 (in its slow seconds).
  const walkedIn = (p: number) => Math.min(p, 2.5) + Math.max(0, Math.min(p, 5.8) - 4.3) + Math.max(0, p - 7.3);
  const walked = n * 4.2 + walkedIn(ph);
  const { x, dir } = patrol(walked * MOBS.boss.speed, span.x0, span.x1);
  const cx = x + size / 2;
  const hz: Hazard[] = [];
  let phase: Phase = 'move';
  if (ph >= 2.5 && ph < 3.3) {
    phase = 'tele';
    hz.push({ kind: 'ring', x: m.x0 - 0.5, y: floor - 0.35, w: m.x1 - m.x0 + 2, h: 0.5, hurts: false });
  } else if (ph >= 3.3 && ph < 4.3) phase = 'open';
  // The ground pound's waves, running both ways along the floor.
  const f = ph - 3.3;
  if (f >= 0 && f < 1.4)
    for (const d of [-1, 1]) {
      const wx = cx + d * 7 * f;
      if (wx > m.x0 - 1 && wx < m.x1 + 2) hz.push({ kind: 'wave', x: wx - 0.35, y: floor - 0.75, w: 0.7, h: 0.75, hurts: true });
    }
  // The meteors: the spots marked 5.8–6.8, falling 6.8–7.15, burning 7.15–7.4.
  if (ph >= 5.8 && ph < 7.4) {
    if (ph < 6.8) phase = 'tele';
    const count = fast ? 5 : 3;
    for (let i = 0; i < count; i++) {
      const sx = m.x0 + 0.5 + rand(n, i) * (m.x1 - m.x0);
      if (ph < 6.8) hz.push({ kind: 'mark', x: sx - 0.5, y: floor - 0.3, w: 1, h: 0.3, hurts: false });
      else if (ph < 7.15) {
        const fy = m.top + (floor - m.top) * ((ph - 6.8) / 0.35);
        hz.push({ kind: 'meteor', x: sx - 0.35, y: fy - 0.7, w: 0.7, h: 0.7, hurts: true });
      } else hz.push({ kind: 'burst', x: sx - 0.6, y: floor - 0.8, w: 1.2, h: 0.8, hurts: true });
    }
  }
  return { x, y, size, dir, phase, hazards: hz };
}

/** A mob's life as it stands (back to full once its time away is over). */
export function lifeOf(m: Mob, s: MobState | undefined, now: number): MobState {
  const max = MOBS[m.kind].hp;
  if (!s) return { hp: max };
  if (s.dead) return now - s.dead > (m.kind === 'boss' ? BOSS_RESPAWN : RESPAWN) ? { hp: max } : s;
  if (s.fallen && now - s.fallen > FALLEN_FOR) return { hp: Math.ceil(max * 0.4), hitters: s.hitters };
  return s;
}

/** What a hit did: slain, or (the boss) fallen; `null`: missed (already gone). */
export interface HitResult {
  slain: boolean;
  fell: boolean;
  state: MobState;
}
/** Where the mobs' lives are kept: the island's, shared (src/cloud/dmobs.ts), or this tab's alone. */
export interface MobBoard {
  /** The lives as they stand (by mob id). */
  states: () => Record<string, MobState>;
  /** The shared clock (ms): the server's when online. */
  now: () => number;
  hit: (m: Mob, damage: number, uid: string) => Promise<HitResult | null>;
  /** The fallen boss's question answered. */
  answer: (m: Mob, right: boolean) => Promise<void>;
  /** The puzzle doors someone opened this week (their cells): open for everyone there. */
  doors: () => number[];
  /** A puzzle door opened (its cells). */
  openDoor: (cells: number[]) => Promise<void>;
  /** Told whenever a life (or a door) changes. */
  listen: (on: () => void) => () => void;
  stop: () => void;
}

/** A hit, worked out on a life (also how the shared board's transaction does it). */
export function applyHit(m: Mob, cur: MobState | undefined, damage: number, uid: string, now: number): HitResult | null {
  const s = lifeOf(m, cur, now);
  if (s.dead || s.fallen || s.hp <= 0) return null;
  const hp = Math.max(0, s.hp - damage);
  const boss = m.kind === 'boss';
  const next: MobState = { hp };
  if (boss) next.hitters = { ...(s.hitters ?? {}), [uid]: true };
  if (hp <= 0) {
    if (boss) next.fallen = now;
    else next.dead = now;
  }
  return { slain: hp <= 0 && !boss, fell: hp <= 0 && boss, state: next };
}
/** The fallen boss's answer, worked out: right, it's beaten (gone a while); wrong, it gets back up. */
export function applyAnswer(m: Mob, cur: MobState | undefined, right: boolean, now: number, back: number): MobState | undefined {
  if (!cur?.fallen) return cur;
  if (right) return { hp: 0, dead: now, hitters: cur.hitters };
  return { hp: Math.ceil(MOBS[m.kind].hp * back), hitters: cur.hitters };
}

/** This tab's own board (offline, the demo, or the database not answering). */
export function localBoard(back: number): MobBoard {
  const lives: Record<string, MobState> = {};
  const fans = new Set<() => void>();
  const tell = () => fans.forEach((f) => f());
  return {
    states: () => lives,
    now: () => Date.now(),
    hit: async (m, damage, uid) => {
      const r = applyHit(m, lives[m.id], damage, uid, Date.now());
      if (r) (lives[m.id] = r.state), tell();
      return r;
    },
    answer: async (m, right) => {
      const s = applyAnswer(m, lives[m.id], right, Date.now(), back);
      if (s) lives[m.id] = s;
      tell();
    },
    // (Alone, a door opened is kept in the player's own save.)
    doors: () => [],
    openDoor: async () => {},
    listen: (on) => (fans.add(on), () => void fans.delete(on)),
    stop: () => fans.clear(),
  };
}
