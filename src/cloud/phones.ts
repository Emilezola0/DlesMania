// Telephone (src/friends/Telephone.tsx): phones/<uid>_<day>, a chain a player starts with a character's name. Their
// friends take it turn by turn, each once, whenever they come by: one draws the name they're shown, the next guesses
// the drawing (a name of the franchise), the next draws that guess…
//
// Each step is sealed: the chain's document only says what kinds of steps it holds and who made them; the steps
// themselves are in phones/<id>/steps/<n>, and the database lets a player read the last one only once they break its
// seal (claim the turn: nobody else can take it for TELEPHONE.claimMinutes, and they can't break it again). Its maker
// reads their own step; the starter and their friends read them all once the chain is finished (firestore.rules).
import { collection, doc, getDoc, getDocs, runTransaction, serverTimestamp, writeBatch, type Timestamp } from 'firebase/firestore';
import T from '../data/tuning/friends.json';
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
  /** Each step's kind, in order (their content is sealed away). */
  kinds: StepKind[];
  /** Who made each step, in order (the starter first): each player once. */
  people: string[];
  /** Who broke a seal (and so can't again). */
  seen: string[];
  /** Who holds the next turn, since when (the server's time). */
  claim: { u: string; at: Timestamp | null } | null;
  /** The steps this player may read, by index: filled in on loading (all of them once the chain is finished). */
  steps: (Step | undefined)[];
}

export const phoneId = (uid: string, day: string) => `${uid}_${day}`;
const ref = (id: string) => doc(db, 'phones', id);
const stepRef = (id: string, n: number) => doc(db, 'phones', id, 'steps', String(n));
const DAY_MS = 86_400_000;
const P = T.telephone;

function me() {
  const u = auth.currentUser;
  if (!u) throw new Error('Sign in to play Telephone.');
  return { uid: u.uid, name: (u.displayName ?? u.email?.split('@')[0] ?? 'A player').trim().slice(0, 40) || 'A player' };
}

/** Full, or open too long: the seals are off and everyone sees it whole. */
export const phoneDone = (p: Pick<PhoneDoc, 'kinds' | 'at'>, nowMs: number) => p.kinds.length >= P.steps || (!!p.at && nowMs > p.at.toMillis() + P.days * DAY_MS);
/** Whether someone else holds the next turn right now. */
export const heldByOther = (p: PhoneDoc, uid: string, nowMs: number) =>
  !!p.claim && p.claim.u !== uid && (!p.claim.at || nowMs < p.claim.at.toMillis() + P.claimMinutes * 60_000);

/** Starts the day's chain (one a day): the chain and its first step, sealed, in one write. */
export async function startPhone(day: string, set: string, word: string): Promise<PhoneDoc> {
  const { uid, name } = me();
  const id = phoneId(uid, day);
  const first: Step = { u: uid, n: name, k: 'w', t: word };
  const b = writeBatch(db);
  b.set(ref(id), { uid, name, day, set, at: serverTimestamp(), kinds: ['w'], people: [uid], seen: [], claim: null });
  b.set(stepRef(id, 0), first);
  await b.commit();
  return { uid, name, day, set, at: null, kinds: ['w'], people: [uid], seen: [], claim: null, steps: [first] };
}

const readStep = (id: string, n: number) =>
  getDoc(stepRef(id, n))
    .then((s) => (s.exists() ? (s.data() as Step) : undefined))
    .catch(() => undefined);

/** The steps this player may read of a chain: all once finished, else their own and the one they broke the seal of. */
async function stepsOf(p: Omit<PhoneDoc, 'steps'>, uid: string): Promise<(Step | undefined)[]> {
  const id = phoneId(p.uid, p.day);
  const steps: (Step | undefined)[] = p.kinds.map(() => undefined);
  if (phoneDone(p, Date.now())) {
    const all = await getDocs(collection(db, 'phones', id, 'steps')).catch(() => null);
    for (const s of all?.docs ?? []) steps[Number(s.id)] = s.data() as Step;
    return steps;
  }
  const want = p.people.flatMap((u, n) => (u === uid ? [n] : []));
  if (p.claim?.u === uid && !p.people.includes(uid)) want.push(p.kinds.length - 1);
  await Promise.all(want.map(async (n) => (steps[n] = await readStep(id, n))));
  return steps;
}

