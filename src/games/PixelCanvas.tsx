import { useEffect, useRef, useState } from 'react';

/** Block size in pixels for each wrong-guess step; the last value is the clean image. */
const STEPS = [36, 26, 18, 12, 8, 4, 1];
const SIZE = 320;

interface Props {
  /** Real cover art. Falls back to the generated glyph cover if missing or it fails to load. */
  src?: string;
  icon: string;
  colors: [string, string];
  step: number;
}

function drawGlyph(s: CanvasRenderingContext2D, icon: string, colors: [string, string]) {
  const grad = s.createLinearGradient(0, 0, SIZE, SIZE);
  grad.addColorStop(0, colors[0]);
  grad.addColorStop(1, colors[1]);
  s.fillStyle = grad;
  s.fillRect(0, 0, SIZE, SIZE);
  s.font = `${SIZE * 0.7}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`;
  s.textAlign = 'center';
  s.textBaseline = 'middle';
  s.fillText(icon, SIZE / 2, SIZE / 2 + SIZE * 0.04);
}

/** Draws `img` like CSS object-fit: cover into the square. */
function drawCover(s: CanvasRenderingContext2D, img: HTMLImageElement) {
  const scale = Math.max(SIZE / img.naturalWidth, SIZE / img.naturalHeight);
  const w = img.naturalWidth * scale;
  const h = img.naturalHeight * scale;
  s.drawImage(img, (SIZE - w) / 2, (SIZE - h) / 2, w, h);
}

/** Renders a cover and pixelates it progressively. */
export function PixelCanvas({ src, icon, colors, step }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    setImg(null);
    if (!src) return;
    const i = new Image();
    i.onload = () => setImg(i);
    i.src = src;
  }, [src]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const src2d = document.createElement('canvas');
    src2d.width = src2d.height = SIZE;
    const s = src2d.getContext('2d')!;
    if (img) drawCover(s, img);
    else drawGlyph(s, icon, colors);

    const block = STEPS[Math.min(step, STEPS.length - 1)];
    const small = Math.max(1, Math.round(SIZE / block));
    const tmp = document.createElement('canvas');
    tmp.width = tmp.height = small;
    tmp.getContext('2d')!.drawImage(src2d, 0, 0, small, small);

    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.drawImage(tmp, 0, 0, small, small, 0, 0, SIZE, SIZE);
  }, [img, icon, colors, step]);

  return (
    <canvas
      ref={ref}
      width={SIZE}
      height={SIZE}
      className="mx-auto aspect-square w-full max-w-72 rounded-xl shadow-2xl shadow-black/50 transition-transform duration-300"
      style={{ imageRendering: 'pixelated' }}
    />
  );
}
