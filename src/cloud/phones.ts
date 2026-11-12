// Telephone (src/friends/Telephone.tsx): phones/<uid>_<day>, a chain a player starts with a character's name. Their
// friends take it turn by turn, each once, whenever they come by: one draws the name they're shown, the next guesses
// the drawing (a name of the franchise), the next draws that guess…
//
// Each step is sealed: the chain's document only says what kinds of steps it holds and who made them; the steps
// themselves are in phones/<id>/steps/<n>, and the database lets a player read the last one only once they break its
// seal (claim the turn: nobody else can take it for TELEPHONE.claimMinutes, and they can't break it again). Its maker
// reads their own step; the starter and their friends read them all once the chain is finished (firestore.rules).
import { collection, doc, getDoc, getDocs, runTransaction, serverTimestamp, Timestamp, writeBatch } from 'firebase/firestore';
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
  /** When it started (the server's time). */
  at: Timestamp | null;
  /**
   * When its day ends (midnight where its starter is): it's played that day, then the seals come off. Chains from
   * before this was kept end when the day is over everywhere (dayEnd).
   */
  ends?: Timestamp | null;
  /** A chain from before the seals (its steps were inside it), shown as it is: nothing in it is lost. */
  legacy?: boolean;
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

/** A day's end everywhere on Earth (its UTC start, a day, and 12 hours more): as the rules count it for a chain with no `ends`. */
const dayEnd = (day: string) => Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10)) + DAY_MS + 12 * 3_600_000;
/** When a chain closes: its day's end. */
export const phoneEnd = (p: Pick<PhoneDoc, 'day' | 'ends'>) => (p.ends ? p.ends.toMillis() : dayEnd(p.day));
/** Full, or its day is over: the seals are off and everyone sees it whole. */
export const phoneDone = (p: Pick<PhoneDoc, 'kinds' | 'day' | 'ends'>, nowMs: number) => p.kinds.length >= P.steps || nowMs > phoneEnd(p);
/** Midnight at the end of this day, here (where the player is). */
const localEnd = (day: string) => Timestamp.fromDate(new Date(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10) + 1));
/** Whether someone else holds the next turn right now. */
export const heldByOther = (p: PhoneDoc, uid: string, nowMs: number) =>
  !!p.claim && p.claim.u !== uid && (!p.claim.at || nowMs < p.claim.at.toMillis() + P.claimMinutes * 60_000);

/** Starts the day's chain (one a day): the chain and its first step, sealed, in one write. */
export async function startPhone(day: string, set: string, word: string): Promise<PhoneDoc> {
  const { uid, name } = me();
  const id = phoneId(uid, day);
  const first: Step = { u: uid, n: name, k: 'w', t: word };
  const b = writeBatch(db);
  const ends = localEnd(day);
  b.set(ref(id), { uid, name, day, set, at: serverTimestamp(), ends, kinds: ['w'], people: [uid], seen: [], claim: null });
  b.set(stepRef(id, 0), first);
  await b.commit();
  return { uid, name, day, set, at: null, ends, kinds: ['w'], people: [uid], seen: [], claim: null, steps: [first] };
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

/** A chain from before the seals, as it is: its steps (drawings and all) were inside it, readable by its friends. */
function legacyOf(d: Record<string, unknown>): PhoneDoc {
  const steps = d.steps as Step[];
  return { ...(d as unknown as PhoneDoc), kinds: steps.map((s) => s.k), people: (d.people as string[]) ?? steps.map((s) => s.u), seen: [], claim: null, steps, legacy: true };
}

/**
 * Brings a chain from before the seals into today's shape, so it can go on being played: the chain keeps its start,
 * its players and every step exactly as made (the rules check each is a true copy), sealed from now on.
 */
async function migrate(p: PhoneDoc): Promise<void> {
  const id = phoneId(p.uid, p.day);
  const b = writeBatch(db);
  b.set(ref(id), { uid: p.uid, name: p.name, day: p.day, set: p.set, at: p.at, ends: localEnd(p.day), kinds: p.kinds, people: p.people, seen: [], claim: null });
  p.steps.forEach((s, n) => s && b.set(stepRef(id, n), s));
  await b.commit();
}

/**
 * These players' chains of these days, with what this player may read of them (a day with none is left out). A chain
 * from before the seals is kept: still open today, it's brought into the sealed shape (drawings and all) and goes on;
 * over, it's shown whole as it was.
 */
export async function phonesOf(uids: string[], days: string[]): Promise<PhoneDoc[]> {
  const { uid } = me();
  const load = async (u: string, day: string): Promise<PhoneDoc | null> => {
    const s = await getDoc(ref(phoneId(u, day))).catch(() => null);
    if (!s?.exists()) return null;
    const d = s.data();
    if (Array.isArray(d.kinds)) {
      const p = fromDb(d);
      return { ...p, steps: await stepsOf(p, uid) };
    }
    if (!Array.isArray(d.steps)) return null;
    const old = legacyOf(d);
    if (phoneDone(old, Date.now())) return old;
    try {
      await migrate(old);
      const again = await getDoc(ref(phoneId(u, day)));
      if (again.exists() && Array.isArray(again.data().kinds)) {
        const p = fromDb(again.data());
        return { ...p, steps: await stepsOf(p, uid) };
      }
    } catch {
      // Not brought over (a friend may have just done it, or the rules aren't published): shown as it is.
    }
    return old;
  };
  const docs = await Promise.all(uids.flatMap((u) => days.map((day) => load(u, day))));
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
