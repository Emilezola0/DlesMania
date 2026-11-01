import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CurveClashOnline } from './CurveClashOnline';
import { GUNNER, H, W, compile, fire, newField, type Fn } from '../arcade/curveClash';
import { shake } from '../lib/fx';
import { sfx } from '../lib/sfx';

// Curve Clash: two players on one device, each with two gunners on a field of floating islands. On your
// turn, pick a gunner and write a function: the shot follows its curve, starting from the gunner (moved so
// it passes through them) and heading towards the other side. It stops on an island, off the field, or on a
// gunner — friend or foe. The last player with a gunner standing wins.

// ── Drawing: field units to the picture's ──
const PX = 20;
const sx = (x: number) => (x + W) * PX;
const sy = (y: number) => (H - y) * PX;

const PLAYER = [
  { name: 'Blue', color: '#3b82f6' },
  { name: 'Red', color: '#ef4444' },
];

function SameScreen() {
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
    <div className="space-y-4">
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

/** /curve-clash: online (both players at once, each on their own device), or on one screen, turn by turn. */
export default function CurveClash() {
  const [mode, setMode] = useState<'online' | 'local'>('online');
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <Link to="/games" className="font-display text-sm font-semibold tracking-wider text-ink-soft hover:text-ink">
          ← Games
        </Link>
        <h1 className="text-5xl font-bold">Curve Clash</h1>
        <p className="max-w-2xl text-sm text-ink-soft">
          Pick one of your gunners and write a function of x: the shot follows its curve from your gunner towards the other side, over the islands. Knock out both enemy
          gunners to win — and mind your own. Online, both players write at once and both shots fly together.
        </p>
      </div>
      <div className="flex gap-2">
        {(['online', 'local'] as const).map((m) => (
          <button key={m} type="button" aria-pressed={mode === m} onClick={() => (sfx.click(), setMode(m))} className={`rounded-full border-2 px-4 py-1.5 text-sm font-semibold ${mode === m ? 'border-ink bg-ink text-paper' : 'border-rule-strong bg-card text-ink-soft hover:border-ink'}`}>
            {m === 'online' ? '🌐 Online, at the same time' : '🖥 One screen, turn by turn'}
          </button>
        ))}
      </div>
      {mode === 'online' ? <CurveClashOnline /> : <SameScreen />}
    </div>
  );
}
