import { useState } from 'react';

/** Blur (px) and greyscale for each wrong-guess step; the image is fully clear once the round ends. */
const STEPS: [number, number][] = [
  [28, 1],
  [18, 0.8],
  [11, 0.55],
  [6, 0.3],
  [3, 0.1],
  [1, 0],
];

interface Props {
  src: string;
  alt: string;
  step: number;
  revealed: boolean;
  onError?: () => void;
}

/** An image that starts as a blurred, desaturated blob and sharpens with every miss. */
export function BlurImage({ src, alt, step, revealed, onError }: Props) {
  const [loaded, setLoaded] = useState(false);
  const [blur, grey] = revealed ? [0, 0] : STEPS[Math.min(step, STEPS.length - 1)];

  return (
    <div className="relative mx-auto aspect-[4/3] w-full max-w-md overflow-hidden rounded-xl bg-tile">
      {!loaded && <div className="absolute inset-0 animate-pulse bg-tile" />}
      <img
        src={src}
        alt={revealed ? alt : 'Mystery image'}
        draggable={false}
        onLoad={() => setLoaded(true)}
        onError={onError}
        onContextMenu={(e) => !revealed && e.preventDefault()}
        className="size-full select-none object-contain transition-[filter,transform] duration-700 ease-out"
        // Scale up while blurred so soft edges don't reveal the frame.
        style={{ filter: `blur(${blur}px) grayscale(${grey})`, transform: `scale(${1 + blur / 100})` }}
      />
      {!revealed && <span className="absolute bottom-2 right-2 rounded-sm bg-ink/75 px-2 py-0.5 font-display text-[10px] font-semibold tracking-wider text-paper">Clears with each miss</span>}
    </div>
  );
}
