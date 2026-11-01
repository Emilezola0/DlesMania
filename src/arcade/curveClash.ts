// Curve Clash's engine: functions read safely, the field, a shot along a curve, and a whole online game
// replayed from its moves (both players' devices replay the same moves into the same game).
import { mulberry32 } from '../lib/rng';

/** The field, in the curve's units: x from -W to W, y from -H to H. */
export const W = 25;
export const H = 15;
const STEP = 0.04;
export const GUNNER = 0.9;

// ── Functions, read safely (no eval): + - * / ^, brackets, x, numbers, pi, e, and a few functions. ──
export type Fn = (x: number) => number;
const FUNCS: Record<string, (v: number) => number> = { sin: Math.sin, cos: Math.cos, tan: Math.tan, abs: Math.abs, sqrt: Math.sqrt, ln: Math.log, log: Math.log10, exp: Math.exp };

export function compile(src: string): Fn {
  const s = src.replace(/\s+/g, '').toLowerCase().replace(/[−–]/g, '-').replace(/,/g, '.');
  let i = 0;
  const peek = () => s[i];
  const fail = (): never => {
    throw new Error(i < s.length ? `Unexpected “${s[i]}”` : 'The function ends too soon');
  };
  // Implicit multiplication: 2x, 3(x+1), 2sin(x), (x+1)(x-1).
  const startsFactor = () => /[0-9.x(a-z]/.test(peek() ?? '');
  function expr(): Fn {
    let f = term();
    while (peek() === '+' || peek() === '-') {
      const op = s[i++];
      const a = f;
      const b = term();
      f = op === '+' ? (x) => a(x) + b(x) : (x) => a(x) - b(x);
    }
    return f;
  }
  function term(): Fn {
    let f = unary();
    for (;;) {
      if (peek() === '*' || peek() === '/') {
        const op = s[i++];
        const a = f;
        const b = unary();
        f = op === '*' ? (x) => a(x) * b(x) : (x) => a(x) / b(x);
      } else if (startsFactor()) {
        const a = f;
        const b = power();
        f = (x) => a(x) * b(x);
      } else return f;
    }
  }
  function unary(): Fn {
    if (peek() === '-') {
      i++;
      const a = unary();
      return (x) => -a(x);
    }
    if (peek() === '+') (i++);
    return power();
  }
  function power(): Fn {
    const base = atom();
    if (peek() === '^') {
      i++;
      const ex = unary();
      return (x) => Math.pow(base(x), ex(x));
    }
    return base;
  }
  function atom(): Fn {
    const c = peek();
    if (c === '(') {
      i++;
      const f = expr();
      if (peek() !== ')') fail();
      i++;
      return f;
    }
    if (c && /[0-9.]/.test(c)) {
      const m = /^\d*\.?\d+|^\d+\./.exec(s.slice(i));
      if (!m) fail();
      i += m![0].length;
      const v = Number(m![0]);
      return () => v;
    }
    if (c === 'x') {
      i++;
      return (x) => x;
    }
    const word = /^[a-z]+/.exec(s.slice(i))?.[0];
    if (!word) return fail();
    if (word === 'pi') return (i += 2), () => Math.PI;
    if (word === 'e' || (word.startsWith('e') && !FUNCS[word])) {
      i += 1;
      return () => Math.E;
    }
    const fn = FUNCS[word];
    if (!fn) throw new Error(`Unknown function “${word}”`);
    i += word.length;
    if (peek() !== '(') throw new Error(`${word} needs brackets: ${word}(x)`);
    const arg = atom();
    return (x) => fn(arg(x));
  }
  if (!s) throw new Error('Write a function of x');
  const f = expr();
  if (i < s.length) fail();
  return f;
}


// ── The field ──
export interface Gunner {
  id: string;
  player: 0 | 1;
  x: number;
  y: number;
  alive: boolean;
}
export interface Island {
  x: number;
  y: number;
  r: number;
}
/** A hole a shot blew in an island: the ground there is gone. */
export interface Crater {
  x: number;
  y: number;
  r: number;
}
/** Everything on the field at a moment of the game. */
export interface World {
  gunners: Gunner[];
  islands: Island[];
  craters: Crater[];
}

/** The fields, easier to harder: more islands, bigger ones, across the whole field. */
export type Level = 'easy' | 'medium' | 'hard';
export const LEVELS: Record<Level, { label: string; islands: number; min: number; max: number }> = {
  easy: { label: 'Easy', islands: 6, min: 1.2, max: 2.4 },
  medium: { label: 'Medium', islands: 12, min: 1.5, max: 3.2 },
  hard: { label: 'Hard', islands: 20, min: 1.8, max: 4 },
};
/** How big a hole a shot blows in an island. */
export const CRATER = 1.4;

export function newField(seed: number, level: Level = 'medium'): World {
  const rand = mulberry32(seed);
  const between = (a: number, b: number) => a + rand() * (b - a);
  const gunners: Gunner[] = [];
  for (const player of [0, 1] as const)
    for (let k = 0; k < 2; k++) {
      const side = player === 0 ? -1 : 1;
      gunners.push({ id: `${player}-${k}`, player, x: side * between(16, 23), y: between(2, 12) * (k ? 1 : -1), alive: true });
    }
  // Islands anywhere on the field (not only in the middle), none on top of a gunner or another island.
  const { islands: count, min, max } = LEVELS[level];
  const islands: Island[] = [];
  for (let tries = 0; islands.length < count && tries < 2000; tries++) {
    const r = between(min, max);
    const isl = { x: between(-W + 2, W - 2), y: between(-H + 1, H - 1), r };
    if (gunners.some((g) => Math.hypot(g.x - isl.x, g.y - isl.y) < r + 2.5)) continue;
    if (islands.some((o) => Math.hypot(o.x - isl.x, o.y - isl.y) < o.r + r + 0.6)) continue;
    islands.push(isl);
  }
  return { gunners, islands, craters: [] };
}

/** Whether there's ground at a point: on an island, not in a hole. */
export const solid = (w: World, x: number, y: number) => w.islands.some((o) => Math.hypot(o.x - x, o.y - y) < o.r) && !w.craters.some((c) => Math.hypot(c.x - x, c.y - y) < c.r);

/** A shot: its path, what stopped it, and the hole it blew if it hit ground. */
export interface Shot {
  path: [number, number][];
  hit: Gunner | null;
  crater: Crater | null;
  why: string;
}

export function fire(f: Fn, from: Gunner, w: World): Shot {
  const dir = from.player === 0 ? 1 : -1;
  const f0 = f(0);
  const none = { hit: null, crater: null };
  if (!Number.isFinite(f0)) return { path: [], ...none, why: 'The function has no value at the gunner (x = 0)' };
  const path: [number, number][] = [[from.x, from.y]];
  let prev = from.y;
  for (let t = STEP; t < 2 * W + 2; t += STEP) {
    const x = from.x + dir * t;
    // The curve as seen from the gunner, x counted in its direction of fire.
    const y = from.y + f(t) - f0;
    if (!Number.isFinite(y) || Math.abs(y - prev) > 3) return { path, ...none, why: 'The curve breaks off' };
    prev = y;
    path.push([x, y]);
    if (Math.abs(x) > W || Math.abs(y) > H) return { path, ...none, why: 'Off the field' };
    if (solid(w, x, y)) return { path, hit: null, crater: { x, y, r: CRATER }, why: 'Into an island (a hole in it now)' };
    // A gunner: not the one firing, while the shot is still leaving it.
    const g = w.gunners.find((g) => g.alive && (g !== from || t > 2) && Math.hypot(g.x - x, g.y - y) < GUNNER);
    if (g) return { path, hit: g, crater: null, why: g.player === from.player ? 'Friendly fire!' : 'Hit!' };
  }
  return { path, ...none, why: 'Off the field' };
}

/** The field once some shots have landed: the gunners hit fall, the holes are blown. */
export const land = (w: World, shots: Shot[]): World => ({
  gunners: w.gunners.map((g) => (shots.some((s) => s.hit?.id === g.id) ? { ...g, alive: false } : g)),
  islands: w.islands,
  craters: [...w.craters, ...shots.flatMap((s) => (s.crater ? [s.crater] : []))],
});

/** Who won: the side with gunners left, or a draw when both fell together. */
export function winnerOf(w: World): 0 | 1 | 'draw' | null {
  const alive = [0, 1].map((p) => w.gunners.some((g) => g.player === p && g.alive));
  return !alive[0] && !alive[1] ? 'draw' : !alive[0] ? 1 : !alive[1] ? 0 : null;
}

/** A line of the game's history, in its player's colour. */
export interface LogLine {
  player: 0 | 1;
  text: string;
}

/** A player's move: a function from one of their gunners, or nothing (time ran out). */
export interface Move {
  f?: string;
  g?: string;
  pass?: boolean;
}

/** One player's move played on a field: its shot (null: no shot) and its line of history. */
export function play(w: World, player: 0 | 1, m: Move): { shot: Shot | null; line: LogLine } {
  const name = player === 0 ? 'Blue' : 'Red';
  if (m.pass || !m.f) return { shot: null, line: { player, text: `${name}: no shot` } };
  const mine = w.gunners.filter((g) => g.player === player && g.alive);
  const from = mine.find((g) => g.id === m.g) ?? mine[0];
  if (!from) return { shot: null, line: { player, text: `${name}: no gunner left` } };
  let f: Fn;
  try {
    f = compile(m.f);
  } catch {
    return { shot: null, line: { player, text: `${name}: y = ${m.f} — can't be read` } };
  }
  const shot = fire(f, from, w);
  return { shot, line: { player, text: `${name}: y = ${m.f} — ${shot.why}` } };
}

// ── An online game: rounds where both players fire at once ──
/** A round: Blue's move (a) and Red's (b). */
export interface Round {
  a?: Move;
  b?: Move;
}
export interface Replayed {
  world: World;
  /** The last round's shots, to draw. */
  last: { path: [number, number][]; player: 0 | 1 }[];
  log: LogLine[];
  /** Rounds played to the end. */
  played: number;
  winner: 0 | 1 | 'draw' | null;
}

/** The game from its seed and rounds: both shots of a round fly at once, their hits and holes counted after. */
export function replay(seed: number, rounds: Round[], level: Level = 'medium'): Replayed {
  let world = newField(seed, level);
  const log: LogLine[] = [];
  let last: Replayed['last'] = [];
  let played = 0;
  for (const r of rounds) {
    if (!r.a || !r.b || winnerOf(world) !== null) break;
    played++;
    const both = ([r.a, r.b] as Move[]).map((m, p) => play(world, p as 0 | 1, m));
    last = both.flatMap((b, p) => (b.shot ? [{ path: b.shot.path, player: p as 0 | 1 }] : []));
    log.unshift(...both.map((b) => b.line).reverse());
    world = land(world, both.flatMap((b) => (b.shot ? [b.shot] : [])));
  }
  return { world, last, log: log.slice(0, 12), played, winner: winnerOf(world) };
}

// ── The computer: it works out a curve through an enemy gunner, from the simplest kind of function up ──
const num = (v: number) => {
  const r = Math.round(v * 10000) / 10000;
  return r === 0 ? '0' : String(r);
};
/** "a*x + b" written plainly ("0.25x - 0.01x^2"). */
const sum = (terms: string[]) => terms.filter((t) => !/^0(\D|$)/.test(t)).join(' + ').replace(/\+ -/g, '- ') || '0';

/** A move that hits one of the other side's gunners, or the best try when none can be found. */
export function aiMove(w: World, player: 0 | 1): Move {
  const mine = w.gunners.filter((g) => g.player === player && g.alive);
  const targets = w.gunners.filter((g) => g.player !== player && g.alive);
  let fallback: Move | null = null;
  for (const from of mine)
    for (const to of targets) {
      const dx = Math.abs(to.x - from.x);
      const dy = to.y - from.y;
      const tries: string[] = [];
      const k = dy / dx;
      // A straight line, then curves that all pass through the target: parabolas, cubics, waves, and waves on parabolas.
      tries.push(sum([`${num(k)}x`]));
      const bends = [0.003, 0.006, 0.01, 0.015, 0.02, 0.03, 0.045, 0.065, 0.09].flatMap((c) => [c, -c]);
      for (const c of bends) tries.push(sum([`${num((dy - c * dx * dx) / dx)}x`, `${num(c)}x^2`]));
      for (const c of bends) tries.push(sum([`${num(k)}x`, `${num(c / dx)}x^2(x-${num(dx)})`]));
      for (const n of [1, 2, 3, 4, 5])
        for (const a of [1.5, 3, 5, 7, 10].flatMap((v) => [v, -v])) tries.push(sum([`${num(k)}x`, `${a}sin(${num((n * Math.PI) / dx)}x)`]));
      for (const c of [0.01, -0.01, 0.03, -0.03])
        for (const n of [1, 2, 3])
          for (const a of [3, -3, 6, -6]) tries.push(sum([`${num((dy - c * dx * dx) / dx)}x`, `${num(c)}x^2`, `${a}sin(${num((n * Math.PI) / dx)}x)`]));
      for (const t of tries) {
        const shot = fire(compile(t), from, w);
        if (shot.hit && shot.hit.player !== player) return { f: t, g: from.id };
        // Next best: a shot that blows a hole on the way to the target.
        if (!fallback && shot.crater) fallback = { f: t, g: from.id };
      }
    }
  return fallback ?? { f: '0', g: mine[0]?.id };
}
