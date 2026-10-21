import { useId, useMemo, useState } from 'react';
import { mulberry32 } from '../lib/rng';

/**
 * How the picture is hidden at each wrong-guess step (fully clear once the round ends):
 *   reveal — share of the grid's windows that show the picture crisply
 *   blur / grey — the fog over everything else
 *   hue / split — colour shift and red/blue channel offset (px) on the clear windows
 *   tilt — rotation of the whole frame, in degrees
 */
const STEPS = [
  { reveal: 0.28, blur: 14, grey: 0.85, hue: 120, split: 4, tilt: 7 },
  { reveal: 0.4, blur: 12, grey: 0.7, hue: 80, split: 3, tilt: 5 },
  { reveal: 0.52, blur: 9, grey: 0.5, hue: 45, split: 2, tilt: 3 },
  { reveal: 0.66, blur: 6, grey: 0.3, hue: 20, split: 1, tilt: 1.5 },
  { reveal: 0.8, blur: 4, grey: 0.15, hue: 0, split: 0, tilt: 0 },
  { reveal: 0.92, blur: 2, grey: 0, hue: 0, split: 0, tilt: 0 },
];

/** Windows per side of the grid. */
const N = 6;

interface Props {
  src: string;
  alt: string;
  /** Wrong guesses so far. */
  step: number;
  revealed: boolean;
  /** Round seed: which windows open, and in what order, is fixed per round. */
  seed: number;
  onError?: () => void;
}

/**
 * Windows open from the middle outwards with some scatter, since the subject is usually central;
 * every later step keeps the earlier windows open and adds more.
 */
function windowOrder(seed: number): number[] {
  const rand = mulberry32(seed);
  const c = (N - 1) / 2;
  return Array.from({ length: N * N }, (_, i) => {
    const d = Math.hypot((i % N) - c, Math.floor(i / N) - c) / c;
    return { i, score: d + rand() * 0.9 };
  })
    .sort((a, b) => a.score - b.score)
    .map((x) => x.i);
}

/**
 * Iconic Item's clue. Instead of one heavy blur over everything, part of the picture shows through
 * clear windows (colour-shifted, with split channels, on a tilted frame) while the rest stays fogged.
 * Each miss opens more windows and calms the distortion, so a sharp eye has a fair first-try chance.
 */
export function ObscuredImage({ src, alt, step, revealed, seed, onError }: Props) {
  const [ratio, setRatio] = useState<number | null>(null);
  const order = useMemo(() => windowOrder(seed), [seed]);
  const filterId = `split-${useId().replace(/:/g, '')}`;
  const s = STEPS[Math.min(step, STEPS.length - 1)];
  const open = new Set(revealed ? order : order.slice(0, Math.round(s.reveal * N * N)));
  const fx = revealed ? { blur: 0, grey: 0, hue: 0, split: 0, tilt: 0 } : s;

  return (
    <div className="relative mx-auto w-full max-w-md overflow-hidden rounded-xl bg-tile" style={{ aspectRatio: ratio ? String(ratio) : '4 / 3' }}>
      {/* Red/blue channel split for the clear windows. */}
      <svg width="0" height="0" className="absolute" aria-hidden>
        <filter id={filterId} x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
          <feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r" />
          <feOffset in="r" dx={fx.split} dy={fx.split / 2} result="r2" />
          <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0" result="gb" />
          <feOffset in="gb" dx={-fx.split} dy={-fx.split / 2} result="gb2" />
          <feBlend in="r2" in2="gb2" mode="screen" />
        </filter>
      </svg>

      {!ratio && <div className="absolute inset-0 animate-pulse bg-tile" />}
      <div
        className="absolute inset-0 transition-transform duration-700 ease-out"
        // Scale with the tilt so the frame's corners never show.
        style={{ transform: `rotate(${fx.tilt}deg) scale(${1 + Math.abs(fx.tilt) / 40 + fx.blur / 120})` }}
        onContextMenu={(e) => !revealed && e.preventDefault()}
      >
        {/* The fog: the whole picture, blurred and drained of colour. */}
        <img
          src={src}
          alt={revealed ? alt : 'Mystery image'}
          draggable={false}
          onLoad={(e) => {
            const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
            if (w && h) setRatio(Math.min(1.8, Math.max(0.6, w / h)));
          }}
          onError={onError}
          className="absolute inset-0 size-full select-none object-cover transition-[filter] duration-700"
          style={{ filter: `blur(${fx.blur}px) grayscale(${fx.grey}) brightness(${revealed ? 1 : 0.85})` }}
        />
        {/* The clear windows: slices of the same picture, colour-shifted until late. */}
        <div
          className="absolute inset-0 grid"
          style={{
            gridTemplateColumns: `repeat(${N}, 1fr)`,
            gridTemplateRows: `repeat(${N}, 1fr)`,
            filter: fx.split || fx.hue ? `url(#${filterId}) hue-rotate(${fx.hue}deg) saturate(${1 + fx.hue / 150})` : undefined,
          }}
          aria-hidden
        >
          {Array.from({ length: N * N }, (_, i) => (
            <div
              key={i}
              className="transition-opacity duration-500"
              style={{
                opacity: open.has(i) ? 1 : 0,
                backgroundImage: `url("${src}")`,
                backgroundSize: `${N * 100}% ${N * 100}%`,
                backgroundPosition: `${((i % N) / (N - 1)) * 100}% ${(Math.floor(i / N) / (N - 1)) * 100}%`,
              }}
            />
          ))}
        </div>
      </div>
      {/* A soft vignette while hidden, so window edges read as part of the effect. */}
      {!revealed && <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_60px_rgba(0,0,0,0.45)]" aria-hidden />}
      {!revealed && (
        <span className="absolute bottom-2 right-2 rounded-sm bg-black/70 px-2 py-0.5 font-display text-[10px] font-semibold tracking-wider text-white">
          More clears with each miss
        </span>
      )}
    </div>
  );
}
