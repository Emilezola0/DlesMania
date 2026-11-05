import { useEffect, useMemo, useRef, useState } from 'react';
import { Coins, DleCoin } from '../components/DleCoin';
import { celebrate, celebrateBig } from '../lib/fx';
import { sfx } from '../lib/sfx';
import { econToday, useProgress } from '../store/progress';
import { PACHINKO, PACHINKO_ROWS, type Ball } from './casino';

// The board, in SVG units: a triangle of pegs, a pocket under each gap at the bottom.
const S = 22;
const GAP = 22;
const TOP = 26;
const W = (PACHINKO_ROWS + 3) * S;
const CX = W / 2;
const PEG_R = 2.6;
const BALL_R = 5;
const pegY = (row: number) => TOP + 18 + row * GAP;
const BOTTOM = pegY(PACHINKO_ROWS) + 6;
const H = BOTTOM + 34;
/** Where a ball is above a row, from the rights it has taken so far. */
const xAt = (rights: number, row: number) => CX + (rights - row / 2) * S;
const pocketX = (k: number) => CX + (k - PACHINKO_ROWS / 2) * S;
/** One row's fall, and the first drop from the launcher (ms). */
const ROW_MS = 115;
const FIRST_MS = 260;
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** A pocket's colour by what it pays: the rich ends gold and red, the middle cool. */
function pocketColor(coins: number) {
  const x = coins / PACHINKO.cost;
  return x >= 50 ? '#fbbf24' : x >= 10 ? '#f87171' : x >= 2 ? '#c084fc' : x >= 1 ? '#60a5fa' : '#475569';
}
const short = (n: number) => (n >= 1000 ? `${+(n / 1000).toFixed(1)}k` : `${n}`);

/** A ball's place on the board `t` ms after it was dropped (null once it's in its pocket). */
function ballAt(b: Ball, t: number): { x: number; y: number } | null {
  if (t < FIRST_MS) {
    const u = t / FIRST_MS;
    return { x: CX, y: TOP - 14 + (pegY(0) - BALL_R - PEG_R - TOP + 14) * u * u };
  }
  const step = (t - FIRST_MS) / ROW_MS;
  const i = Math.floor(step);
  if (i >= PACHINKO_ROWS) return null;
  const u = step - i;
  const rights = b.path.slice(0, i).reduce<number>((s, d) => s + d, 0);
  const x0 = xAt(rights, i);
  const x1 = i + 1 < PACHINKO_ROWS ? xAt(rights + b.path[i], i + 1) : pocketX(rights + b.path[i]);
  const y0 = pegY(i) - BALL_R - PEG_R;
  const y1 = i + 1 < PACHINKO_ROWS ? pegY(i + 1) - BALL_R - PEG_R : BOTTOM + 12;
  // Off the peg, a little hop up, then falling to the next one.
  return { x: x0 + (x1 - x0) * u, y: y0 + (y1 - y0) * u * u - 7 * Math.sin(Math.PI * u) * (1 - u) };
}
const flightMs = FIRST_MS + PACHINKO_ROWS * ROW_MS;

