import { useEffect, useMemo, useState } from 'react';
import { FIREBASE_CONFIG } from '../cloud/config';
import { useCloud } from '../cloud/state';
import { COLLECTIBLE } from '../gacha/cards';
import { sfx } from '../lib/sfx';
import { useProgress } from '../store/progress';

/** Which completion (album size) this device already told everyone of, and whose account it was. */
const ANNOUNCED_KEY = 'omnidle-album-announced';
const ME_KEY = 'omnidle-album-me';
/** The newest completion this player has seen (ms); a first visit is told of the last week's. */
const SEEN_KEY = 'omnidle-album-news-seen';
const FIRST_VISIT_MS = 7 * 24 * 3600 * 1000;

const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    // Not remembered: told again next time, that's all.
  }
};

interface Completion {
  uid: string;
  name: string;
  cards: number;
  at: number;
}

/** The latest completions, from Firestore's REST API (no Firebase to load; anyone may read them). */
async function latest(): Promise<Completion[]> {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents:runQuery?key=${FIREBASE_CONFIG.apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'albums' }], orderBy: [{ field: { fieldPath: 'at' }, direction: 'DESCENDING' }], limit: 10 } }),
  });
  if (!res.ok) return [];
  const rows = (await res.json()) as { document?: { fields?: Record<string, { stringValue?: string; integerValue?: string }> } }[];
  return rows.flatMap((r) => {
    const f = r.document?.fields;
    if (!f) return [];
    return [{ uid: f.uid?.stringValue ?? '', name: f.name?.stringValue || 'A player', cards: Number(f.cards?.integerValue ?? 0), at: Number(f.at?.integerValue ?? 0) }];
  });
}

/**
 * An album completed — at least one copy of every card — is an event: a signed-in player who gets there
 * is announced to everyone (src/cloud/albums.ts), and every player is told, the next time they come, of
 * the completions since their last visit, with a sound, until they close it.
 */
export function AlbumNews() {
  const owned = useProgress((s) => s.cards);
  const lang = useProgress((s) => s.nameLang);
  const status = useCloud((s) => s.status);
  const [news, setNews] = useState<Completion[]>([]);

  // This player's album complete, signed in, not told yet for this album: everyone is told.
  const complete = useMemo(() => COLLECTIBLE.every((c) => (owned[c.id] ?? 0) > 0), [owned]);
  useEffect(() => {
    if (!complete || (status !== 'synced' && status !== 'syncing') || read(ANNOUNCED_KEY) === String(COLLECTIBLE.length)) return;
    void import('../cloud/albums')
      .then((m) => m.announceAlbum(COLLECTIBLE.length))
      .then((uid) => {
        if (!uid) return;
        write(ANNOUNCED_KEY, String(COLLECTIBLE.length));
        write(ME_KEY, uid);
      })
      .catch(() => {
        // Tried again next time.
      });
  }, [complete, status]);

  // The completions since this player's last visit (others' only).
  useEffect(() => {
    if (import.meta.env.DEV && !/[?&]albumnews/.test(window.location.href)) return;
    const t = window.setTimeout(() => {
      void latest()
        .then((xs) => {
          const seen = Number(read(SEEN_KEY) ?? 0) || Date.now() - FIRST_VISIT_MS;
          const me = read(ME_KEY);
          const fresh = xs.filter((x) => x.at > seen && x.uid !== me);
          if (fresh.length) {
            setNews(fresh);
            sfx.streak();
          }
        })
        .catch(() => {});
    }, 2500);
    return () => window.clearTimeout(t);
  }, []);

  if (!news.length) return null;
  const fr = lang === 'fr';
  const close = () => {
    write(SEEN_KEY, String(Math.max(...news.map((x) => x.at))));
    setNews([]);
  };
  return (
    <div role="status" className="animate-pop fixed inset-x-3 top-16 z-40 mx-auto flex max-w-md items-start gap-3 rounded-md border border-ochre bg-card px-4 py-3 shadow-2xl">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ochre text-lg" aria-hidden>
        🏆
      </span>
      <div className="min-w-0 flex-1 space-y-1 text-sm">
        {news.map((x) => (
          <p key={`${x.uid}:${x.at}`}>
            <span className="font-bold">{x.name}</span>{' '}
            {fr ? `a complété son album : les ${x.cards} cartes !` : `completed their album: all ${x.cards} cards!`}
          </p>
        ))}
      </div>
      <button type="button" onClick={close} className="shrink-0 text-ink-soft hover:text-ink" aria-label={fr ? 'Fermer' : 'Close'}>
        ✕
      </button>
    </div>
  );
}
