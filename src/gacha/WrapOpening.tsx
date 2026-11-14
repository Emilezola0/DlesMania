import { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { COSMETIC_BY_ID, type Cosmetic } from '../casino/cosmetics';

/**
 * The Ascended wrappers' openings (src/casino/cosmetics.ts `opening`), the pack's last moment once torn: Holo Foil
 * peels its top off in 3D in a prismatic flash and shards; Inferno burns away from the tear, embers flying; Portal
 * is spun into its vortex and swallowed, a ring of light bursting open; Event Horizon stretches, twists and sucks
 * the pack into a hole that then closes; Big Bang crushes it into a point, a flash fills the screen, and nothing is
 * left. The styles are in src/index.css
 * (.pack-open-*, .pack-fx-*). Used by the pack opening (src/gacha/PackOpening.tsx) and the Boutique's preview.
 */
export type Opening = NonNullable<Cosmetic['opening']>;

/** The opening of a wrapper (its id), if it has one of its own. */
export const openingOf = (wrapperId: string | null | undefined): Opening | undefined => COSMETIC_BY_ID.get(wrapperId ?? '')?.opening;

/** What the whole pack does (both halves together): all but Holo Foil, which only peels its top. */
export const wholeClass = (o: Opening | undefined) => (o && o !== 'holofoil' ? `pack-open-${o}` : '');

/** How long the torn pack's moment lasts with each opening (ms; the others 950), before the stars fly. */
export const OPENING_MS: Partial<Record<Opening, number>> = { singularity: 1250, bigbang: 1700 };
/** What the strip above the tear does: Holo Foil peels it; the others take it with the pack (no flying off). */
export const flapClass = (o: Opening | undefined) => (o === 'holofoil' ? 'pack-open-peel' : '');

/** Inside the pack, under its mask: the burning edge (Inferno), the prismatic flash (Holo Foil). */
export function OpeningInside({ kind }: { kind: Opening }) {
  if (kind === 'inferno') return <div className="pack-fx-burn pointer-events-none" aria-hidden />;
  if (kind === 'holofoil') return <div className="pack-fx-prism pointer-events-none" aria-hidden />;
  return null;
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

function Bits({ kind }: { kind: Opening }) {
  const bits = useMemo(() => {
    const n = kind === 'inferno' ? 28 : kind === 'holofoil' ? 20 : kind === 'bigbang' ? 44 : 22;
    return Array.from({ length: n }, (_, k) => {
      const r = Math.random;
      if (kind === 'inferno')
        return { k, x: 8 + r() * 84, top: 18 + r() * 60, dx: (r() - 0.5) * 140, dy: -(80 + r() * 220), size: 2 + r() * 4, color: FIRE[k % FIRE.length], d: r() * 0.6, t: 0.9 + r() * 0.7, rot: 0, shard: false };
      if (kind === 'holofoil')
        return { k, x: 10 + r() * 80, top: 18, dx: (r() - 0.5) * 320, dy: -(40 + r() * 200), size: 4 + r() * 7, color: RAINBOW[k % RAINBOW.length], d: 0.05 + r() * 0.25, t: 0.8 + r() * 0.5, rot: (r() - 0.5) * 720, shard: true };
      const a = r() * Math.PI * 2;
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
