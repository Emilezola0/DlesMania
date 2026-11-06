// Pictures a game waits for: a timer shouldn't run while the thing it times is still loading.
// A broken or very slow picture counts as ready after a while, so nothing waits forever.
import { useEffect, useState } from 'react';

const READY_AFTER_MS = 6000;

const done = new Set<string>();
/** Pictures that would not load (a dead link, a site refusing them): games leave them out. */
const failed = new Set<string>();
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
      img.onerror = () => (failed.add(src), finish());
      window.setTimeout(finish, READY_AFTER_MS);
    });
    img.src = src;
    loading.set(src, p);
  }
  return p;
}

/** On screen (at least partly): a picture scrolled away or hidden doesn't hold anything up. */
function inView(el: Element): boolean {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < window.innerHeight && r.left < window.innerWidth;
}

/**
 * Is a picture or a video on screen still loading? Timers wait while one is (see useCountdown), so a slow
 * connection never eats a question's time.
 */
export function mediaLoading(root: ParentNode | null = document.querySelector('main')): boolean {
  if (!root) return false;
  for (const img of root.querySelectorAll('img')) if (!img.complete && inView(img)) return true;
  for (const v of root.querySelectorAll('video')) if (v.readyState < 2 && !v.error && v.preload !== 'none' && inView(v)) return true;
  return false;
}

export const isReady = (src: string | undefined) => !src || done.has(src);
/** A picture that failed to load (known only once it was tried). */
export const isBroken = (src: string | undefined) => !!src && failed.has(src);
/** Starts loading many pictures at once, a few at a time, so the first ones aren't held up by the rest. */
export async function preloadAll(srcs: (string | undefined)[], atOnce = 6): Promise<void> {
  const list = [...new Set(srcs.filter((s): s is string => !!s))];
  let next = 0;
  const worker = async () => {
    while (next < list.length) await preload(list[next++]);
  };
  await Promise.all(Array.from({ length: Math.min(atOnce, list.length) }, worker));
}

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
