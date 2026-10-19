import { useMemo } from 'react';
import { hashString, mulberry32 } from '../lib/rng';

/**
 * Procedural glyphs: every name gets its own symbol in Omnidle's invented script,
 * built on a 3×3 grid of nodes like a constructed alphabet. Deterministic, so a
 * category or mini-game always wears the same glyph.
 */
const N = [4, 12, 20]; // node coordinates in a 24×24 box

type Mark = { d: string; fill?: boolean };

function buildGlyph(seed: string): Mark[] {
  const rand = mulberry32(hashString(`glyph:${seed}`));
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
  const marks: Mark[] = [];

  // Spine: every letter has a dominant stroke.
  const spine = pick(['v', 'h', 'd1', 'd2', 'arc'] as const);
  if (spine === 'v') marks.push({ d: `M12 3V21` });
  if (spine === 'h') marks.push({ d: `M3 12H21` });
  if (spine === 'd1') marks.push({ d: `M5 5L19 19` });
  if (spine === 'd2') marks.push({ d: `M19 5L5 19` });
  if (spine === 'arc') marks.push({ d: pick([`M4 18A8 8 0 0 1 20 18`, `M4 6A8 8 0 0 0 20 6`, `M6 4A8 8 0 0 1 6 20`, `M18 4A8 8 0 0 0 18 20`]) });

  // Two or three secondary marks hung on the grid.
  const count = 2 + Math.floor(rand() * 2);
  for (let i = 0; i < count; i++) {
    const x = pick(N);
    const y = pick(N);
    const kind = pick(['bar', 'bar', 'tick', 'dot', 'ring', 'hook', 'chevron'] as const);
    if (kind === 'bar') marks.push({ d: rand() < 0.5 ? `M${x - 5} ${y}H${x + 5}` : `M${x} ${y - 5}V${y + 5}` });
    if (kind === 'tick') marks.push({ d: `M${x - 3} ${y - 3}L${x + 3} ${y + 3}` });
    if (kind === 'dot') marks.push({ d: `M${x} ${y}m-1.8 0a1.8 1.8 0 1 0 3.6 0a1.8 1.8 0 1 0 -3.6 0`, fill: true });
    if (kind === 'ring') marks.push({ d: `M${x} ${y}m-3.2 0a3.2 3.2 0 1 0 6.4 0a3.2 3.2 0 1 0 -6.4 0` });
    if (kind === 'hook') marks.push({ d: `M${x - 4} ${y - 3}Q${x} ${y + 5} ${x + 4} ${y - 3}` });
    if (kind === 'chevron') marks.push({ d: `M${x - 4} ${y + 2}L${x} ${y - 3}L${x + 4} ${y + 2}` });
  }
  return marks;
}

interface Props {
  seed: string;
  size?: number;
  className?: string;
  /** Accessible name; glyphs are decorative when omitted. */
  title?: string;
  strokeWidth?: number;
}

export function Glyph({ seed, size = 24, className = '', title, strokeWidth = 1.8 }: Props) {
  const marks = useMemo(() => buildGlyph(seed), [seed]);
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {marks.map((m, i) => (
        <path key={i} d={m.d} fill={m.fill ? 'currentColor' : 'none'} stroke={m.fill ? 'none' : undefined} />
      ))}
    </svg>
  );
}

/** A glyph set inside a diamond cartouche, used as an emblem. */
export function GlyphSeal({ seed, size = 40, className = '', tone = 'text-ink' }: { seed: string; size?: number; className?: string; tone?: string }) {
  return (
    <span className={`relative inline-flex shrink-0 items-center justify-center ${tone} ${className}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 40 40" className="absolute inset-0 size-full" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden>
        <path d="M20 1.5 38.5 20 20 38.5 1.5 20Z" />
        <path d="M20 5 35 20 20 35 5 20Z" opacity="0.45" />
      </svg>
      <Glyph seed={seed} size={size * 0.48} strokeWidth={2} />
    </span>
  );
}

/** Ornamental divider: rule — diamond — rule. */
export function Ornament({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 text-rule-strong ${className}`} aria-hidden>
      <span className="h-px flex-1 bg-gradient-to-r from-transparent to-rule-strong" />
      <svg width="22" height="10" viewBox="0 0 22 10" fill="currentColor">
        <path d="M11 0 16 5 11 10 6 5Z" />
        <circle cx="2" cy="5" r="1.3" />
        <circle cx="20" cy="5" r="1.3" />
      </svg>
      <span className="h-px flex-1 bg-gradient-to-l from-transparent to-rule-strong" />
    </div>
  );
}
