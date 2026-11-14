import { useId, type ReactNode } from 'react';
import { useProgress } from '../store/progress';
import { FRAME_RARITY_COLOR, ROMAN, parseWorn, wornFrameId, type Beyond, type Frame } from './frames';

/** A glyph filling its box, whatever the frame's size (an SVG scales; a font size wouldn't). */
const Glyph = ({ g }: { g: string }) => (
  <svg viewBox="0 0 10 10" className="block size-full overflow-visible">
    <text x="5" y="8.6" fontSize="9" textAnchor="middle" fill="currentColor">
      {g}
    </text>
  </svg>
);

/** Sparkles on a twinkling ring, round its edge. */
const TWINKLES = [
  [12, 18],
  [86, 30],
  [78, 88],
  [8, 70],
  [50, -2],
];

/** Petals (or whatever drifts) leaving a drifting ring, from its lower half. */
const DRIFTS = [
  [20, 70],
  [70, 82],
  [88, 52],
  [45, 92],
];
const RING_LIFE: Partial<Record<NonNullable<Frame['life']>, string>> = {
  spin: 'avatar-frame-spin',
  pulse: 'avatar-frame-pulse',
  flicker: 'avatar-frame-flicker',
  blackhole: 'avatar-frame-spin avatar-frame-blackhole',
  supernova: 'avatar-frame-supernova',
  aurora: 'avatar-frame-spin avatar-frame-slow',
  orbit: 'avatar-frame-pulse',
  starfall: 'avatar-frame-spin avatar-frame-slow',
  seraph: 'avatar-frame-pulse',
  cosmos: 'avatar-frame-spin avatar-frame-hue',
};

/** A seraph's wing (the left one; the right is its mirror): long feathers fanning out from the root, on the right. */
function Wing() {
  const id = 'wing' + useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 100 100" className="block size-full overflow-visible">
      <defs>
        <linearGradient id={id} x1="1" y1="0" x2="0" y2="0">
          <stop offset="0" stopColor="#fff7d6" />
          <stop offset="0.6" stopColor="#ffffff" />
          <stop offset="1" stopColor="#fde68a" stopOpacity="0.7" />
        </linearGradient>
      </defs>
      {[-58, -40, -22, -6, 10, 24].map((a, i) => (
        <ellipse key={a} cx={58 - i * 2} cy={50} rx={40 - i * 3} ry={7.5} fill={`url(#${id})`} stroke="#f5c542" strokeOpacity={0.55} strokeWidth={1} transform={`rotate(${a} 96 50)`} />
      ))}
    </svg>
  );
}

/** Behind the icon and round it, the lives above Mythic (src/casino/frames.ts `Beyond`). */
function BeyondLife({ life }: { life: Beyond }) {
  if (life === 'aurora') return <span className="avatar-fx-aurora pointer-events-none absolute -inset-[50%] -z-10 rounded-full" aria-hidden />;
  if (life === 'orbit')
    return (
      <span className="pointer-events-none absolute -inset-[30%]" aria-hidden>
        {[0, 1, 2].map((k) => (
          <span key={k} className="avatar-fx-orbit absolute inset-0" style={{ ['--d' as string]: `${-k * 1.6}s` }}>
            <span className="avatar-fx-orbit-y absolute inset-0">
              <span className={`avatar-fx-moon avatar-fx-moon-${k} absolute left-1/2 top-1/2 rounded-full`} />
            </span>
          </span>
        ))}
      </span>
    );
  if (life === 'starfall')
    return (
      <span className="pointer-events-none absolute -inset-[42%] -z-10 overflow-hidden rounded-full" aria-hidden>
        {[18, 46, 70, 32].map((y, k) => (
          <span key={k} className="avatar-fx-fall absolute inset-0">
            <i className="avatar-fx-fall-star absolute" style={{ top: `${y}%`, animationDelay: `${k * 0.85}s` }} />
          </span>
        ))}
      </span>
    );
  if (life === 'seraph')
    return (
      <>
        <span className="pointer-events-none absolute -inset-[20%] -z-10 rounded-full avatar-fx-seraph-light" aria-hidden />
        <span className="avatar-fx-wing pointer-events-none absolute -z-10" aria-hidden>
          <Wing />
        </span>
        <span className="avatar-fx-wing avatar-fx-wing-r pointer-events-none absolute -z-10" aria-hidden>
          <Wing />
        </span>
        <span className="avatar-fx-halo pointer-events-none absolute" aria-hidden />
        {[22, 50, 78, 36, 64].map((x, k) => (
          <span key={k} className="avatar-fx-mote pointer-events-none absolute rounded-full" style={{ left: `${x}%`, animationDelay: `${k * 0.55}s` }} aria-hidden />
        ))}
      </>
    );
  return (
    <>
      <span className="avatar-fx-stars pointer-events-none absolute -inset-[34%] -z-10 rounded-full" aria-hidden />
      <span className="avatar-fx-gyro pointer-events-none absolute -inset-[26%] rounded-full" aria-hidden />
      <span className="avatar-fx-gyro avatar-fx-gyro-2 pointer-events-none absolute -inset-[26%] rounded-full" aria-hidden />
    </>
  );
}

