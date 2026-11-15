// The Island's scenery (src/island/IslandView.tsx): the far sea and islands behind, the clouds, the ground's look
// (grass, beach, dirt, stone), the sea at both ends, and a plot's plant as it grows.
import { memo } from 'react';
import { ISLAND, readyOn, seedTint, type Plot } from './island';
import { SEED_BY_ID } from './seeds';

const K = '#3a2a32';

/** Far away, behind the island (it slides slower than the island: depth). */
export const Backdrop = memo(function Backdrop({ T }: { T: number }) {
  const W = ISLAND.w * T;
  const H = ISLAND.h * T;
  const hz = (ISLAND.sea - 5.2) * T; // the horizon, behind the hills
  const isle = (x: number, w: number, h: number) => `M${x} ${hz + 1}q${w * 0.18} ${-h} ${w * 0.5} ${-h}t${w * 0.5} ${h}z`;
  return (
    <svg className="pointer-events-none absolute left-0 top-0" width={W} height={H} aria-hidden>
      <defs>
        <linearGradient id="isl-far-sea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8fd0f2" />
          <stop offset="1" stopColor="#3b8fd0" />
        </linearGradient>
        <radialGradient id="isl-sun">
          <stop offset="0" stopColor="#fffbe6" />
          <stop offset=".35" stopColor="#fff3b0" />
          <stop offset="1" stopColor="#fff3b0" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx={W * 0.72} cy={T * 2.2} r={T * 3} fill="url(#isl-sun)" />
      <circle cx={W * 0.72} cy={T * 2.2} r={T * 0.9} fill="#fff7cc" />
      <path d={isle(W * 0.04, T * 7, T * 1.6)} fill="#9fc9b4" />
      <path d={isle(W * 0.3, T * 11, T * 2.4)} fill="#8dbfa6" />
      <path d={isle(W * 0.36, T * 5, T * 1.2)} fill="#a9d2bd" />
      <path d={isle(W * 0.62, T * 9, T * 1.9)} fill="#97c6ad" />
      <path d={isle(W * 0.86, T * 6, T * 1.3)} fill="#a9d2bd" />
      <rect x={0} y={hz} width={W} height={H - hz} fill="url(#isl-far-sea)" />
      {Array.from({ length: 18 }, (_, i) => {
        const x = ((i * 977) % 100) / 100;
        const y = hz + T * 0.4 + ((i * 53) % 7) * T * 0.35;
        return <path key={i} d={`M${x * W} ${y}h${T * (0.4 + (i % 3) * 0.25)}`} stroke="#e0f2fe" strokeWidth={1.5} strokeLinecap="round" opacity={0.7} />;
      })}
    </svg>
  );
});

/** Clouds drifting across the sky (above the far sea, under the island). */
export const Clouds = memo(function Clouds({ T }: { T: number }) {
  const W = ISLAND.w * T;
  const cloud = (k: number, x: number, y: number, s: number, dur: number) => (
    <div key={k} className="island-cloud pointer-events-none absolute" style={{ left: x, top: y, animationDuration: `${dur}s`, animationDelay: `${-k * 13}s` }}>
      <svg width={T * 3.2 * s} height={T * 1.4 * s} viewBox="0 0 64 28" aria-hidden>
        <path d="M6 26q-6 0-6-6t7-6q1-8 10-8 4-6 12-5 8 1 10 8 3-4 9-2 7 3 6 9 6 0 6 5t-6 5z" fill="#fff" opacity=".92" />
        <path d="M6 26h52" stroke="#dbeafe" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </div>
  );
  return <>{[cloud(0, W * 0.05, T * 1, 1, 160), cloud(1, W * 0.3, T * 2.6, 0.7, 210), cloud(2, W * 0.55, T * 0.8, 1.2, 190), cloud(3, W * 0.8, T * 2.2, 0.85, 240)]}</>;
});

/** A cell's tiny randomness, the same every time. */
export const cellHash = (x: number, y: number) => ((x * 73856093) ^ (y * 19349663)) >>> 0;

/** Beach: the ground right by the sea. */
export const isBeach = (x: number) => x <= 5 || x >= ISLAND.w - 6;

/** Dirt gets darker the deeper it is. */
export function dirtColor(y: number) {
  const t = Math.max(0, Math.min(1, (y - (ISLAND.sea - 4)) / 6));
  const mix = (a: number, b: number) => Math.round(a + (b - a) * t);
  return `rgb(${mix(160, 112)},${mix(103, 68)},${mix(56, 36)})`;
}

/** A plot: tilled soil, and the plant growing in its seeds' colours (a sprout, leaves, then a glowing bud). */
export const PlotArt = memo(function PlotArt({ p, today, ready }: { p: Plot; today: string; ready: boolean }) {
  const tint = (id: string) => (SEED_BY_ID.has(id) ? seedTint(id) : '#a3e635');
  const a = tint(p.a);
  const b = tint(p.b);
  const days = (d: string) => new Date(`${d}T12:00:00Z`).getTime() / 864e5;
  const total = Math.max(1, days(readyOn(p)) - days(p.day));
  const stage = ready ? 3 : (days(today) - days(p.day)) / total >= 0.5 ? 2 : 1;
  const soil = p.water ? '#4a2c14' : '#6d4520';
  return (
    <svg viewBox="0 0 32 32" className="size-full overflow-visible" aria-hidden>
      {stage >= 1 && (
        <g className={ready ? 'island-plant-ready' : 'island-plant'} style={{ transformOrigin: '16px 27px' }}>
          <path d={stage === 1 ? 'M16 27v-6' : stage === 2 ? 'M16 27q-1-7 0-13' : 'M16 27q-1.5-9 0-17'} fill="none" stroke="#15803d" strokeWidth="1.8" strokeLinecap="round" />
          <path d={stage === 1 ? 'M16 22q-5-1-5-5 4 0 5 4M16 22q5-1 5-5-4 0-5 4' : 'M16 22q-7 0-8-6 6 0 8 5M16 18q7 0 8-6-6 0-8 5'} fill="#4ade80" stroke={K} strokeWidth="1" strokeLinejoin="round" />
          {stage >= 2 && <path d="M16 24q6 0 7-4-5 0-7 3" fill="#22c55e" stroke={K} strokeWidth="1" strokeLinejoin="round" />}
          {stage === 2 && <ellipse cx="16" cy="13" rx="2.2" ry="3" fill={a} stroke={K} strokeWidth="1" />}
          {stage === 3 && (
            <g>
              <circle cx="16" cy="8" r="7" fill={b} opacity=".35" />
              {[0, 72, 144, 216, 288].map((r) => (
                <ellipse key={r} cx="16" cy="4.6" rx="2.6" ry="3.6" fill={a} stroke={K} strokeWidth=".9" transform={`rotate(${r} 16 8.5)`} />
              ))}
              <circle cx="16" cy="8.5" r="2.4" fill={b} stroke={K} strokeWidth=".9" />
              <circle cx="15.2" cy="7.7" r=".8" fill="#fff" opacity=".8" />
            </g>
          )}
        </g>
      )}
      <path d="M2 32q1-6 14-6t14 6z" fill={soil} stroke={K} strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M7 30q2-1.5 4-1M18 29q3-1 5 0" fill="none" stroke="#3b2412" strokeWidth="1" strokeLinecap="round" />
      {p.water && <path d="M25 22q-2 3 0 4 2-1 0-4z" fill="#7dd3fc" stroke={K} strokeWidth=".7" />}
    </svg>
  );
});
