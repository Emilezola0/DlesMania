import { useEffect, useRef, useState } from 'react';
import { Spinner } from '../components/Spinner';

/** Block size in pixels for each wrong-guess step; the last value is the clean image. */
const STEPS = [36, 26, 18, 12, 8, 4, 1];
const SIZE = 320;

interface Props {
  /**
   * The pictures to pixelate, best first (the cover, then stand-ins): each tried in turn until one loads. No
   * emoji ever stands in for a picture: while one loads the square stays dark, and if none loads, `onFail`.
   */
  srcs: string[];
  step: number;
  /** Which of `srcs` is shown, once one has loaded. */
  onShown?: (index: number) => void;
  onFail?: () => void;
}

/**
 * Wikimedia sometimes turns a busy hotlink away; its thumbnail of the same file is served from another cache.
 * "…/wikipedia/en/a/a1/X.jpg" → "…/wikipedia/en/thumb/a/a1/X.jpg/250px-X.jpg" (one of the sizes it serves).
 */
export function withThumbs(srcs: (string | undefined)[]): string[] {
  const out: string[] = [];
  for (const src of srcs) {
    if (!src) continue;
    out.push(src);
    const m = /^(https:\/\/upload\.wikimedia\.org\/wikipedia\/[^/]+)\/([0-9a-f]\/[0-9a-f]{2})\/([^/?#]+)$/.exec(src);
    if (m) out.push(`${m[1]}/thumb/${m[2]}/${m[3]}/250px-${m[3]}`);
  }
  return [...new Set(out)];
}

/** Draws `img` like CSS object-fit: cover into the square. */
function drawCover(s: CanvasRenderingContext2D, img: HTMLImageElement) {
  const scale = Math.max(SIZE / img.naturalWidth, SIZE / img.naturalHeight);
  const w = img.naturalWidth * scale;
  const h = img.naturalHeight * scale;
  s.drawImage(img, (SIZE - w) / 2, (SIZE - h) / 2, w, h);
}

/** Renders a cover and pixelates it progressively. */
export function PixelCanvas({ srcs, step, onShown, onFail }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [failed, setFailed] = useState(false);
  const key = srcs.join('|');

  useEffect(() => {
    setImg(null);
    setFailed(false);
    let cancelled = false;
    const tryAt = (k: number) => {
      if (cancelled) return;
      if (k >= srcs.length) return void (setFailed(true), onFail?.());
      const i = new Image();
      i.onload = () => {
        if (cancelled) return;
        setImg(i);
        onShown?.(k);
      };
      i.onerror = () => tryAt(k + 1);
      i.src = srcs[k];
    };
    tryAt(0);
    return () => {
      cancelled = true;
    };
    // The same list of pictures: the same attempt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, SIZE, SIZE);
    if (!img) return;
    const src2d = document.createElement('canvas');
    src2d.width = src2d.height = SIZE;
    drawCover(src2d.getContext('2d')!, img);

    const block = STEPS[Math.min(step, STEPS.length - 1)];
    const small = Math.max(1, Math.round(SIZE / block));
    const tmp = document.createElement('canvas');
    tmp.width = tmp.height = small;
    tmp.getContext('2d')!.drawImage(src2d, 0, 0, small, small);

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tmp, 0, 0, small, small, 0, 0, SIZE, SIZE);
  }, [img, step]);

  return (
    <div className="relative mx-auto aspect-square w-full max-w-72">
      <canvas
        ref={ref}
        width={SIZE}
        height={SIZE}
        className="size-full rounded-xl bg-tile shadow-2xl shadow-ink/30 transition-transform duration-300"
        style={{ imageRendering: 'pixelated' }}
      />
      {!img && !failed && (
        <span className="absolute inset-0 grid place-items-center text-ink-faint">
          <Spinner className="size-8" />
        </span>
      )}
    </div>
  );
}