const BEYOND = new Set<Frame['life']>(['aurora', 'orbit', 'starfall', 'seraph', 'cosmos']);

/** Gems round an Ascendant ring (IV and up): north, east, south, west. */
const PIPS = [
  [50, -19],
  [119, 50],
  [50, 119],
  [-19, 50],
];

/**
 * Ascendant (src/casino/frames.ts): a frame won again, evolution by evolution. I a bright rim on the ring;
 * II a stronger light; III a gleam sweeping round it; IV four gems; V a second, golden ring; VI marks turning on
 * it; VII lights orbiting; VIII rays turning behind; IX a crown and stars for gems; X every colour, breathing.
 */
function Ascendant({ level, frame }: { level: number; frame: Frame }) {
  const crown = level >= 9 && frame.ornament?.at !== 'top';
  return (
    <>
      {level >= 8 && <span className="asc-rays pointer-events-none absolute -inset-[62%] -z-10 rounded-full" aria-hidden />}
      {level >= 10 && <span className="asc-aura pointer-events-none absolute -inset-[38%] -z-10 rounded-full" aria-hidden />}
      {level >= 5 && <span className={`asc-outer pointer-events-none absolute -inset-[27%] rounded-full ${level >= 10 ? 'asc-outer-prism' : ''}`} aria-hidden />}
      {level >= 6 && <span className="asc-ticks pointer-events-none absolute -inset-[33%] rounded-full" aria-hidden />}
      {level >= 7 &&
        [0, 1, 2].map((k) => (
          <span key={k} className="asc-orbit pointer-events-none absolute -inset-[27%]" style={{ animationDelay: `${-k * 2}s` }} aria-hidden>
            <i />
          </span>
        ))}
      {level >= 4 &&
        PIPS.map(([x, y], i) => (
          <span key={i} className={`asc-pip pointer-events-none absolute ${level >= 9 ? 'asc-pip-star' : ''}`} style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${i * 0.4}s` }} aria-hidden>
            <Glyph g={level >= 9 ? '✦' : '◆'} />
          </span>
        ))}
      {crown && (
        <span className="asc-crown pointer-events-none absolute" aria-hidden>
          <Glyph g="♛" />
        </span>
      )}
    </>
  );
}

/** A frame's ring, glow, ornament and life, around whatever it holds (sized by the child). */
export function FrameRing({ frame, children, className = '', level = 0, badge = false }: { frame: Frame | undefined; children: ReactNode; className?: string; level?: number; badge?: boolean }) {
  if (!frame) return <span className={`relative inline-block ${className}`}>{children}</span>;
  const beyond = BEYOND.has(frame.life);
  const asc = frame.earn ? 0 : level;
  const light = frame.glow ?? FRAME_RARITY_COLOR[frame.rarity];
  const glow = asc >= 2 ? `drop-shadow(0 0 3px ${light}) drop-shadow(0 0 ${asc >= 6 ? 9 : 6}px ${light})` : frame.glow ? `drop-shadow(0 0 3px ${frame.glow})` : undefined;
  return (
    <span className={`avatar-frame relative inline-block ${beyond || asc >= 8 ? 'isolate' : ''} ${asc ? `asc asc-${asc}` : ''} ${className}`} style={asc ? { ['--asc' as string]: light } : undefined}>
      {asc > 0 && <Ascendant level={asc} frame={frame} />}
      {beyond && <BeyondLife life={frame.life as Beyond} />}
      {frame.icon ? (
        <span className={`avatar-icon-${frame.icon} relative block rounded-full`}>
          {children}
          {(frame.icon === 'sheen' || frame.icon === 'prism') && <span className="avatar-icon-shine pointer-events-none absolute inset-0 overflow-hidden rounded-full" aria-hidden />}
        </span>
      ) : (
        children
      )}
      <span className="pointer-events-none absolute -inset-[16%]" style={glow ? { filter: glow } : undefined} aria-hidden>
        <span className={`avatar-frame-ring absolute inset-0 rounded-full ${(frame.life && RING_LIFE[frame.life]) ?? ''}`} style={{ background: frame.ring }} />
        {/* A black hole's light bending round it; a supernova's shock ring racing out. */}
        {frame.life === 'blackhole' && <span className="avatar-frame-halo absolute -inset-[10%] rounded-full" />}
        {frame.life === 'supernova' && <span className="avatar-frame-shock absolute inset-0 rounded-full" />}
        {/* Ascendant I: a bright rim; III: a gleam going round. */}
        {asc >= 1 && <span className="avatar-frame-ring asc-rim absolute inset-0 rounded-full" />}
        {asc >= 3 && <span className="avatar-frame-ring asc-gleam absolute inset-0 rounded-full" />}
      </span>
      {(frame.life === 'twinkle' || frame.life === 'flicker' || frame.life === 'supernova') &&
        TWINKLES.map(([x, y], i) => (
          <span key={i} className={`${frame.life === 'flicker' ? 'avatar-frame-spark' : 'avatar-frame-twinkle'} pointer-events-none absolute`} style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${i * (frame.life === 'flicker' ? 0.23 : 0.37)}s` }} aria-hidden>
            <Glyph g={frame.sparkle ?? '✦'} />
          </span>
        ))}
      {frame.life === 'drift' &&
        DRIFTS.map(([x, y], i) => (
          <span key={i} className="avatar-frame-drift pointer-events-none absolute" style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${i * 0.9}s` }} aria-hidden>
            <Glyph g={frame.sparkle ?? '✦'} />
          </span>
        ))}
      {frame.ornament && (
        <span className={`avatar-frame-orn avatar-frame-orn-${frame.ornament.at} pointer-events-none absolute`} aria-hidden>
          <Glyph g={frame.ornament.glyph} />
        </span>
      )}
      {badge && asc > 0 && (
        <span className="asc-badge pointer-events-none absolute" aria-label={`Ascendant ${ROMAN[asc]}`}>
          {ROMAN[asc]}
        </span>
      )}
    </span>
  );
}

/** The frame the player wears, with its evolution ("<id>@<evolution>", src/casino/frames.ts wornFrameId), as friends see it. */
export const useWornFrame = () => useProgress((s) => wornFrameId(s.frame, s.frameCopies));

/** A frame worn (by id, maybe with its evolution: "<id>@<n>"), around an icon. */
export function AvatarFrame({ frame, children, className }: { frame: string | null | undefined; children: ReactNode; className?: string }) {
  const { frame: f, level } = parseWorn(frame);
  return (
    <FrameRing frame={f} level={level} className={className}>
      {children}
    </FrameRing>
  );
}
