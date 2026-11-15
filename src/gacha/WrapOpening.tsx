import { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { COSMETIC_BY_ID, type Cosmetic } from '../casino/cosmetics';

/**
 * The Ascended wrappers' openings (src/casino/cosmetics.ts `opening`), the pack's last moment once torn: Holo Foil
 * peels its top off in 3D in a prismatic flash and shards; Inferno burns away from the tear, embers flying; Portal
 * is spun into its vortex and swallowed, a ring of light bursting open; Event Horizon stretches, twists and sucks
 * the pack into a hole that then closes; Big Bang crushes it into a point, a flash fills the screen, and nothing is
 * left; Chronos runs time backwards, the pack spinning back into a clock that then breaks into gold; Diamond Heart cracks
 * from the tear, turns to crystal and shatters into shards of every colour. The styles are in src/index.css
 * (.pack-open-*, .pack-fx-*). Used by the pack opening (src/gacha/PackOpening.tsx) and the Boutique's preview.
 */
export type Opening = NonNullable<Cosmetic['opening']>;

/** The opening of a wrapper (its id), if it has one of its own. */
export const openingOf = (wrapperId: string | null | undefined): Opening | undefined => COSMETIC_BY_ID.get(wrapperId ?? '')?.opening;

/** What the whole pack does (both halves together): all but Holo Foil, which only peels its top. */
export const wholeClass = (o: Opening | undefined) => (o && o !== 'holofoil' ? `pack-open-${o}` : '');

/** How long the torn pack's moment lasts with each opening (ms; the others 950), before the stars fly. */
export const OPENING_MS: Partial<Record<Opening, number>> = { singularity: 1250, bigbang: 1700, timewarp: 1500, shatter: 1300 };
/** What the strip above the tear does: Holo Foil peels it; the others take it with the pack (no flying off). */
export const flapClass = (o: Opening | undefined) => (o === 'holofoil' ? 'pack-open-peel' : '');

/** Inside the pack, under its mask: the burning edge (Inferno), the prismatic flash (Holo Foil). */
export function OpeningInside({ kind }: { kind: Opening }) {
  if (kind === 'inferno') return <div className="pack-fx-burn pointer-events-none" aria-hidden />;
  if (kind === 'holofoil') return <div className="pack-fx-prism pointer-events-none" aria-hidden />;
  if (kind === 'shatter') return <Cracks />;
  return null;
}

/** Diamond Heart: cracks of light running down from the tear, branching, as the pack turns to crystal. */
function Cracks() {
  const lines = useMemo(() => {
    const out: string[] = [];
    const grow = (x: number, y: number, a: number, len: number, depth: number) => {
      let d = `M${x.toFixed(1)} ${y.toFixed(1)}`;
      for (let k = 0; k < 4; k++) {
        a += (Math.random() - 0.5) * 0.9;
        x += Math.cos(a) * len;
        y += Math.sin(a) * len;
        d += `L${x.toFixed(1)} ${y.toFixed(1)}`;
        if (depth < 2 && Math.random() < 0.45) grow(x, y, a + (Math.random() < 0.5 ? -0.9 : 0.9), len * 0.7, depth + 1);
      }
      out.push(d);
    };
    for (let k = 0; k < 5; k++) grow(15 + k * 17.5, 18, Math.PI / 2 + (Math.random() - 0.5) * 1.2, 9 + Math.random() * 5, 0);
    return out;
  }, []);
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      <div className="pack-fx-frost" />
      <svg className="absolute inset-0 size-full" viewBox="0 0 100 133" preserveAspectRatio="none">
        {lines.map((d, k) => (
          <path key={k} className="pack-fx-crack" d={d} pathLength={100} fill="none" stroke="#fff" strokeWidth={0.7} strokeLinecap="round" strokeLinejoin="round" style={{ animationDelay: `${(k % 5) * 0.04}s` }} />
        ))}
      </svg>
    </div>
  );
}

const RAINBOW = ['#ff4fd8', '#ffcd3c', '#4ade80', '#3cc7ff', '#a855f7', '#fff'];
const FIRE = ['#fde047', '#fb923c', '#f97316', '#fff7d6', '#ef4444'];
const VOID = ['#a78bfa', '#22d3ee', '#fff', '#c4b5fd'];

