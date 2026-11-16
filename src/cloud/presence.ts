// Who is on an island right now, on the Realtime Database (here/<owner>/<uid>): where each player stands, written a
// few times a second while they move. Firestore counted every one of those writes, and every read of them by each
// player there, against its free daily quota; the Realtime Database counts only the bytes sent (10 GB a month free),
// and removes a player by itself when their tab closes (onDisconnect). The island itself, its book and the saves stay
// on Firestore. The rules: database.rules.json (published in the Firebase console). Used by src/island/live.ts, which
// falls back on Firestore (src/cloud/islands.ts) while the database doesn't answer (not made yet, rules not published).
import { getDatabase, onDisconnect, onValue, ref, remove, serverTimestamp, set, type Database } from 'firebase/database';
import { DATABASE_URL } from './config';
import { app, auth } from './firebase';
import type { HereDoc } from './islands';

/** A player's spot as read back: `at` in milliseconds (the server's clock). */
export type HereRt = Omit<HereDoc, 'at'> & { uid: string; at: number | null };

let base: Database | null = null;
const dbOf = () => (base ??= getDatabase(app, DATABASE_URL));
const spot = (owner: string, uid: string) => ref(dbOf(), `here/${owner}/${uid}`);

/**
 * Follows who's on an island. `fail` once if the database doesn't answer (an error, or nothing within `wait` ms: not
 * made yet); after that, nothing more is said.
 */
export function watchHereRt(owner: string, on: (list: HereRt[]) => void, fail: (why: string) => void, wait = 6000): () => void {
  let answered = false;
  let over = false;
  const give = (why: string) => {
    if (over || answered) return;
    over = true;
    stop();
    fail(why);
  };
  const timer = window.setTimeout(() => give('timeout'), wait);
  let stop = () => {};
  try {
    stop = onValue(
      ref(dbOf(), `here/${owner}`),
      (s) => {
        if (over) return;
        answered = true;
        window.clearTimeout(timer);
        const all = (s.val() ?? {}) as Record<string, Omit<HereRt, 'uid'>>;
        on(Object.entries(all).map(([uid, h]) => ({ ...h, uid, at: typeof h.at === 'number' ? h.at : null })));
      },
      (e) => give(e.message),
    );
  } catch (e) {
    window.clearTimeout(timer);
    give(e instanceof Error ? e.message : String(e));
  }
  return () => {
    over = true;
    window.clearTimeout(timer);
    stop();
  };
}

/** The islands where this tab has asked to be taken off when it closes. */
const armed = new Set<string>();

/** Says where you stand on an island (and that you're gone if the tab closes). */
export async function sayHereRt(owner: string, h: Omit<HereDoc, 'at'>): Promise<void> {
  const u = auth.currentUser;
  if (!u) throw new Error('Not signed in');
  const r = spot(owner, u.uid);
  if (!armed.has(owner)) {
    await onDisconnect(r).remove();
    armed.add(owner);
  }
  // No `undefined` in the database (a missing field is simply left out; null removes it).
  const doc: Record<string, unknown> = { name: h.name.slice(0, 40), face: h.face ?? null, x: h.x, y: h.y, left: h.left, tool: h.tool ?? 'walk', tv: h.tv ?? null, tune: h.tune ?? null, pose: h.pose ?? null, emote: h.emote ?? null, at: serverTimestamp() };
  if (h.world) doc.world = h.world.slice(0, 24);
  await set(r, doc);
}

/** Leaves an island (and no longer needs taking off when the tab closes). */
export async function leaveHereRt(owner: string): Promise<void> {
  const u = auth.currentUser;
  if (!u) return;
  const r = spot(owner, u.uid);
  armed.delete(owner);
  await onDisconnect(r).cancel().catch(() => {});
  await remove(r).catch(() => {});
}
