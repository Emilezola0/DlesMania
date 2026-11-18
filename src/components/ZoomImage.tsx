import { useEffect, useState } from 'react';

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

/** Whether each picture has see-through parts, once measured (by its address). */
const seeThrough = new Map<string, boolean>();

/**
 * Whether a picture has transparent pixels (a cut-out character) or none (a screenshot, a splash art): read from a small
 * copy of it. A picture that can't be read (its site forbids it) counts as a cut-out when it's a PNG, WebP or GIF.
 */
function useSeeThrough(src: string): boolean | null {
  const [known, setKnown] = useState<boolean | null>(() => seeThrough.get(src) ?? null);
  useEffect(() => {
    if (seeThrough.has(src)) return setKnown(seeThrough.get(src)!);
    setKnown(null);
    let live = true;
    const done = (v: boolean) => {
      seeThrough.set(src, v);
      if (live) setKnown(v);
    };
    const guess = () => done(/\.(png|webp|gif)(\?|\/|$)/i.test(src));
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const size = 48;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return guess();
        ctx.drawImage(img, 0, 0, size, size);
        const px = ctx.getImageData(0, 0, size, size).data;
        let clear = 0;
        for (let i = 3; i < px.length; i += 4) if (px[i] < 250) clear++;
        // A few soft pixels on an edge aren't a cut-out: 2% of the picture at least.
        done(clear > size * size * 0.02);
      } catch {
        guess();
      }
    };
    img.onerror = guess;
    img.src = src;
    return () => {
      live = false;
    };
  }, [src]);
  return known;
}

/**
 * A scene that starts as a tight crop and pulls back with every miss. The frame takes the picture's own shape (a
 * standing character tall, a scene wide). Fully pulled back (the last miss, or the round over), a cut-out picture shows
 * whole, and a picture without transparency fills the frame edge to edge, as far out as it can go without empty bands.
 */
export function ZoomImage({ src, alt, step, revealed, focus = [50, 50], label = 'Zooms out with each miss', onError }: Props) {
  const [loaded, setLoaded] = useState(false);
  /** Width ÷ height of the picture, kept between a tall portrait and a wide screenshot. */
  const [ratio, setRatio] = useState(16 / 10);
  const cutOut = useSeeThrough(src);
  const [scale, blur] = revealed ? [1, 0] : STEPS[Math.min(step, STEPS.length - 1)];
  const fullyOut = scale === 1;
  // Zoomed in, the picture covers the frame. Fully out: whole if it's a cut-out, else still covering (no bands).
  const fit = fullyOut && cutOut ? 'object-contain' : 'object-cover';

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
        className={`size-full select-none ${fit} transition-[transform,filter] duration-700 ease-out`}
        // Fully out, the zoom's own anchor is dropped: the picture sits centred, nothing of it pushed off one side.
        style={{ transform: `scale(${scale})`, transformOrigin: fullyOut ? '50% 50%' : `${focus[0]}% ${focus[1]}%`, filter: `blur(${blur}px)` }}
      />
      {!revealed && (
        <span className="absolute bottom-2 right-2 rounded-sm bg-ink/75 px-2 py-0.5 font-display text-[10px] font-semibold tracking-wider text-paper">
          ×{scale.toFixed(1)} · {label}
        </span>
      )}
    </div>
  );
}
