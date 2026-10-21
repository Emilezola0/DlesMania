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

/** A scene that starts as a tight crop and pulls back with every miss. */
export function ZoomImage({ src, alt, step, revealed, focus = [50, 50], label = 'Zooms out with each miss', onError }: Props) {
  const [loaded, setLoaded] = useState(false);
  const [scale, blur] = revealed ? [1, 0] : STEPS[Math.min(step, STEPS.length - 1)];

  return (
    <div className="relative mx-auto aspect-[16/10] w-full max-w-xl overflow-hidden rounded-md border border-rule bg-tile">
      {!loaded && <div className="absolute inset-0 animate-pulse bg-tile" />}
      <img
        src={src}
        alt={revealed ? alt : 'Mystery scene'}
        draggable={false}
        onLoad={() => setLoaded(true)}
        onError={onError}
        onContextMenu={(e) => !revealed && e.preventDefault()}
        className="size-full select-none object-cover transition-[transform,filter] duration-700 ease-out"
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