export function Pachinko() {
  const coins = useProgress((s) => s.coins);
  const drop = useProgress((s) => s.dropBalls);
  const meter = useProgress((s) => s.casinoMeter ?? 0);
  const tokens = useProgress((s) => s.capsuleTokens ?? 0);
  const used = econToday(useProgress((s) => s.econ)).balls ?? 0;
  const left = Math.max(0, PACHINKO.dailyBalls - used);
  const [flying, setFlying] = useState<{ id: number; b: Ball; t0: number }[]>([]);
  const [hits, setHits] = useState<Record<number, number>>({});
  const [tally, setTally] = useState<{ spent: number; won: number } | null>(null);
  const dots = useRef(new Map<number, SVGCircleElement>());
  const nextId = useRef(1);
  const pegs = useMemo(() => Array.from({ length: PACHINKO_ROWS }, (_, row) => Array.from({ length: row + 1 }, (_, j) => ({ x: xAt(j, row), y: pegY(row) }))).flat(), []);

  const go = (n: number) => {
    const out = drop(n);
    if (!out) return;
    sfx.click();
    const now = performance.now();
    setTally((t) => ({ spent: (t && flying.length ? t.spent : 0) + PACHINKO.cost * n, won: t && flying.length ? t.won : 0 }));
    if (reducedMotion()) {
      out.forEach((b) => land(b));
      return;
    }
    setFlying((f) => [...f, ...out.map((b, k) => ({ id: nextId.current++, b, t0: now + k * 150 }))]);
  };
  const land = (b: Ball) => {
    setHits((h) => ({ ...h, [b.pocket]: Date.now() }));
    setTally((t) => (t ? { ...t, won: t.won + b.coins } : t));
    const x = b.coins / PACHINKO.cost;
    if (x >= 50) (celebrateBig(), sfx.coins(14));
    else if (x >= 10) (celebrate(), sfx.coins(8));
    else if (x >= 1) sfx.coins(2);
    else sfx.tick();
  };

  // The balls move every frame, straight on their SVG circles (no re-render per frame).
  useEffect(() => {
    if (!flying.length) return;
    let raf = 0;
    const lastRow = new Map<number, number>();
    const loop = () => {
      const now = performance.now();
      const done: number[] = [];
      for (const f of flying) {
        const t = now - f.t0;
        const el = dots.current.get(f.id);
        const p = t < 0 ? null : ballAt(f.b, t);
        if (t >= flightMs) done.push(f.id);
        if (el) {
          el.style.opacity = p ? '1' : '0';
          if (p) (el.setAttribute('cx', `${p.x}`), el.setAttribute('cy', `${p.y}`));
        }
        // A tick on each peg, for the first ball in the air only (ten at once would just buzz).
        if (f === flying[0] && t > FIRST_MS) {
          const row = Math.floor((t - FIRST_MS) / ROW_MS);
          if (row !== lastRow.get(f.id) && row < PACHINKO_ROWS) (lastRow.set(f.id, row), sfx.wheelTick(1.4 - row * 0.04));
        }
      }
      if (done.length) {
        for (const id of done) {
          const f = flying.find((x) => x.id === id);
          if (f) land(f.b);
        }
        setFlying((all) => all.filter((x) => !done.includes(x.id)));
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flying]);

  const fill = Math.min(1, meter / PACHINKO.meter);
  return (
    <div className="mx-auto w-full max-w-sm">
      <div className="pachinko-cabinet relative rounded-2xl p-3 text-white">
        {/* The meter: coins played fill it; full, a free capsule. */}
        <div className="mb-2 flex items-center gap-2">
          <div className="relative h-5 flex-1 overflow-hidden rounded-full border-2 border-[#fbbf24]/70 bg-[#0b0820]">
            <div className="pachinko-meter absolute inset-y-0 left-0 rounded-full" style={{ width: `${fill * 100}%` }} />
            <span className="absolute inset-0 grid place-items-center text-[10px] font-bold tabular-nums">
              {meter.toLocaleString('en')} / {PACHINKO.meter.toLocaleString('en')}
            </span>
          </div>
          <span title={tokens ? `${tokens} free capsule${tokens > 1 ? 's' : ''} waiting at the capsule machine` : 'Fill the meter for a free capsule'} className={`relative grid size-9 place-items-center rounded-lg border-2 text-lg ${tokens ? 'animate-pulse border-[#fbbf24] bg-[#3b2a07]' : 'border-white/20 bg-[#0b0820] opacity-70'}`}>
            🥚{tokens > 1 && <span className="absolute translate-x-3 translate-y-3 text-[10px] font-black">×{tokens}</span>}
          </span>
        </div>
        <div className="relative overflow-hidden rounded-xl border-4 border-[#fbbf24]/80 bg-[#1e1250]">
          <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label="Pachinko board">
            <defs>
              <radialGradient id="pk-bg" cx="50%" cy="40%" r="70%">
                <stop offset="0" stopColor="#4c2a9e" />
                <stop offset="1" stopColor="#1a0f45" />
              </radialGradient>
              <radialGradient id="pk-ball" cx="35%" cy="30%" r="70%">
                <stop offset="0" stopColor="#fff" />
                <stop offset="0.5" stopColor="#d1d5db" />
                <stop offset="1" stopColor="#6b7280" />
              </radialGradient>
            </defs>
            <rect width={W} height={H} fill="url(#pk-bg)" />
            {/* A faint target behind the pegs, and the launcher at the top. */}
            <circle cx={CX} cy={pegY(PACHINKO_ROWS / 2)} r={W * 0.3} fill="none" stroke="#ffffff10" strokeWidth={10} />
            <circle cx={CX} cy={pegY(PACHINKO_ROWS / 2)} r={W * 0.16} fill="none" stroke="#ffffff0c" strokeWidth={6} />
            <path d={`M ${CX - 14} 4 L ${CX - 7} ${TOP} L ${CX + 7} ${TOP} L ${CX + 14} 4 Z`} fill="#fbbf24" opacity={0.85} />
            {pegs.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={PEG_R} fill="#e5e7eb" stroke="#ffffff" strokeWidth={0.6} />
            ))}
            {/* The pockets, each with what it pays. */}
            {PACHINKO.pockets.map((c, k) => {
              const x = pocketX(k);
              const hot = hits[k] && Date.now() - hits[k] < 700;
              return (
                <g key={`${k}:${hits[k] ?? 0}`} className={hits[k] ? 'pachinko-pocket-hit' : ''} style={{ transformOrigin: `${x}px ${BOTTOM + 14}px` }}>
                  <rect x={x - S / 2 + 1} y={BOTTOM} width={S - 2} height={28} rx={3} fill={pocketColor(c)} opacity={hot ? 1 : 0.82} />
                  <text x={x} y={BOTTOM + 18} textAnchor="middle" fontSize={c >= 1000 ? 7.5 : 8.5} fontWeight={800} fill="#0b0820">
                    {short(c)}
                  </text>
                </g>
              );
            })}
            {flying.map((f) => (
              <circle
                key={f.id}
                ref={(el) => {
                  if (el) dots.current.set(f.id, el);
                  else dots.current.delete(f.id);
                }}
                cx={CX}
                cy={-20}
                r={BALL_R}
                fill="url(#pk-ball)"
                style={{ opacity: 0, filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.5))' }}
              />
            ))}
          </svg>
        </div>
        <div className="mt-2 h-6 text-center font-display text-sm font-bold">
          {tally && (
            <span className={tally.won > tally.spent ? 'text-[#fde68a]' : 'text-white/70'}>
              Won <Coins n={tally.won} /> for <Coins n={tally.spent} />
            </span>
          )}
        </div>
        <div className="mt-1 flex items-stretch gap-2">
          {PACHINKO.balls.map((n, i) => (
            <button key={n} type="button" onClick={() => go(n)} disabled={coins < PACHINKO.cost * n || left < n} className={`flex-1 rounded-lg py-2 font-display disabled:opacity-50 ${i === 0 ? 'slot-spin text-[#3b1d00]' : 'border-2 border-[#f87171] bg-[#7f1d1d] text-white'}`}>
              <div className="flex items-center justify-center gap-1 text-[11px] font-bold">
                <DleCoin className="size-3.5" /> {(PACHINKO.cost * n).toLocaleString('en')}
              </div>
              <div className="text-base font-black tracking-widest">{n === 1 ? 'DROP' : `×${n}`}</div>
            </button>
          ))}
        </div>
        <p className="mt-2 text-center text-[11px] text-white/55">{left.toLocaleString('en')} balls left today</p>
      </div>
    </div>
  );
}
