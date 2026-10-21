import { useEffect, useState } from 'react';

/** How often to look for a new build, and never more than once per this gap on focus. */
const POLL_MS = 5 * 60 * 1000;
const MIN_GAP_MS = 30 * 1000;

/**
 * Asks the server which build is live (version.json, written by vite.config.ts) and compares it with
 * the build this page was compiled as. Errors and missing files (dev server, a deploy in progress)
 * count as "no news".
 */
async function liveVersion(): Promise<string | null> {
  try {
    const res = await fetch(`./version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = (await res.json()) as { version?: string };
    return typeof data.version === 'string' ? data.version : null;
  } catch {
    return null;
  }
}

/**
 * A small bar at the bottom of the screen when a newer version of the site has been deployed,
 * checked every few minutes and whenever the tab comes back into view. Progress lives in
 * localStorage, so reloading loses nothing; the player can also dismiss it until the next build.
 */
export function UpdateBanner() {
  const [available, setAvailable] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [reloading, setReloading] = useState(false);

  useEffect(() => {
    if (import.meta.env.DEV) return;
    let last = 0;
    const check = async () => {
      if (Date.now() - last < MIN_GAP_MS) return;
      last = Date.now();
      const v = await liveVersion();
      if (v && v !== __APP_VERSION__) setAvailable(v);
    };
    void check();
    const id = window.setInterval(check, POLL_MS);
    const onVisible = () => document.visibilityState === 'visible' && void check();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, []);

  if (!available || dismissed === available) return null;
  return (
    <div role="status" className="animate-pop fixed inset-x-3 bottom-3 z-40 mx-auto flex max-w-md items-center gap-3 rounded-md border border-accent bg-card px-4 py-3 shadow-2xl">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent font-display text-sm font-bold text-on-strong" aria-hidden>
        ↻
      </span>
      <p className="min-w-0 flex-1 text-sm">
        <b className="font-display tracking-wider">A new update is available!</b>
        <span className="block text-ink-soft">Reload to get it — your progress is kept.</span>
      </p>
      <button
        type="button"
        disabled={reloading}
        onClick={() => {
          setReloading(true);
          window.location.reload();
        }}
        className="btn-accent shrink-0 rounded-md px-3 py-2 font-display text-sm font-bold tracking-wider"
      >
        {reloading ? '…' : 'Update'}
      </button>
      <button type="button" onClick={() => setDismissed(available)} aria-label="Not now" className="shrink-0 rounded-md p-1 text-lg leading-none text-ink-faint hover:text-ink">
        ×
      </button>
    </div>
  );
}
