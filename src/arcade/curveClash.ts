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

export function newField(seed: number): { gunners: Gunner[]; islands: Island[] } {
  const rand = mulberry32(seed);
  const between = (a: number, b: number) => a + rand() * (b - a);
  const gunners: Gunner[] = [];
  for (const player of [0, 1] as const)
    for (let k = 0; k < 2; k++) {
      const side = player === 0 ? -1 : 1;
      gunners.push({ id: `${player}-${k}`, player, x: side * between(15, 23), y: between(-11, 11) * (k ? 1 : -1), alive: true });
    }
  // Islands in the middle ground, none on top of a gunner.
  const islands: Island[] = [];
  for (let tries = 0; islands.length < 9 && tries < 400; tries++) {
    const isl = { x: between(-12, 12), y: between(-12, 12), r: between(1.4, 3.4) };
    if (gunners.some((g) => Math.hypot(g.x - isl.x, g.y - isl.y) < isl.r + 3)) continue;
    if (islands.some((o) => Math.hypot(o.x - isl.x, o.y - isl.y) < o.r + isl.r + 1)) continue;
    islands.push(isl);
  }
  return { gunners, islands };
}

/** A shot: its path, and what stopped it. */
export function fire(f: Fn, from: Gunner, gunners: Gunner[], islands: Island[]): { path: [number, number][]; hit: Gunner | null; why: string } {
  const dir = from.player === 0 ? 1 : -1;
  const f0 = f(0);
  if (!Number.isFinite(f0)) return { path: [], hit: null, why: 'The function has no value at the gunner (x = 0)' };
  const path: [number, number][] = [[from.x, from.y]];
  let prev = from.y;
  for (let t = STEP; t < 2 * W + 2; t += STEP) {
    const x = from.x + dir * t;
    // The curve as seen from the gunner, x counted in its direction of fire.
    const y = from.y + f(t) - f0;
    if (!Number.isFinite(y) || Math.abs(y - prev) > 3) return { path, hit: null, why: 'The curve breaks off' };
    prev = y;
    path.push([x, y]);
    if (Math.abs(x) > W || Math.abs(y) > H) return { path, hit: null, why: 'Off the field' };
    const isl = islands.find((o) => Math.hypot(o.x - x, o.y - y) < o.r);
    if (isl) return { path, hit: null, why: 'Into an island' };
    // A gunner: not the one firing, while the shot is still leaving it.
    const g = gunners.find((g) => g.alive && (g !== from || t > 2) && Math.hypot(g.x - x, g.y - y) < GUNNER);
    if (g) return { path, hit: g, why: g.player === from.player ? 'Friendly fire!' : 'Hit!' };
  }
  return { path, hit: null, why: 'Off the field' };
}

// ── An online game: rounds where both players fire at once ──
/** A player's move in a round: a function from one of their gunners, or nothing (time ran out). */
export interface Move {
  f?: string;
  g?: string;
  pass?: boolean;
}
/** A round: Blue's move (a) and Red's (b). */
export interface Round {
  a?: Move;
  b?: Move;
}
export interface Replayed {
  gunners: Gunner[];
  islands: Island[];
  /** The last round's shots, to draw. */
  last: { path: [number, number][]; player: 0 | 1 }[];
  log: string[];
  /** Rounds played to the end. */
  played: number;
  winner: 0 | 1 | 'draw' | null;
}

/** The game from its seed and rounds: both shots of a round fly at once, their hits counted after. */
export function replay(seed: number, rounds: Round[]): Replayed {
  const { gunners: start, islands } = newField(seed);
  let gunners = start.map((g) => ({ ...g }));
  const log: string[] = [];
  let last: Replayed['last'] = [];
  let played = 0;
  const winnerOf = (gs: Gunner[]) => {
    const alive = [0, 1].map((p) => gs.some((g) => g.player === p && g.alive));
    return !alive[0] && !alive[1] ? 'draw' : !alive[0] ? 1 : !alive[1] ? 0 : null;
  };
  for (const r of rounds) {
    if (!r.a || !r.b || winnerOf(gunners) !== null) break;
    played++;
    const hits = new Set<string>();
    last = [];
    ([r.a, r.b] as Move[]).forEach((m, p) => {
      const name = p === 0 ? 'Blue' : 'Red';
      if (m.pass || !m.f) return void log.unshift(`${name}: no shot`);
      const mine = gunners.filter((g) => g.player === p && g.alive);
      const from = mine.find((g) => g.id === m.g) ?? mine[0];
      if (!from) return;
      let f: Fn;
      try {
        f = compile(m.f);
      } catch {
        return void log.unshift(`${name}: y = ${m.f} — can't be read`);
      }
      const shot = fire(f, from, gunners, islands);
      last.push({ path: shot.path, player: p as 0 | 1 });
      if (shot.hit) hits.add(shot.hit.id);
      log.unshift(`${name}: y = ${m.f} — ${shot.why}`);
    });
    gunners = gunners.map((g) => (hits.has(g.id) ? { ...g, alive: false } : g));
  }
  return { gunners, islands, last, log: log.slice(0, 10), played, winner: winnerOf(gunners) };
}
