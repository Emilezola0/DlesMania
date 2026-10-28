import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { HeartIcon } from '../boss/BossHeader';
import { CROSS_LIVES, clashes, crossPuzzle, rungKey, walk, type CrossPuzzle, type Rung } from '../arcade/crossroads';
import { celebrate, celebrateBig, shake } from '../lib/fx';
import { sfx } from '../lib/sfx';
import { useProgress } from '../store/progress';

const BEST_KEY = 'cross:levels';
/** Ladder geometry, in SVG units: lines 100 apart, rows ROW_H apart. */
const COL_W = 100;
const ROW_H = 44;
const PAD = 14;
const RUN_MS = 2400;
const COLORS = ['#818cf8', '#f472b6', '#facc15', '#34d399', '#60a5fa', '#fb923c'];

const lineX = (col: number) => col * COL_W + COL_W / 2;
const rowY = (row: number) => PAD + (row + 0.5) * ROW_H;

type Phase = 'draw' | 'run' | 'done';

/** A traveller's route as SVG points: down its line, across every bridge it meets, to the bottom. */
function route(p: CrossPuzzle, start: number, rungs: Set<string>, height: number) {
  const { steps } = walk(start, p.rows, rungs);
  const pts = [{ x: lineX(start), y: 0 }, ...steps.map((s) => ({ x: lineX(s.col), y: rowY(s.row) }))];
  pts.push({ x: pts[pts.length - 1].x, y: height });
  const lens = pts.slice(1).map((q, i) => Math.hypot(q.x - pts[i].x, q.y - pts[i].y));
  return { pts, lens, total: lens.reduce((a, b) => a + b, 0) };
}

/** The point `k` (0–1) of the way along a route. */
function along(r: ReturnType<typeof route>, k: number) {
  let d = k * r.total;
  for (let i = 0; i < r.lens.length; i++) {
    if (d <= r.lens[i] || i === r.lens.length - 1) {
      const f = r.lens[i] ? Math.min(1, d / r.lens[i]) : 1;
      return { x: r.pts[i].x + (r.pts[i + 1].x - r.pts[i].x) * f, y: r.pts[i].y + (r.pts[i + 1].y - r.pts[i].y) * f };
    }
    d -= r.lens[i];
  }
  return r.pts[r.pts.length - 1];
}

