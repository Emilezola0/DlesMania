import type { ReactNode } from 'react';
import { FRAME_BY_ID, type Frame } from './frames';

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

/** A frame's ring, glow, ornament and life, around whatever it holds (sized by the child). */
export function FrameRing({ frame, children, className = '' }: { frame: Frame | undefined; children: ReactNode; className?: string }) {
  if (!frame) return <span className={`relative inline-block ${className}`}>{children}</span>;
  return (
    <span className={`avatar-frame relative inline-block ${className}`}>
      {children}
      <span className="pointer-events-none absolute -inset-[16%]" style={frame.glow ? { filter: `drop-shadow(0 0 3px ${frame.glow})` } : undefined} aria-hidden>
        <span className={`avatar-frame-ring absolute inset-0 rounded-full ${frame.life === 'spin' ? 'avatar-frame-spin' : frame.life === 'pulse' ? 'avatar-frame-pulse' : ''}`} style={{ background: frame.ring }} />
      </span>
      {frame.life === 'twinkle' &&
        TWINKLES.map(([x, y], i) => (
          <span key={i} className="avatar-frame-twinkle pointer-events-none absolute" style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${i * 0.37}s` }} aria-hidden>
            <Glyph g="✦" />
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
