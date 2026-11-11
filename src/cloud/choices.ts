// The Daily Choice's votes (src/friends/DailyChoice.tsx): choices/<uid>_<day>, the card picked for each of the
// day's questions ({ picks: { "0": cardId, … } }). Each pick is made once and never changed (firestore.rules),
// only on its day by the server's clock: so a pick pays once, on whichever device. The player reads their own;
// their friends read it once the day is over (the results, the next day).
import { doc, getDoc, runTransaction } from 'firebase/firestore';
import { auth, db } from './firebase';

export interface VoteDoc {
  uid: string;
  day: string;
  /** The question's index ("0", "1", "2") -> the card picked. */
  picks: Record<string, string>;
}

export const voteId = (uid: string, day: string) => `${uid}_${day}`;
const ref = (id: string) => doc(db, 'choices', id);

function me(): string {
  const u = auth.currentUser;
  if (!u) throw new Error('Sign in first.');
  return u.uid;
}

/** The signed-in player's picks of that day. */
export async function myVotes(day: string): Promise<VoteDoc | null> {
  const snap = await getDoc(ref(voteId(me(), day)));
  return snap.exists() ? (snap.data() as VoteDoc) : null;
}

/**
 * Picks a card for one of the day's questions. 'fresh' when it was made now (it pays), 'done' when that question
 * was answered already (on another device), 'refused' when the database won't take it (the device's date is off).
 */
export async function vote(day: string, index: number, cardId: string): Promise<{ result: 'fresh' | 'done' | 'refused'; doc: VoteDoc | null }> {
  const uid = me();
  const r = ref(voteId(uid, day));
  try {
    return await runTransaction(db, async (tx) => {
      const snap = await tx.get(r);
      const old = snap.exists() ? (snap.data() as VoteDoc) : null;
      if (old?.picks[String(index)]) return { result: 'done' as const, doc: old };
      const next: VoteDoc = { uid, day, picks: { ...(old?.picks ?? {}), [String(index)]: cardId } };
      if (old) tx.update(r, { picks: next.picks });
      else tx.set(r, next);
      return { result: 'fresh' as const, doc: next };
    });
  } catch (e) {
    if ((e as { code?: string })?.code === 'permission-denied') return { result: 'refused', doc: null };
    throw e;
  }
}

/** These players' picks of a day that's over (one read each; a player who chose nothing is left out). */
export async function votesOf(uids: string[], day: string): Promise<VoteDoc[]> {
  const docs = await Promise.all(
    uids.map((uid) =>
      getDoc(ref(voteId(uid, day)))
        .then((s) => (s.exists() ? (s.data() as VoteDoc) : null))
        .catch(() => null),
    ),
  );
  return docs.filter((d): d is VoteDoc => !!d);
}
