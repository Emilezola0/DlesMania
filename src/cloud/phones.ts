// Telephone (src/friends/Telephone.tsx): phones/<uid>_<day>, a chain a player starts with a character's name. Their
// friends take it turn by turn, each once, whenever they come by: one draws the name they're shown, the next guesses
// the drawing (a name of the franchise), the next draws that guess… Only the starter and their friends can read it;
// a step only ever adds itself at the end, in its right kind, while the chain is open (firestore.rules).
import { doc, getDoc, runTransaction, serverTimestamp, setDoc, type Timestamp } from 'firebase/firestore';
import type { Stroke } from './doodles';
import { auth, db } from './firebase';

export type StepKind = 'w' | 'd' | 'g';

/** A step: the starting word (w), a drawing (d) or a guess (g); who made it. */
export interface Step {
  u: string;
  /** Their name, as their friends know it. */
  n: string;
  k: StepKind;
  /** The word or the guess. */
  t?: string;
  /** The drawing. */
  s?: Stroke[];
}

export interface PhoneDoc {
  uid: string;
  name: string;
  day: string;
  /** The franchise (a card set): every name in the chain is one of its characters. */
  set: string;
  /** When it started (the server's time): it stays open TELEPHONE.days from then. */
  at: Timestamp | null;
  steps: Step[];
  /** Who has taken part (the starter first): each player once. */
  people: string[];
}

export const phoneId = (uid: string, day: string) => `${uid}_${day}`;
const ref = (id: string) => doc(db, 'phones', id);

function me() {
  const u = auth.currentUser;
  if (!u) throw new Error('Sign in to play Telephone.');
  return { uid: u.uid, name: (u.displayName ?? u.email?.split('@')[0] ?? 'A player').trim().slice(0, 40) || 'A player' };
}

/** Starts the day's chain (one a day). */
export async function startPhone(day: string, set: string, word: string): Promise<PhoneDoc> {
  const { uid, name } = me();
  const steps: Step[] = [{ u: uid, n: name, k: 'w', t: word }];
  await setDoc(ref(phoneId(uid, day)), { uid, name, day, set, at: serverTimestamp(), steps, people: [uid] });
  return { uid, name, day, set, at: null, steps, people: [uid] };
}

/** These players' chains of these days (one read each; a day with none is left out). */
export async function phonesOf(uids: string[], days: string[]): Promise<PhoneDoc[]> {
  const docs = await Promise.all(
    uids.flatMap((u) =>
      days.map((day) =>
        getDoc(ref(phoneId(u, day)))
          .then((s) => (s.exists() ? (s.data() as PhoneDoc) : null))
          .catch(() => null),
      ),
    ),
  );
  return docs.filter((d): d is PhoneDoc => !!d);
}

/**
 * Adds this player's step to a chain: 'fresh' when it's in, 'taken' when someone took that turn first (the chain as it
 * now stands comes back: the step asked may be another kind now), 'refused' when the database won't take it.
 */
export async function takeStep(p: PhoneDoc, step: Omit<Step, 'u' | 'n'>): Promise<{ result: 'fresh' | 'taken' | 'refused'; doc: PhoneDoc | null }> {
  const { uid, name } = me();
  const r = ref(phoneId(p.uid, p.day));
  try {
    return await runTransaction(db, async (tx) => {
      const snap = await tx.get(r);
      if (!snap.exists()) return { result: 'refused' as const, doc: null };
      const cur = snap.data() as PhoneDoc;
      if (cur.steps.length !== p.steps.length || cur.people.includes(uid)) return { result: 'taken' as const, doc: cur };
      const full: Step = { u: uid, n: name, ...step };
      const steps = [...cur.steps, full];
      const people = [...cur.people, uid];
      tx.update(r, { steps, people });
      return { result: 'fresh' as const, doc: { ...cur, steps, people } };
    });
  } catch (e) {
    if ((e as { code?: string })?.code === 'permission-denied') return { result: 'refused', doc: null };
    throw e;
  }
}
