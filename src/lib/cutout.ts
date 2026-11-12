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

/**
 * How far each pixel is from the nearest one of `mask` (chamfer distance, 1 straight and √2 diagonal: close
 * enough to round), in two passes.
 */
function distanceTo(mask: Uint8Array, w: number, h: number): Float32Array {
  const d = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) d[i] = mask[i] ? 0 : 1e9;
  const D = Math.SQRT2;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (x > 0) d[i] = Math.min(d[i], d[i - 1] + 1);
      if (y > 0) {
        d[i] = Math.min(d[i], d[i - w] + 1);
        if (x > 0) d[i] = Math.min(d[i], d[i - w - 1] + D);
        if (x < w - 1) d[i] = Math.min(d[i], d[i - w + 1] + D);
      }
    }
  for (let y = h - 1; y >= 0; y--)
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (x < w - 1) d[i] = Math.min(d[i], d[i + 1] + 1);
      if (y < h - 1) {
        d[i] = Math.min(d[i], d[i + w] + 1);
        if (x < w - 1) d[i] = Math.min(d[i], d[i + w + 1] + D);
        if (x > 0) d[i] = Math.min(d[i], d[i + w - 1] + D);
      }
    }
  return d;
}

/** How wide a gap between strokes gets shut (px, on a 400 px picture): twice this. 40 chosen side by side with 20 and 60 (a shapeless blot). */
const FILL_CLOSE = 40;

/**
 * Fills a shape on a transparent picture solid, inside its outline (Who's That?'s kanji). First the gaps between
 * its parts are shut: grown by FILL_CLOSE, then shrunk back as much (the outline stays, the notches and slits in
 * the middle fill). Then a flood fill from the edges finds the outside; everything it can't reach turns black.
 * Anything that fails falls back to the original picture.
 */
function fillOutline(src: string, close = FILL_CLOSE): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onerror = () => resolve(src);
    img.onload = () => {
      try {
        const w = img.naturalWidth || 400;
        const h = img.naturalHeight || 400;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, w, h);
        const data = ctx.getImageData(0, 0, w, h);
        const px = data.data;
        // The shape, then shut: within `close` of it is grown; what's still within `close` of the outside of that, shrunk back.
        const shape = new Uint8Array(w * h);
        for (let i = 0; i < w * h; i++) shape[i] = px[i * 4 + 3] >= 128 ? 1 : 0;
        const toShape = distanceTo(shape, w, h);
        const grownOut = new Uint8Array(w * h);
        for (let i = 0; i < w * h; i++) grownOut[i] = toShape[i] > close ? 1 : 0;
        const toOut = distanceTo(grownOut, w, h);
        const solid = new Uint8Array(w * h);
        for (let i = 0; i < w * h; i++) solid[i] = shape[i] || toOut[i] > close ? 1 : 0;
        const outside = new Uint8Array(w * h);
        const stack: number[] = [];
        const push = (i: number) => {
          if (outside[i] || solid[i]) return;
          outside[i] = 1;
          stack.push(i);
        };
        for (let x = 0; x < w; x++) push(x), push((h - 1) * w + x);
        for (let y = 0; y < h; y++) push(y * w), push(y * w + w - 1);
        while (stack.length) {
          const i = stack.pop()!;
          const x = i % w;
          if (x > 0) push(i - 1);
          if (x < w - 1) push(i + 1);
          if (i >= w) push(i - w);
          if (i < w * (h - 1)) push(i + w);
        }
        for (let i = 0; i < w * h; i++) {
          if (outside[i]) continue;
          const o = i * 4;
          px[o] = px[o + 1] = px[o + 2] = 0x1c;
          px[o + 3] = 255;
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

/** How a picture is prepared: its white background cut away, or its shape filled solid inside its outline. */
export type CutoutKind = 'white' | 'fill';
/** The picture prepared (`null` meanwhile): white background removed, or shape filled; as is when `enabled` is false. */
export function useCutout(src: string | undefined, enabled: boolean, kind: CutoutKind = 'white'): string | null {
  const [url, setUrl] = useState<string | null>(enabled ? null : (src ?? null));
  useEffect(() => {
    if (!src) return setUrl(null);
    if (!enabled) return setUrl(src);
    let live = true;
    setUrl(null);
    cutoutUrl(src, kind).then((u) => live && setUrl(u));
    return () => {
      live = false;
    };
  }, [src, enabled, kind]);
  return url;
}

/** The cut-out of a picture (made once, then shared). */
export function cutoutUrl(src: string, kind: CutoutKind = 'white'): Promise<string> {
  const key = `${kind}:${src}`;
  if (!cache.has(key)) cache.set(key, kind === 'fill' ? fillOutline(src) : cutOut(src));
  return cache.get(key)!;
}

/** Starts cutting pictures ahead of time (the next silhouettes). */
export function prepareCutout(src: string, kind: CutoutKind = 'white') {
  void cutoutUrl(src, kind);
}