function Game() {
  const best = useProgress((s) => s.bests[BEST_KEY] ?? 0);
  const recordBest = useProgress((s) => s.recordBest);
  const [level, setLevel] = useState(1);
  const [puzzle, setPuzzle] = useState(() => crossPuzzle(1));
  const [drawn, setDrawn] = useState<Rung[]>([]);
  const [lives, setLives] = useState(CROSS_LIVES);
  const [phase, setPhase] = useState<Phase>('draw');
  const [t, setT] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ a: { x: number; y: number }; b: { x: number; y: number } } | null>(null);
  const svg = useRef<SVGSVGElement>(null);

  const width = puzzle.lines * COL_W;
  const height = PAD * 2 + puzzle.rows * ROW_H;
  const fixedKeys = useMemo(() => new Set(puzzle.fixed.map(rungKey)), [puzzle]);
  const all = useMemo(() => new Set([...fixedKeys, ...drawn.map(rungKey)]), [fixedKeys, drawn]);
  const routes = useMemo(() => puzzle.travellers.map((_, i) => route(puzzle, i, all, height)), [puzzle, all, height]);
  const ends = useMemo(() => puzzle.travellers.map((_, i) => walk(i, puzzle.rows, all).end), [puzzle, all]);
  const arrived = useMemo(() => {
    const a: number[] = Array(puzzle.lines);
    ends.forEach((e, i) => (a[e] = i));
    return a;
  }, [ends, puzzle]);
  const right = (col: number) => puzzle.travellers[arrived[col]].franchise === puzzle.goals[col];
  const solved = phase === 'done' && puzzle.goals.every((_, c) => right(c));
  const over = phase === 'done' && !solved && lives <= 0;

  // The slide down: every traveller at once, landing on the total even when frames don't run (hidden tab).
  useEffect(() => {
    if (phase !== 'run') return;
    const start = performance.now();
    let id = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / RUN_MS);
      setT(k);
      if (k < 1) id = requestAnimationFrame(step);
    };
    id = requestAnimationFrame(step);
    const end = window.setTimeout(() => (setT(1), setPhase('done')), RUN_MS + 80);
    return () => (cancelAnimationFrame(id), window.clearTimeout(end));
  }, [phase]);

  // The verdict, once they've all landed.
  useEffect(() => {
    if (phase !== 'done') return;
    if (puzzle.goals.every((_, c) => right(c))) {
      sfx.streak();
      celebrate();
      recordBest(BEST_KEY, level);
      if (level > best) window.setTimeout(() => celebrateBig(), 400);
    } else {
      sfx.hurt();
      shake(svg.current?.parentElement ?? null, 8, 380);
      setLives((l) => l - 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const toSvg = (e: React.PointerEvent) => {
    const m = svg.current!.getScreenCTM()!.inverse();
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m);
    return { x: p.x, y: p.y };
  };
  const nearestLine = (x: number) => Math.max(0, Math.min(puzzle.lines - 1, Math.round((x - COL_W / 2) / COL_W)));
  const nearestRow = (y: number) => Math.max(0, Math.min(puzzle.rows - 1, Math.round((y - PAD) / ROW_H - 0.5)));

  const toggle = (r: Rung) => {
    const key = rungKey(r);
    if (fixedKeys.has(key)) return setNote('That bridge was already there: it stays.');
    if (drawn.some((d) => rungKey(d) === key)) {
      sfx.select();
      setNote(null);
      return setDrawn(drawn.filter((d) => rungKey(d) !== key));
    }
    if (clashes(all, r)) return (sfx.wrong(), setNote("Two bridges at the same height can't share a line."));
    if (drawn.length >= puzzle.budget) return (sfx.wrong(), setNote(`No bridges left: tap one of yours to take it back.`));
    sfx.click();
    setNote(null);
    setDrawn([...drawn, r]);
  };

  const onDown = (e: React.PointerEvent) => {
    if (phase !== 'draw') return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const p = toSvg(e);
    setDrag({ a: p, b: p });
  };
  const onMove = (e: React.PointerEvent) => drag && setDrag({ ...drag, b: toSvg(e) });
  const onUp = () => {
    if (!drag) return;
    setDrag(null);
    const { a, b } = drag;
    const row = nearestRow((a.y + b.y) / 2);
    if (Math.abs(b.x - a.x) < COL_W * 0.35) {
      // A tap: the gap it's in, between two lines.
      const col = Math.floor((a.x - COL_W / 2) / COL_W);
      if (col >= 0 && col < puzzle.lines - 1) toggle({ col, row });
      return;
    }
    const [l1, l2] = [nearestLine(a.x), nearestLine(b.x)].sort((x, y) => x - y);
    if (l2 - l1 !== 1) return setNote('A bridge joins two neighbouring lines.');
    toggle({ col: l1, row });
  };

  const go = () => {
    if (phase !== 'draw') return;
    sfx.whoosh();
    setNote(null);
    setT(0);
    setPhase('run');
  };
  const retry = () => (sfx.click(), setT(0), setPhase('draw'));
  const next = () => {
    sfx.click();
    const l = level + 1;
    setLevel(l);
    setPuzzle(crossPuzzle(l));
    setDrawn([]);
    setT(0);
    setPhase('draw');
  };
  const restart = () => {
    sfx.click();
    setLevel(1);
    setPuzzle(crossPuzzle(1));
    setDrawn([]);
    setLives(CROSS_LIVES);
    setT(0);
    setPhase('draw');
  };

  const moving = phase !== 'draw';
  return (
    <div className="mx-auto space-y-4" style={{ maxWidth: Math.max(360, puzzle.lines * 112) }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {Array.from({ length: CROSS_LIVES }, (_, i) => (
            <HeartIcon key={i} full={i < lives} className="size-5" />
          ))}
        </div>
        <p className="font-display text-sm text-ink-soft">
          Level <span className="font-serif text-2xl font-bold text-ink">{level}</span> · best {Math.max(best, solved ? level : 0)}
        </p>
        <p className="font-display text-sm font-bold">
          🌉 {puzzle.budget - drawn.length}/{puzzle.budget} left
        </p>
      </div>

      {/* Travellers at the top of their lines. */}
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${puzzle.lines}, 1fr)` }}>
        {puzzle.travellers.map((c, i) => (
          <div key={c.name} className={`flex flex-col items-center text-center transition ${moving ? 'opacity-30' : ''}`}>
            <img src={c.image} alt="" draggable={false} className="size-12 rounded-full border-2 bg-tile object-cover object-top sm:size-14" style={{ borderColor: COLORS[i] }} />
            <p className="mt-1 line-clamp-2 text-[11px] font-semibold leading-tight sm:text-xs">{c.name}</p>
          </div>
        ))}
      </div>

      <svg
        ref={svg}
        viewBox={`0 0 ${width} ${height}`}
        className={`block w-full touch-none select-none ${phase === 'draw' ? 'cursor-crosshair' : ''}`}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={() => setDrag(null)}
        aria-label="The ladder: drag between two neighbouring lines to build a bridge"
      >
        {/* Every spot a bridge can go, faintly, while drawing. */}
        {phase === 'draw' &&
          Array.from({ length: puzzle.lines - 1 }, (_, col) =>
            Array.from({ length: puzzle.rows }, (_, row) => (
              <circle key={`${col}:${row}`} cx={lineX(col) + COL_W / 2} cy={rowY(row)} r={2.2} className="fill-ink-faint" opacity={0.35} />
            )),
          )}
        {Array.from({ length: puzzle.lines }, (_, i) => (
          <line key={i} x1={lineX(i)} y1={0} x2={lineX(i)} y2={height} className="stroke-ink-soft" strokeWidth={4} strokeLinecap="round" />
        ))}
        {puzzle.fixed.map((r) => (
          <line key={`f${rungKey(r)}`} x1={lineX(r.col)} x2={lineX(r.col + 1)} y1={rowY(r.row)} y2={rowY(r.row)} className="stroke-ink-soft" strokeWidth={4} strokeLinecap="round" />
        ))}
        {drawn.map((r) => (
          <line key={`d${rungKey(r)}`} x1={lineX(r.col)} x2={lineX(r.col + 1)} y1={rowY(r.row)} y2={rowY(r.row)} className="stroke-accent" strokeWidth={6} strokeLinecap="round" />
        ))}
        {drag && Math.abs(drag.b.x - drag.a.x) > 6 && (
          <line x1={drag.a.x} y1={drag.a.y} x2={drag.b.x} y2={drag.b.y} className="stroke-accent" strokeWidth={4} strokeDasharray="8 6" strokeLinecap="round" opacity={0.7} />
        )}
        {/* The trails and the travellers themselves. */}
        {moving &&
          routes.map((r, i) => (
            <polyline
              key={`trail${i}`}
              points={r.pts.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke={COLORS[i]}
              strokeWidth={6}
              strokeLinejoin="round"
              strokeLinecap="round"
              pathLength={1}
              strokeDasharray="1 1"
              strokeDashoffset={1 - t}
              opacity={0.85}
            />
          ))}
        <defs>
          {puzzle.travellers.map((_, i) => (
            <clipPath key={i} id={`cross-clip-${i}`}>
              <circle r={20} />
            </clipPath>
          ))}
        </defs>
        {moving &&
          routes.map((r, i) => {
            const p = along(r, t);
            return (
              <g key={`who${i}`} transform={`translate(${p.x} ${Math.min(p.y, height - 22)})`}>
                <circle r={22} fill={COLORS[i]} />
                <image href={puzzle.travellers[i].image} x={-20} y={-20} width={40} height={40} clipPath={`url(#cross-clip-${i})`} preserveAspectRatio="xMidYMin slice" />
              </g>
            );
          })}
      </svg>

      {/* Franchises at the bottom of their lines. */}
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${puzzle.lines}, 1fr)` }}>
        {puzzle.goals.map((g, c) => {
          const verdict = phase === 'done' ? (right(c) ? 'border-hit bg-hit/15' : 'border-miss bg-miss/15') : 'border-rule-strong bg-card';
          return (
            <div key={g} className={`flex min-h-14 flex-col items-center justify-center rounded-md border-2 p-1 text-center transition ${verdict}`}>
              <p className="text-[11px] font-bold leading-tight sm:text-xs">{g}</p>
              {phase === 'done' && <p className="text-sm">{right(c) ? '✓' : '✗'}</p>}
            </div>
          );
        })}
      </div>

      <p className="h-5 text-center text-sm font-semibold text-coral">{note}</p>

      {phase === 'draw' && (
        <div className="flex flex-wrap justify-center gap-3">
          <button type="button" onClick={go} className="btn-accent rounded-md px-8 py-3 font-display text-lg font-bold tracking-widest">
            Go!
          </button>
          {drawn.length > 0 && (
            <button type="button" onClick={() => (sfx.select(), setDrawn([]))} className="btn-paper rounded-md px-5 py-3 font-display font-bold">
              Clear my bridges
            </button>
          )}
        </div>
      )}
      {phase === 'done' && (
        <div className={`animate-pop space-y-2 rounded-md border p-4 text-center ${solved ? 'border-hit/50 bg-hit/10' : 'border-miss/50 bg-miss/10'}`}>
          <p className="font-display text-xl font-bold">{solved ? `Level ${level} cleared!` : over ? 'Out of hearts' : 'Someone took a wrong turn'}</p>
          {!solved && (
            <p className="text-sm text-ink-soft">
              {puzzle.goals
                .map((g, c) => (right(c) ? null : `${puzzle.travellers[arrived[c]].name} reached ${g}`))
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
          {solved ? (
            <button type="button" onClick={next} className="btn-ink rounded-md px-6 py-2.5 font-display font-bold tracking-wider">
              Next level →
            </button>
          ) : over ? (
            <button type="button" onClick={restart} className="btn-ink rounded-md px-6 py-2.5 font-display font-bold tracking-wider">
              Start again
            </button>
          ) : (
            <button type="button" onClick={retry} className="btn-ink rounded-md px-6 py-2.5 font-display font-bold tracking-wider">
              Fix the bridges
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** /crossroads */
export default function Crossroads() {
  return (
    <div className="space-y-6">
      <div className="mx-auto max-w-2xl">
        <Link to="/games" className="font-display text-sm font-semibold tracking-wider text-ink-soft hover:text-ink">
          ← Games
        </Link>
        <h1 className="text-5xl font-bold">Crossroads</h1>
        <p className="text-ink-soft">
          Lead everyone home. Each character slides down their line and takes every bridge they meet. Drag between two neighbouring lines (or
          tap the gap) to build a bridge, tap it again to take it back, then press Go — Luffy must reach One Piece, Iron Man the MCU,
          Frodo The Lord of the Rings. The grey bridges were already there.
        </p>
      </div>
      <Game />
    </div>
  );
}
