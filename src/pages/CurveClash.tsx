import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { mulberry32 } from '../lib/rng';
import { shake } from '../lib/fx';
import { sfx } from '../lib/sfx';

// Curve Clash: two players on one device, each with two gunners on a field of floating islands. On your
// turn, pick a gunner and write a function: the shot follows its curve, starting from the gunner (moved so
// it passes through them) and heading towards the other side. It stops on an island, off the field, or on a
// gunner — friend or foe. The last player with a gunner standing wins.

/** The field, in the curve's units: x from -W to W, y from -H to H. */
const W = 25;
const H = 15;
const STEP = 0.04;
const GUNNER = 0.9;

// ── Functions, read safely (no eval): + - * / ^, brackets, x, numbers, pi, e, and a few functions. ──
type Fn = (x: number) => number;
const FUNCS: Record<string, (v: number) => number> = { sin: Math.sin, cos: Math.cos, tan: Math.tan, abs: Math.abs, sqrt: Math.sqrt, ln: Math.log, log: Math.log10, exp: Math.exp };

function compile(src: string): Fn {
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
interface Gunner {
  id: string;
  player: 0 | 1;
  x: number;
  y: number;
  alive: boolean;
}
interface Island {
  x: number;
  y: number;
  r: number;
}

function newField(seed: number): { gunners: Gunner[]; islands: Island[] } {
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
function fire(f: Fn, from: Gunner, gunners: Gunner[], islands: Island[]): { path: [number, number][]; hit: Gunner | null; why: string } {
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

// ── Drawing: field units to the picture's ──
const PX = 20;
const sx = (x: number) => (x + W) * PX;
const sy = (y: number) => (H - y) * PX;

const PLAYER = [
  { name: 'Blue', color: '#3b82f6' },
  { name: 'Red', color: '#ef4444' },
];

export default function CurveClash() {
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const start = useMemo(() => newField(seed), [seed]);
  const [gunners, setGunners] = useState(start.gunners);
  const [turn, setTurn] = useState<0 | 1>(0);
  const [selected, setSelected] = useState('0-0');
  const [src, setSrc] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [shot, setShot] = useState<{ path: [number, number][]; shown: number; color: string } | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const board = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setGunners(start.gunners);
    setTurn(0);
    setSelected('0-0');
    setShot(null);
    setLog([]);
    setSrc('');
  }, [start]);

  const winner = ([0, 1] as const).find((p) => !gunners.some((g) => g.player !== p && g.alive) && gunners.some((g) => g.player === p && g.alive));
  const mine = gunners.filter((g) => g.player === turn && g.alive);
  const from = mine.find((g) => g.id === selected) ?? mine[0];

  const shoot = () => {
    if (busy || winner !== undefined || !from) return;
    let f: Fn;
    try {
      f = compile(src);
    } catch (e) {
      setError((e as Error).message);
      sfx.wrong();
      return;
    }
    setError(null);
    const r = fire(f, from, gunners, start.islands);
    sfx.whoosh();
    setBusy(true);
    const color = PLAYER[turn].color;
    // The curve drawn out, a little each frame.
    let shown = 0;
    const tick = () => {
      shown = Math.min(r.path.length, shown + 12);
      setShot({ path: r.path, shown, color });
      if (shown < r.path.length) return void requestAnimationFrame(tick);
      const line = `${PLAYER[turn].name}: y = ${src.trim()} — ${r.why}`;
      setLog((l) => [line, ...l].slice(0, 8));
      if (r.hit) {
        sfx.streak();
        shake(board.current, 10, 400);
        setGunners((gs) => gs.map((g) => (g === r.hit ? { ...g, alive: false } : g)));
      } else sfx.click();
      const next = (turn === 0 ? 1 : 0) as 0 | 1;
      window.setTimeout(() => {
        setTurn(next);
        setSelected(`${next}-0`);
        setSrc('');
        setBusy(false);
        field.current?.focus();
      }, 700);
    };
    requestAnimationFrame(tick);
  };

  const ended = winner !== undefined;
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <Link to="/games" className="font-display text-sm font-semibold tracking-wider text-ink-soft hover:text-ink">
          ← Games
        </Link>
        <h1 className="text-5xl font-bold">Curve Clash</h1>
        <p className="max-w-2xl text-sm text-ink-soft">
          Two players, one screen, turn by turn. Pick one of your gunners and write a function of x: the shot follows its curve from your gunner towards the other side,
          over the islands. Knock out both enemy gunners to win — and mind your own.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-display text-lg font-bold" style={{ color: ended ? PLAYER[winner!].color : PLAYER[turn].color }}>
          {ended ? `🏆 ${PLAYER[winner!].name} wins!` : `${PLAYER[turn].name}'s turn`}
        </p>
        <button type="button" onClick={() => (sfx.click(), setSeed(Math.floor(Math.random() * 1e9)))} className="btn-paper rounded-md px-4 py-2 font-display text-sm font-bold">
          New field
        </button>
      </div>

      <div ref={board} className="page overflow-hidden rounded-md">
        <svg viewBox={`0 0 ${2 * W * PX} ${2 * H * PX}`} className="block h-auto w-full bg-[#0f172a]">
          {/* The grid, and the axes through the middle. */}
          {Array.from({ length: 2 * W + 1 }, (_, k) => k - W).filter((v) => v % 5 === 0).map((v) => <line key={`gx${v}`} x1={sx(v)} x2={sx(v)} y1={0} y2={2 * H * PX} stroke="#1e293b" strokeWidth={v === 0 ? 2 : 1} />)}
          {Array.from({ length: 2 * H + 1 }, (_, k) => k - H).filter((v) => v % 5 === 0).map((v) => <line key={`gy${v}`} y1={sy(v)} y2={sy(v)} x1={0} x2={2 * W * PX} stroke="#1e293b" strokeWidth={v === 0 ? 2 : 1} />)}
          {start.islands.map((o, k) => (
            <circle key={k} cx={sx(o.x)} cy={sy(o.y)} r={o.r * PX} fill="#3f6212" stroke="#65a30d" strokeWidth={3} />
          ))}
          {shot && <polyline points={shot.path.slice(0, shot.shown).map(([x, y]) => `${sx(x)},${sy(y)}`).join(' ')} fill="none" stroke={shot.color} strokeWidth={3} strokeLinecap="round" />}
          {gunners.map((g) => {
            const sel = !ended && g.player === turn && g.id === from?.id;
            return (
              <g key={g.id} opacity={g.alive ? 1 : 0.25} onClick={() => g.alive && g.player === turn && !busy && (sfx.select(), setSelected(g.id))} className={g.alive && g.player === turn ? 'cursor-pointer' : ''}>
                {sel && <circle cx={sx(g.x)} cy={sy(g.y)} r={GUNNER * PX + 8} fill="none" stroke="#fde68a" strokeWidth={3} strokeDasharray="6 4" />}
                <circle cx={sx(g.x)} cy={sy(g.y)} r={GUNNER * PX} fill={PLAYER[g.player].color} stroke="#f8fafc" strokeWidth={2} />
                {!g.alive && <text x={sx(g.x)} y={sy(g.y) + 7} textAnchor="middle" fontSize={22} fill="#f8fafc">✕</text>}
              </g>
            );
          })}
        </svg>
      </div>

      {!ended ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            shoot();
          }}
          className="space-y-1"
        >
          <div className="flex gap-2">
            <span className="self-center font-display font-bold" style={{ color: PLAYER[turn].color }}>
              y =
            </span>
            <input
              ref={field}
              value={src}
              onChange={(e) => setSrc(e.target.value)}
              disabled={busy}
              placeholder="e.g. 0.3x, sin(x)*4, x^2/20, -abs(x-10)+5…"
              autoComplete="off"
              spellCheck={false}
              className="min-w-0 flex-1 rounded-md border-2 border-rule-strong bg-card px-4 py-3 font-mono text-lg outline-none focus:border-ink"
            />
            <button type="submit" disabled={busy || !src.trim()} className="btn-ink rounded-md px-5 font-display font-bold tracking-wider disabled:opacity-50">
              Fire ↵
            </button>
          </div>
          {error && <p className="text-sm font-semibold text-coral">{error}</p>}
          <p className="text-xs text-ink-faint">
            Tap one of your gunners to fire from it. x counts forward from your gunner (the curve is moved to start on it). Allowed: + − × / ^, brackets, pi, e, sin, cos, tan,
            abs, sqrt, ln, log, exp.
          </p>
        </form>
      ) : (
        <div className="text-center">
          <button type="button" onClick={() => (sfx.click(), setSeed(Math.floor(Math.random() * 1e9)))} className="btn-ink rounded-md px-6 py-3 font-display font-bold tracking-wider">
            Play again
          </button>
        </div>
      )}

      {log.length > 0 && (
        <ul className="page space-y-1 rounded-md p-3 font-mono text-xs text-ink-soft">
          {log.map((l, k) => (
            <li key={k}>{l}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