const fromDb = (d: Record<string, unknown>) => d as unknown as Omit<PhoneDoc, 'steps'>;

/** These players' chains of these days, with what this player may read of them (a day with none is left out). */
export async function phonesOf(uids: string[], days: string[]): Promise<PhoneDoc[]> {
  const { uid } = me();
  const docs = await Promise.all(
    uids.flatMap((u) =>
      days.map(async (day) => {
        const s = await getDoc(ref(phoneId(u, day))).catch(() => null);
        if (!s?.exists() || !Array.isArray(s.data().kinds)) return null;
        const p = fromDb(s.data());
        return { ...p, steps: await stepsOf(p, uid) };
      }),
    ),
  );
  return docs.filter((d): d is PhoneDoc => !!d);
}

/**
 * Breaks the seal of a chain's next turn: it's this player's for TELEPHONE.claimMinutes, and the step before comes
 * back. 'held' when someone else holds it, 'moved' when the chain moved on (it comes back as it stands), 'refused' when
 * the database won't (already broken once, or closed).
 */
export async function breakSeal(p: PhoneDoc): Promise<{ result: 'fresh' | 'held' | 'moved' | 'refused'; doc: PhoneDoc | null }> {
  const { uid } = me();
  const id = phoneId(p.uid, p.day);
  try {
    const out = await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref(id));
      if (!snap.exists()) return { result: 'refused' as const, cur: null };
      const cur = fromDb(snap.data());
      if (cur.kinds.length !== p.kinds.length) return { result: 'moved' as const, cur };
      if (cur.claim?.u === uid) return { result: 'fresh' as const, cur };
      if (heldByOther({ ...cur, steps: [] }, uid, Date.now())) return { result: 'held' as const, cur };
      if (cur.seen.includes(uid) || cur.people.includes(uid)) return { result: 'refused' as const, cur };
      tx.update(ref(id), { claim: { u: uid, at: serverTimestamp() }, seen: [...cur.seen, uid] });
      return { result: 'fresh' as const, cur: { ...cur, claim: { u: uid, at: null }, seen: [...cur.seen, uid] } };
    });
    if (!out.cur) return { result: out.result, doc: null };
    return { result: out.result, doc: { ...out.cur, steps: await stepsOf(out.cur, uid) } };
  } catch (e) {
    if ((e as { code?: string })?.code === 'permission-denied') return { result: 'refused', doc: null };
    throw e;
  }
}

/**
 * Adds this player's step to a chain whose seal they broke: 'fresh' when it's in, 'taken' when the turn went to
 * someone else (their claim ran out and another friend took it), 'refused' when the database won't take it.
 */
export async function takeStep(p: PhoneDoc, step: Omit<Step, 'u' | 'n'>): Promise<{ result: 'fresh' | 'taken' | 'refused'; doc: PhoneDoc | null }> {
  const { uid, name } = me();
  const id = phoneId(p.uid, p.day);
  try {
    return await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref(id));
      if (!snap.exists()) return { result: 'refused' as const, doc: null };
      const cur = fromDb(snap.data());
      const n = cur.kinds.length;
      if (n !== p.kinds.length || cur.claim?.u !== uid) return { result: 'taken' as const, doc: { ...cur, steps: p.steps.slice(0, n) } };
      const full: Step = { u: uid, n: name, ...step };
      tx.set(stepRef(id, n), full);
      const kinds = [...cur.kinds, step.k];
      const people = [...cur.people, uid];
      tx.update(ref(id), { kinds, people, claim: null });
      const steps = [...p.steps.slice(0, n)];
      steps[n] = full;
      return { result: 'fresh' as const, doc: { ...cur, kinds, people, claim: null, steps } };
    });
  } catch (e) {
    if ((e as { code?: string })?.code === 'permission-denied') return { result: 'refused', doc: null };
    throw e;
  }
}

/** A finished chain's steps (once it closes while the page is open). */
export async function revealPhone(p: PhoneDoc): Promise<PhoneDoc> {
  const { uid } = me();
  return { ...p, steps: await stepsOf(p, uid) };
}