/**
 * Around the pack: the bits flying off (embers, shards), the Portal's ring of light, the Event Horizon's hole and
 * the stars it pulls in, the Big Bang's flash (the whole screen; only around the pack when `contained`, a preview).
 */
export function OpeningAround({ kind, contained = false }: { kind: Opening; contained?: boolean }) {
  if (kind === 'singularity') return <Singularity />;
  if (kind === 'bigbang') return <BigBang contained={contained} />;
  if (kind === 'timewarp') return <TimeWarp />;
  if (kind === 'shatter')
    return (
      <div className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden>
        <div className="pack-fx-prism-ring" />
        <Bits kind="shatter" />
      </div>
    );
  return <Bits kind={kind} />;
}

/** The Event Horizon: a hole opens over the pack, stars streak into it, the pack is sucked in, and it closes. */
function Singularity() {
  const streaks = useMemo(
    () =>
      Array.from({ length: 26 }, (_, k) => {
        const a = Math.random() * Math.PI * 2;
        const far = 110 + Math.random() * 160;
        return { k, dx: Math.cos(a) * far, dy: Math.sin(a) * far, rot: (a * 180) / Math.PI, d: Math.random() * 0.7, t: 0.45 + Math.random() * 0.4, c: VOID[k % VOID.length] };
      }),
    [],
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden>
      <div className="pack-fx-hole" />
      {streaks.map((s) => (
        <span
          key={s.k}
          className="pack-fx-streak"
          style={{ background: `linear-gradient(90deg, ${s.c}, transparent)`, ['--dx' as string]: `${s.dx}px`, ['--dy' as string]: `${s.dy}px`, ['--rot' as string]: `${s.rot}deg`, ['--d' as string]: `${s.d}s`, ['--t' as string]: `${s.t}s` }}
        />
      ))}
    </div>
  );
}

/** The Big Bang: the pack falls into a point, a flash fills everything, a ring of light rushes out, sparks, then nothing. */
function BigBang({ contained }: { contained: boolean }) {
  const flash = <div className={contained ? 'pack-fx-bang-flash pack-fx-bang-flash-near' : 'pack-fx-bang-flash'} />;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden>
      <div className="pack-fx-bang-ring" />
      <div className="pack-fx-bang-ring" style={{ animationDelay: '0.78s' }} />
      <Bits kind="bigbang" />
      {contained || typeof document === 'undefined' ? flash : createPortal(flash, document.body)}
    </div>
  );
}

const BANG = ['#fff', '#fde68a', '#f0abfc', '#a5f3fc', '#fca5a5', '#bbf7d0'];
const GOLD = ['#fde68a', '#fbbf24', '#fff7d6', '#f59e0b', '#fff'];
const ICE = ['#fff', '#a5f3fc', '#f0abfc', '#c4b5fd', '#fde68a', '#bbf7d0', '#e0f2fe', '#f9a8d4'];
const HOURS = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];

/** Chronos: a clock face spinning backwards round the pack as it spins back into it, then a ring of gold and the clock in pieces. */
function TimeWarp() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden>
      <svg className="pack-fx-clock" viewBox="0 0 100 100">
        <circle cx={50} cy={50} r={43.5} fill="none" stroke="rgba(30,27,75,0.55)" strokeWidth={8} />
        <circle cx={50} cy={50} r={47} fill="none" stroke="#fde68a" strokeWidth={1.4} />
        <circle cx={50} cy={50} r={40} fill="none" stroke="#fbbf24" strokeWidth={0.5} strokeDasharray="1 2" />
        {HOURS.map((h, k) => {
          const a = (k / 12) * Math.PI * 2 - Math.PI / 2;
          return (
            <text key={h} x={50 + Math.cos(a) * 43.5} y={50 + Math.sin(a) * 43.5 + 1.6} fontSize={4.6} fontFamily="serif" fontWeight={700} textAnchor="middle" fill="#fff7d6">
              {h}
            </text>
          );
        })}
        <path className="pack-fx-clock-hand" d="M50 52V12" stroke="#fff7d6" strokeWidth={1.2} strokeLinecap="round" />
        <path className="pack-fx-clock-hand pack-fx-clock-hand-2" d="M50 52V24" stroke="#fbbf24" strokeWidth={2} strokeLinecap="round" />
      </svg>
      <div className="pack-fx-time-ring" />
      <Bits kind="timewarp" />
    </div>
  );
}

