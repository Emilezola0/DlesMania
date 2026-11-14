import { useId, type ReactNode } from 'react';
import { FRAME_BY_ID, type Beyond, type Frame } from './frames';

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

/** A frame's ring, glow, ornament and life, around whatever it holds (sized by the child). */
export function FrameRing({ frame, children, className = '' }: { frame: Frame | undefined; children: ReactNode; className?: string }) {
  if (!frame) return <span className={`relative inline-block ${className}`}>{children}</span>;
  const beyond = BEYOND.has(frame.life);
  return (
    <span className={`avatar-frame relative inline-block ${beyond ? 'isolate' : ''} ${className}`}>
      {beyond && <BeyondLife life={frame.life as Beyond} />}
      {frame.icon ? (
        <span className={`avatar-icon-${frame.icon} relative block rounded-full`}>
          {children}
          {(frame.icon === 'sheen' || frame.icon === 'prism') && <span className="avatar-icon-shine pointer-events-none absolute inset-0 overflow-hidden rounded-full" aria-hidden />}
        </span>
      ) : (
        children
      )}
      <span className="pointer-events-none absolute -inset-[16%]" style={frame.glow ? { filter: `drop-shadow(0 0 3px ${frame.glow})` } : undefined} aria-hidden>
        <span className={`avatar-frame-ring absolute inset-0 rounded-full ${(frame.life && RING_LIFE[frame.life]) ?? ''}`} style={{ background: frame.ring }} />
        {/* A black hole's light bending round it; a supernova's shock ring racing out. */}
        {frame.life === 'blackhole' && <span className="avatar-frame-halo absolute -inset-[10%] rounded-full" />}
        {frame.life === 'supernova' && <span className="avatar-frame-shock absolute inset-0 rounded-full" />}
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
    </span>
  );
}

/** The frame the player wears (by id), around their icon. */
export function AvatarFrame({ frame, children, className }: { frame: string | null | undefined; children: ReactNode; className?: string }) {
  return (
    <FrameRing frame={frame ? FRAME_BY_ID.get(frame) : undefined} className={className}>
      {children}
    </FrameRing>
  );
}
