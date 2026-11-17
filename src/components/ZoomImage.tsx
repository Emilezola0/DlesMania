import { useState } from 'react';

/** Zoom level and blur (px) for each wrong-guess step; the full frame is shown once the round ends. */
const STEPS: [number, number][] = [
  [3.2, 2],
  [2.5, 1],
  [1.9, 0.5],
  [1.5, 0],
  [1.2, 0],
  [1, 0],
];

interface Props {
  src: string;
  alt: string;
  step: number;
  revealed: boolean;
  /** Point to zoom into, as [x%, y%] of the image. Centre by default, away from corner UI. */
  focus?: [number, number];
  label?: string;
  onError?: () => void;
}

/** The tallest the frame gets (px): a tall character stays on screen. */
const MAX_HEIGHT = 440;

/**
 * A scene that starts as a tight crop and pulls back with every miss. The frame takes the picture's own shape (a
 * standing character tall, a scene wide), so nothing of it is cut off, and once revealed it shows whole.
 */
export function ZoomImage({ src, alt, step, revealed, focus = [50, 50], label = 'Zooms out with each miss', onError }: Props) {
  const [loaded, setLoaded] = useState(false);
  /** Width ÷ height of the picture, kept between a tall portrait and a wide screenshot. */
  const [ratio, setRatio] = useState(16 / 10);
  const [scale, blur] = revealed ? [1, 0] : STEPS[Math.min(step, STEPS.length - 1)];

  return (
    <div className="relative mx-auto w-full max-w-xl overflow-hidden rounded-md border border-rule bg-tile" style={{ aspectRatio: String(ratio), maxWidth: `min(36rem, ${Math.round(MAX_HEIGHT * ratio)}px)` }}>
      {!loaded && <div className="absolute inset-0 animate-pulse bg-tile" />}
      <img
        src={src}
        alt={revealed ? alt : 'Mystery scene'}
        draggable={false}
        onLoad={(e) => {
          const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
          if (w && h) setRatio(Math.min(1.8, Math.max(0.6, w / h)));
          setLoaded(true);
        }}
        onError={onError}
        onContextMenu={(e) => !revealed && e.preventDefault()}
        className={`size-full select-none ${revealed ? 'object-contain' : 'object-cover'} transition-[transform,filter] duration-700 ease-out`}
        style={{ transform: `scale(${scale})`, transformOrigin: `${focus[0]}% ${focus[1]}%`, filter: `blur(${blur}px)` }}
      />
      {!revealed && (
        <span className="absolute bottom-2 right-2 rounded-sm bg-ink/75 px-2 py-0.5 font-display text-[10px] font-semibold tracking-wider text-paper">
          ×{scale.toFixed(1)} · {label}
        </span>
      )}
    </div>
  );
}
