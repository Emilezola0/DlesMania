// Clue Grid (src/friends/ClueGrid.tsx, the day's grid in src/friends/clueBoard.ts), two documents a player and a day:
//  - clues/<uid>_<day>: their clue, one word, and how many of their characters it points to. Written once; they and
//    their friends read it at any time (friends answer it during the day).
//  - cluesecrets/<uid>_<day>: their secret characters (places in the day's grid, drawn at random the first time they
//    open it, never changed) and what they picked for each friend's clue (once each). Only they read it during the
//    day; their friends too once the day is over everywhere, for the results. Rules in firestore.rules.
import { doc, getDoc, runTransaction, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

export interface ClueDoc {
  uid: string;
  name: string;
  day: string;
  clue: string;
  /** How many of the writer's characters the clue points to: what each friend picks. */
  count: number;
  at: number;
}

export interface SecretDoc {
  uid: string;
  day: string;
  /** The player's characters: places in the grid. */
  targets: number[];
  /** A friend's uid -> the places this player picked for that friend's clue. */
  picks: Record<string, number[]>;
}

export const clueId = (uid: string, day: string) => `${uid}_${day}`;
const clueRef = (id: string) => doc(db, 'clues', id);
const secretRef = (id: string) => doc(db, 'cluesecrets', id);

function me() {
  const u = auth.currentUser;
  if (!u) throw new Error('Sign in to play Clue Grid.');
  return { uid: u.uid, name: (u.displayName ?? u.email?.split('@')[0] ?? 'A player').trim().slice(0, 40) || 'A player' };
}

const denied = (e: unknown) => (e as { code?: string })?.code === 'permission-denied';

/** The player's secret characters of the day, drawn (by `draw`) and kept the first time. Null when the database refuses (device date off, rules not published). */
export async function mySecret(day: string, draw: () => number[]): Promise<SecretDoc | null> {
  const { uid } = me();
  const r = secretRef(clueId(uid, day));
  try {
    return await runTransaction(db, async (tx) => {
      const snap = await tx.get(r);
      if (snap.exists()) return snap.data() as SecretDoc;
      const fresh: SecretDoc = { uid, day, targets: draw(), picks: {} };
      tx.set(r, fresh);
      return fresh;
    });
  } catch (e) {
    if (denied(e)) return null;
    throw e;
  }
}

/** Posts the day's clue (once). 'done' when one was posted already (on another device), 'refused' when the database won't take it. */
export async function postClue(day: string, clue: string, count: number): Promise<{ result: 'fresh' | 'done' | 'refused'; doc: ClueDoc | null }> {
  const { uid, name } = me();
  const r = clueRef(clueId(uid, day));
  try {
    const old = await getDoc(r);
    if (old.exists()) return { result: 'done', doc: old.data() as ClueDoc };
    const d: ClueDoc = { uid, name, day, clue, count, at: Date.now() };
    await setDoc(r, d);
    return { result: 'fresh', doc: d };
  } catch (e) {
    if (denied(e)) return { result: 'refused', doc: null };
    throw e;
  }
}

/** These players' clues of a day (one read each; a player with no clue is left out). */
export async function cluesOf(uids: string[], day: string): Promise<ClueDoc[]> {
  const docs = await Promise.all(uids.map((u) => getDoc(clueRef(clueId(u, day))).then((s) => (s.exists() ? (s.data() as ClueDoc) : null)).catch(() => null)));
  return docs.filter((d): d is ClueDoc => !!d).sort((a, b) => a.at - b.at);
}

/** These players' secrets of a day that's over (or the player's own). */
export async function secretsOf(uids: string[], day: string): Promise<SecretDoc[]> {
  const docs = await Promise.all(uids.map((u) => getDoc(secretRef(clueId(u, day))).then((s) => (s.exists() ? (s.data() as SecretDoc) : null)).catch(() => null)));
  return docs.filter((d): d is SecretDoc => !!d);
}

/** The player's answer to a friend's clue (once). Their secret must exist (mySecret first). */
export async function answerClue(day: string, friend: string, cells: number[]): Promise<{ result: 'fresh' | 'done' | 'refused'; doc: SecretDoc | null }> {
  const { uid } = me();
  const r = secretRef(clueId(uid, day));
  try {
    return await runTransaction(db, async (tx) => {
      const snap = await tx.get(r);
      if (!snap.exists()) return { result: 'refused' as const, doc: null };
      const old = snap.data() as SecretDoc;
      if (old.picks?.[friend]) return { result: 'done' as const, doc: old };
      const picks = { ...(old.picks ?? {}), [friend]: cells };
      tx.update(r, { picks });
      return { result: 'fresh' as const, doc: { ...old, picks } };
    });
  } catch (e) {
    if (denied(e)) return { result: 'refused', doc: null };
    throw e;
  }
}
