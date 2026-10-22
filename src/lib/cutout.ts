import { useEffect, useState } from 'react';

/** Cut-outs made so far, by source URL (object URLs, or the source itself when cutting failed). */
const cache = new Map<string, Promise<string>>();

/** Near-white, near-grey: background, not a pale costume colour. */
const isBackground = (r: number, g: number, b: number) => r > 232 && g > 232 && b > 232 && Math.max(r, g, b) - Math.min(r, g, b) < 18;

/**
 * Makes the white background of a picture transparent: a flood fill from the edges, so only white
 * connected to the border goes (white hair or clothes inside the figure stay). Needs a CORS-enabled
 * image; anything that fails falls back to the original picture.
 */
function cutOut(src: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onerror = () => resolve(src);
    img.onload = () => {
      try {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, w, h);
        const px = data.data;
        const seen = new Uint8Array(w * h);
        const stack: number[] = [];
        const push = (i: number) => {
          if (seen[i]) return;
          seen[i] = 1;
          const o = i * 4;
          // Already transparent, or white: background, keep spreading.
          if (px[o + 3] < 20 || isBackground(px[o], px[o + 1], px[o + 2])) stack.push(i);
        };
        for (let x = 0; x < w; x++) push(x), push((h - 1) * w + x);
        for (let y = 0; y < h; y++) push(y * w), push(y * w + w - 1);
        while (stack.length) {
          const i = stack.pop()!;
          px[i * 4 + 3] = 0;
          const x = i % w;
          if (x > 0) push(i - 1);
          if (x < w - 1) push(i + 1);
          if (i >= w) push(i - w);
          if (i < w * (h - 1)) push(i + w);
        }
        ctx.putImageData(data, 0, 0);
        canvas.toBlob((blob) => resolve(blob ? URL.createObjectURL(blob) : src), 'image/png');
      } catch {
        resolve(src);
      }
    };
    img.src = src;
  });
}

/** The picture with its white background removed (`null` while it's being cut), or as is when `enabled` is false. */
export function useCutout(src: string | undefined, enabled: boolean): string | null {
  const [url, setUrl] = useState<string | null>(enabled ? null : (src ?? null));
  useEffect(() => {
    if (!src) return setUrl(null);
    if (!enabled) return setUrl(src);
    let live = true;
    setUrl(null);
    cutoutUrl(src).then((u) => live && setUrl(u));
    return () => {
      live = false;
    };
  }, [src, enabled]);
  return url;
}

/** The cut-out of a picture (made once, then shared). */
export function cutoutUrl(src: string): Promise<string> {
  if (!cache.has(src)) cache.set(src, cutOut(src));
  return cache.get(src)!;
}

/** Starts cutting pictures ahead of time (the next silhouettes). */
export function prepareCutout(src: string) {
  void cutoutUrl(src);
}
