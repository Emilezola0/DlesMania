// The Raid Boss's hits (src/friends/RaidBoss.tsx): raidhits/<uid>_<week Monday>, one attack a day a player made on the
// week's boss ({ hits: { "2026-11-12": { d: damage, at } } }). Your boss's health is shared with your friends: it takes
// your hits and theirs. Each hit is made once, only on its day by the server's clock, at most RAID.maxHit damage
// (firestore.rules); the player reads their own, their friends read it too.
import { doc, getDoc, runTransaction, serverTimestamp, type Timestamp } from 'firebase/firestore';
import { auth, db } from './firebase';

export interface Hit {
  /** Damage dealt. */
  d: number;
  /** When (the server's time). */
  at: Timestamp | null;
}

export interface HitsDoc {
  uid: string;
  week: string;
  /** The day of the latest hit (the one the rules check). */
  last: string;
  hits: Record<string, Hit>;
}

export const hitsId = (uid: string, week: string) => `${uid}_${week}`;
const ref = (id: string) => doc(db, 'raidhits', id);

function me(): string {
  const u = auth.currentUser;
  if (!u) throw new Error('Sign in first.');
  return u.uid;
}

/** These players' hits of a week (one read each; a player who never hit is left out). */
export async function hitsOf(uids: string[], week: string): Promise<HitsDoc[]> {
  const docs = await Promise.all(
    uids.map((uid) =>
      getDoc(ref(hitsId(uid, week)))
        .then((s) => (s.exists() ? (s.data() as HitsDoc) : null))
        .catch(() => null),
    ),
  );
  return docs.filter((d): d is HitsDoc => !!d);
}

/** Today's attack: 'fresh' when it landed now, 'done' when today's was made already (another device), 'refused' when the database won't take it. */
export async function strike(week: string, day: string, damage: number): Promise<{ result: 'fresh' | 'done' | 'refused'; doc: HitsDoc | null }> {
  const uid = me();
  const r = ref(hitsId(uid, week));
  try {
    return await runTransaction(db, async (tx) => {
      const snap = await tx.get(r);
      const old = snap.exists() ? (snap.data() as HitsDoc) : null;
      if (old?.hits[day]) return { result: 'done' as const, doc: old };
      const d = Math.max(0, Math.round(damage));
      if (old) tx.update(r, { last: day, [`hits.${day}`]: { d, at: serverTimestamp() } });
      else tx.set(r, { uid, week, last: day, hits: { [day]: { d, at: serverTimestamp() } } });
      return { result: 'fresh' as const, doc: { uid, week, last: day, hits: { ...(old?.hits ?? {}), [day]: { d, at: null } } } };
    });
  } catch (e) {
    if ((e as { code?: string })?.code === 'permission-denied') return { result: 'refused', doc: null };
    throw e;
  }
}