function Bits({ kind }: { kind: Opening }) {
  const bits = useMemo(() => {
    const n = kind === 'inferno' ? 28 : kind === 'holofoil' ? 20 : kind === 'bigbang' ? 44 : kind === 'shatter' ? 40 : 22;
    return Array.from({ length: n }, (_, k) => {
      const r = Math.random;
      if (kind === 'inferno')
        return { k, x: 8 + r() * 84, top: 18 + r() * 60, dx: (r() - 0.5) * 140, dy: -(80 + r() * 220), size: 2 + r() * 4, color: FIRE[k % FIRE.length], d: r() * 0.6, t: 0.9 + r() * 0.7, rot: 0, shard: false };
      if (kind === 'holofoil')
        return { k, x: 10 + r() * 80, top: 18, dx: (r() - 0.5) * 320, dy: -(40 + r() * 200), size: 4 + r() * 7, color: RAINBOW[k % RAINBOW.length], d: 0.05 + r() * 0.25, t: 0.8 + r() * 0.5, rot: (r() - 0.5) * 720, shard: true };
      const a = r() * Math.PI * 2;
      if (kind === 'shatter') {
        // The pack in pieces: each shard from where it was, flying out from the middle, turning.
        const x = 8 + r() * 84;
        const top = 8 + r() * 84;
        const far = 90 + r() * 170;
        const out = Math.atan2(top - 50, x - 50) + (r() - 0.5) * 0.6;
        return { k, x, top, dx: Math.cos(out) * far, dy: Math.sin(out) * far + 40, size: 6 + r() * 11, color: ICE[k % ICE.length], d: 0.74 + r() * 0.08, t: 0.8 + r() * 0.5, rot: (r() - 0.5) * 900, shard: true };
      }
      if (kind === 'timewarp') {
        const far = 130 + r() * 200;
        return { k, x: 50, top: 50, dx: Math.cos(a) * far, dy: Math.sin(a) * far, size: 3 + r() * 5, color: GOLD[k % GOLD.length], d: 1.05 + r() * 0.15, t: 0.7 + r() * 0.5, rot: (r() - 0.5) * 540, shard: k % 2 === 0 };
      }
      if (kind === 'bigbang') {
        const far = 160 + r() * 260;
        return { k, x: 50, top: 50, dx: Math.cos(a) * far, dy: Math.sin(a) * far, size: 2 + r() * 4, color: BANG[k % BANG.length], d: 0.62 + r() * 0.2, t: 0.9 + r() * 0.7, rot: (r() - 0.5) * 360, shard: k % 4 === 0 };
      }
      const far = 120 + r() * 140;
      return { k, x: 50, top: 50, dx: Math.cos(a) * far, dy: Math.sin(a) * far, size: 2 + r() * 5, color: VOID[k % VOID.length], d: 0.45 + r() * 0.3, t: 0.8 + r() * 0.5, rot: (r() - 0.5) * 360, shard: k % 3 === 0 };
    });
  }, [kind]);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden>
      {kind === 'portal' && <div className="pack-fx-portal" />}
      {bits.map((b) => (
        <span
          key={b.k}
          className={`pack-fx-bit ${b.shard ? 'shard' : ''}`}
          style={{
            ['--x' as string]: `${b.x}%`,
            top: `${b.top}%`,
            width: b.size,
            height: b.size,
            background: b.color,
            boxShadow: b.shard ? undefined : `0 0 ${b.size * 2}px ${b.color}`,
            ['--dx' as string]: `${b.dx}px`,
            ['--dy' as string]: `${b.dy}px`,
            ['--rot' as string]: `${b.rot}deg`,
            ['--d' as string]: `${b.d}s`,
            ['--t' as string]: `${b.t}s`,
          }}
        />
      ))}
    </div>
  );
}
