import { useEffect, useId, useMemo, useState } from 'react';

/**
 * The Thunderstorm wrapper (the Boutique's Prestige collection): two decks of cloud drifting at their own pace,
 * rain slanting through, sparks crawling along the edges. Every few seconds lightning strikes: a bolt drawn new
 * each time (never twice the same), with its forks, coming down from the clouds, the clouds lit from inside, the
 * pack flashing white, a glow where it lands. Sometimes it strikes twice. Still for reduced motion (one bolt, lit).
 */
const W = 300;
const H = 400;

interface Strike {
  id: number;
  main: string;
  forks: string[];
  x: number;
  end: { x: number; y: number };
}

type Pt = { x: number; y: number };

/** A jagged line from a to b (midpoint displacement): the further apart, the more it zigzags. */
function jag(a: Pt, b: Pt, rough: number, depth = 5): Pt[] {
  if (depth === 0) return [a, b];
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const mid = { x: (a.x + b.x) / 2 + (Math.random() - 0.5) * len * rough, y: (a.y + b.y) / 2 + (Math.random() - 0.5) * len * rough * 0.25 };
  return [...jag(a, mid, rough, depth - 1).slice(0, -1), ...jag(mid, b, rough, depth - 1)];
}

const d = (pts: Pt[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('');

let next = 0;
function newStrike(): Strike {
  const x = 60 + Math.random() * 180;
  const end = { x: Math.max(20, Math.min(W - 20, x + (Math.random() - 0.5) * 140)), y: 300 + Math.random() * 80 };
  const main = jag({ x, y: 40 }, end, 0.32);
  // Forks: from points along the bolt, shorter and leaning away, a few with a fork of their own.
  const forks: string[] = [];
  const n = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) {
    const from = main[4 + Math.floor(Math.random() * (main.length * 0.6))];
    const side = Math.random() < 0.5 ? -1 : 1;
    const to = { x: from.x + side * (25 + Math.random() * 55), y: from.y + 30 + Math.random() * 70 };
    const fork = jag(from, to, 0.4, 4);
    forks.push(d(fork));
    if (Math.random() < 0.4) {
      const at = fork[Math.floor(fork.length / 2)];
      forks.push(d(jag(at, { x: at.x + side * (10 + Math.random() * 25), y: at.y + 20 + Math.random() * 30 }, 0.4, 3)));
    }
  }
  return { id: ++next, main: d(main), forks, x, end };
}

/**
 * One deck of cloud: billows in rows, bigger and darker at the bottom, each lit a little on top, drawn twice side
 * by side so it can drift on forever. `seed` gives each deck its own shape.
 */
function Clouds({ y, scale, fill, opacity, className, seed }: { y: number; scale: number; fill: string; opacity: number; className: string; seed: number }) {
  let s = seed;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const puffs: [number, number, number][] = [];
  for (let row = 0; row < 3; row++) {
    for (let x = -10 + rnd() * 20; x < W; x += (26 + rnd() * 22) * scale) {
      puffs.push([x, row * 22 * scale + (rnd() - 0.5) * 14, (22 + rnd() * 18 + row * 6) * scale]);
    }
  }
  return (
    <g className={className} opacity={opacity}>
      {[0, W].map((dx) => (
        <g key={dx} transform={`translate(${dx} ${y})`}>
          {puffs.map(([cx, cy, r], i) => (
            <circle key={i} cx={cx} cy={cy} r={r} fill={fill} />
          ))}
        </g>
      ))}
    </g>
  );
}

/** How far the rain leans: it falls H down and RAIN_DX across in one loop. */
const RAIN_DX = -H * Math.tan((15 * Math.PI) / 180);

/**
 * A layer of rain: drops drawn twice, the second copy one fall (H down, RAIN_DX across) behind the first; the layer
 * slides by exactly that much and starts over, so the loop never shows (no seam, no jump, no flicker).
 */
function Rain({ count, len, width, opacity, className, seed }: { count: number; len: [number, number]; width: number; opacity: number; className: string; seed: number }) {
  const drops = useMemo(() => {
    let s = seed;
    const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
    const k = RAIN_DX / H;
    let d = '';
    for (let i = 0; i < count; i++) {
      const x = -20 + rnd() * (W + 120);
      const y = rnd() * H;
      const l = len[0] + rnd() * (len[1] - len[0]);
      for (const [ox, oy] of [[0, 0], [-RAIN_DX, -H]]) d += `M${(x + ox).toFixed(1)} ${(y + oy).toFixed(1)}l${(k * l).toFixed(1)} ${l.toFixed(1)}`;
    }
    return d;
  }, [count, len, seed]);
  return (
    <g className={className} style={{ ['--rain-dx' as string]: `${RAIN_DX.toFixed(1)}px`, ['--rain-dy' as string]: `${H}px` }}>
      <path d={drops} stroke="#dbeafe" strokeOpacity={opacity} strokeWidth={width} strokeLinecap="round" />
    </g>
  );
}

export function StormWrap() {
  const uid = useId().replace(/:/g, '');
  const [strike, setStrike] = useState<Strike | null>(null);
  const [reduced] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

  useEffect(() => {
    if (reduced) {
      setStrike(newStrike());
      return;
    }
    let t = 0;
    const strikeNow = () => {
      setStrike(newStrike());
      // Now and then a second bolt right after the first.
      if (Math.random() < 0.3) t = window.setTimeout(() => (setStrike(newStrike()), schedule()), 260 + Math.random() * 200);
      else schedule();
    };
    const schedule = () => (t = window.setTimeout(strikeNow, 1600 + Math.random() * 2800));
    t = window.setTimeout(strikeNow, 500 + Math.random() * 1200);
    return () => window.clearTimeout(t);
  }, [reduced]);

  const glow = `storm-glow-${uid}`;
  const soft = `storm-soft-${uid}`;
  return (
    <div className="pack-storm pointer-events-none absolute inset-0" aria-hidden>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full">
        <defs>
          <filter id={glow} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="5" />
          </filter>
          <filter id={soft} x="-20%" y="-50%" width="140%" height="200%">
            <feGaussianBlur stdDeviation="7" />
          </filter>
          <filter id={`storm-near-blur-${uid}`} x="-10%" y="-50%" width="120%" height="200%">
            <feGaussianBlur stdDeviation="2.2" />
          </filter>
          <radialGradient id={`storm-far-${uid}`} cx="0.45" cy="0.3" r="0.7">
            <stop offset="0" stopColor="#64748b" />
            <stop offset="0.6" stopColor="#334155" />
            <stop offset="1" stopColor="#1e293b" />
          </radialGradient>
          <radialGradient id={`storm-near-${uid}`} cx="0.45" cy="0.28" r="0.7">
            <stop offset="0" stopColor="#475569" />
            <stop offset="0.55" stopColor="#1e293b" />
            <stop offset="1" stopColor="#0f172a" />
          </radialGradient>
          <radialGradient id={`storm-lit-${uid}`}>
            <stop offset="0" stopColor="#e0e7ff" stopOpacity="0.95" />
            <stop offset="0.45" stopColor="#a5b4fc" stopOpacity="0.45" />
            <stop offset="1" stopColor="#6366f1" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`storm-land-${uid}`}>
            <stop offset="0" stopColor="#fff" stopOpacity="0.9" />
            <stop offset="0.3" stopColor="#bfdbfe" stopOpacity="0.5" />
            <stop offset="1" stopColor="#60a5fa" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`storm-mist-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1e293b" stopOpacity="0" />
            <stop offset="1" stopColor="#94a3b8" stopOpacity="0.35" />
          </linearGradient>
        </defs>

        {/* The far deck, then the lightning (behind the near deck: it comes out of the clouds), then the near deck. */}
        <g filter={`url(#${soft})`}>
          <Clouds y={40} scale={1.3} fill={`url(#storm-far-${uid})`} opacity={0.95} className="storm-drift-slow" seed={7} />
        </g>

        {strike && (
          <g key={strike.id} className="storm-strike">
            <ellipse cx={strike.x} cy={50} rx={130} ry={70} fill={`url(#storm-lit-${uid})`} className="storm-cloudlit" />
            <ellipse cx={strike.end.x} cy={strike.end.y + 10} rx={70} ry={26} fill={`url(#storm-land-${uid})`} className="storm-land" />
            <g className="storm-bolt" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d={strike.main} stroke="#6366f1" strokeWidth="34" filter={`url(#${soft})`} opacity="0.55" pathLength={1} className="storm-draw" />
              <path d={strike.main} stroke="#a5b4fc" strokeWidth="12" filter={`url(#${glow})`} opacity="0.95" pathLength={1} className="storm-draw" />
              {strike.forks.map((f, i) => (
                <path key={i} d={f} stroke="#c7d2fe" strokeWidth="1.4" opacity="0.85" pathLength={1} className="storm-draw storm-draw-late" />
              ))}
              <path d={strike.main} stroke="#e0e7ff" strokeWidth="4.5" opacity="0.8" pathLength={1} className="storm-draw" />
              <path d={strike.main} stroke="#fff" strokeWidth="1.8" pathLength={1} className="storm-draw" />
            </g>
          </g>
        )}

        <g filter={`url(#storm-near-blur-${uid})`}>
          <Clouds y={-6} scale={1.05} fill={`url(#storm-near-${uid})`} opacity={1} className="storm-drift" seed={3} />
        </g>
        {/* The near clouds, lit from inside by the strike. */}
        {strike && <ellipse key={`u${strike.id}`} cx={strike.x} cy={40} rx={150} ry={60} fill={`url(#storm-lit-${uid})`} className="storm-underlit" />}

        <rect x="0" y={H * 0.72} width={W} height={H * 0.28} fill={`url(#storm-mist-${uid})`} />

        {/* Sparks crawling along the edges. */}
        <rect x="5" y="20" width={W - 10} height={H - 25} rx="10" fill="none" stroke="#93c5fd" strokeWidth="2.2" strokeDasharray="3 22 1 40" filter={`url(#${glow})`} className="storm-edge" />
        <rect x="5" y="20" width={W - 10} height={H - 25} rx="10" fill="none" stroke="#eff6ff" strokeWidth="1.1" strokeDasharray="3 22 1 40" className="storm-edge" />
      </svg>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" className="pack-storm-rain absolute inset-0 size-full">
        <Rain count={70} len={[9, 16]} width={0.9} opacity={0.32} className="storm-rain-far" seed={11} />
        <Rain count={34} len={[16, 28]} width={1.4} opacity={0.45} className="storm-rain-near" seed={5} />
      </svg>
      {strike && <div key={`f${strike.id}`} className="pack-storm-flash absolute inset-0" />}
    </div>
  );
}
