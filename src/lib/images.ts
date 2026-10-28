// Pictures a game waits for: a timer shouldn't run while the thing it times is still loading.
// A broken or very slow picture counts as ready after a while, so nothing waits forever.
import { useEffect, useState } from 'react';

const READY_AFTER_MS = 6000;

const done = new Set<string>();
const loading = new Map<string, Promise<void>>();
const elements = new Map<string, HTMLImageElement>();

/** The one image element for a picture (canvas games draw from it), loading it the first time. */
export function getImage(src: string): HTMLImageElement {
  void preload(src);
  return elements.get(src)!;
}

/** Starts loading a picture; resolves once it's loaded, failed, or taken too long. */
export function preload(src: string | undefined): Promise<void> {
  if (!src || done.has(src)) return Promise.resolve();
  let p = loading.get(src);
  if (!p) {
    const img = new Image();
    img.decoding = 'async';
    elements.set(src, img);
    p = new Promise<void>((resolve) => {
      const finish = () => (done.add(src), loading.delete(src), resolve());
      img.onload = finish;
      img.onerror = finish;
      window.setTimeout(finish, READY_AFTER_MS);
    });
    img.src = src;
    loading.set(src, p);
  }
  return p;
}

export const isReady = (src: string | undefined) => !src || done.has(src);

/** True once every picture given is ready (see `preload`); false again when the list changes to new ones. */
export function useImagesReady(srcs: (string | undefined)[]): boolean {
  const key = srcs.filter(Boolean).join('\n');
  const [ready, setReady] = useState(() => srcs.every(isReady));
  useEffect(() => {
    const list = key ? key.split('\n') : [];
    if (list.every(isReady)) return setReady(true);
    setReady(false);
    let live = true;
    void Promise.all(list.map(preload)).then(() => live && setReady(true));
    return () => {
      live = false;
    };
  }, [key]);
  return ready && srcs.every(isReady);
}
