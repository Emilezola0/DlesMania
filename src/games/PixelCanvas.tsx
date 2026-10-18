import { useEffect, useRef } from 'react';

/** Block size in pixels for each wrong-guess step; the last value is the clean image. */
const STEPS = [36, 26, 18, 12, 8, 4, 1];
const SIZE = 320;

interface Props {
  icon: string;
  colors: [string, string];
  step: number;
}

/** Renders a generated "cover" (gradient + glyph) and pixelates it progressively. */
export function PixelCanvas({ icon, colors, step }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const src = document.createElement('canvas');
    src.width = src.height = SIZE;
    const s = src.getContext('2d')!;
    const grad = s.createLinearGradient(0, 0, SIZE, SIZE);
    grad.addColorStop(0, colors[0]);
    grad.addColorStop(1, colors[1]);
    s.fillStyle = grad;
    s.fillRect(0, 0, SIZE, SIZE);
    s.font = `${SIZE * 0.7}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`;
    s.textAlign = 'center';
    s.textBaseline = 'middle';
    s.fillText(icon, SIZE / 2, SIZE / 2 + SIZE * 0.04);

    const block = STEPS[Math.min(step, STEPS.length - 1)];
    const small = Math.max(1, Math.round(SIZE / block));
    const tmp = document.createElement('canvas');
    tmp.width = tmp.height = small;
    tmp.getContext('2d')!.drawImage(src, 0, 0, small, small);

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.drawImage(tmp, 0, 0, small, small, 0, 0, SIZE, SIZE);
  }, [icon, colors, step]);

  return (
    <canvas
      ref={ref}
      width={SIZE}
      height={SIZE}
      className="mx-auto aspect-square w-full max-w-72 rounded-xl shadow-2xl shadow-black/50"
      style={{ imageRendering: 'pixelated' }}
    />
  );
}
