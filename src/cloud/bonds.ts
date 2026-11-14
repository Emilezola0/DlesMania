// Bonds (src/friends/Bond.tsx): bonds/<uid>_<uid>, two friends (the smaller uid first) and their shared pot. Each day
// both play the daily, each marks it (m: "<day>_<uid>"); the second to mark adds the day to `together`, which gives
// the pair BOND_POINTS_PER_DAY points. A Bond pack costs BOND_PACK_COST points and needs both players: one starts it
// (a random seed, the points paid), the other joins it, and both draw the same five cards from that seed
// (src/gacha/bond.ts). Nobody joined? Either one cancels it and the points come back. The rules (firestore.rules)
// check all of it; the cards themselves go into each player's own save, as every pack's do.
import { deleteDoc, doc, getDoc, onSnapshot, runTransaction, serverTimestamp, setDoc, type Timestamp } from 'firebase/firestore';
import { todayKey } from '../lib/date';
import { BOND_PACK_COST, BOND_POINTS_PER_DAY } from '../gacha/ranks';
import { auth, db } from './firebase';

export interface BondPack {
  by: string;
  seed: string;
  at: Timestamp | null;
  joined: string | null;
}

export interface BondDoc {
  a: string;
  b: string;
  names: Record<string, string>;
  status: 'invited' | 'active';
  /** Who asked. */
  by: string;
  /** Days each played the daily: "<day>_<uid>". */
  m: Record<string, boolean>;
  /** The last mark made (the rules read it). */
  lastMark?: string;
  /** Days both played. */
  together: Record<string, boolean>;
  /** Points spent on packs, and packs opened. */
  spent: number;
  opened: number;
  /** The pack being opened (joined: by both), and the one before it. */
  pack: BondPack | null;
  prev: BondPack | null;
}

export const pairId = (x: string, y: string) => (x < y ? `${x}_${y}` : `${y}_${x}`);
export const otherOf = (d: Pick<BondDoc, 'a' | 'b'>, me: string) => (d.a === me ? d.b : d.a);
/** Points the pair has to spend. */
export const pointsOf = (d: Pick<BondDoc, 'together' | 'spent'>) => Object.keys(d.together ?? {}).length * BOND_POINTS_PER_DAY - (d.spent ?? 0);

const ref = (id: string) => doc(db, 'bonds', id);
function me(): string {
  const u = auth.currentUser;
  if (!u) throw new Error('Sign in first.');
  return u.uid;
}
const refused = (e: unknown) => (e as { code?: string })?.code === 'permission-denied';

/** The bonds between this player and these friends (one read each; none yet is left out). */
export async function bondsWith(friends: string[]): Promise<Record<string, BondDoc>> {
  const uid = me();
  const out: Record<string, BondDoc> = {};
  await Promise.all(
    friends.map((f) =>
      getDoc(ref(pairId(uid, f)))
        .then((s) => s.exists() && (out[f] = s.data() as BondDoc))
        .catch(() => undefined),
    ),
  );
  remember(uid, Object.values(out).filter((d) => d.status === 'active'));
  return out;
}

/** Follows a bond as it changes (both players see the other start or join a pack). */
export function watchBond(friend: string, on: (d: BondDoc | null) => void): () => void {
  return onSnapshot(
    ref(pairId(me(), friend)),
    (s) => on(s.exists() ? (s.data() as BondDoc) : null),
    () => undefined,
  );
}

/** Asks a friend for a Bond. */
export async function inviteBond(friend: string, myName: string, theirName: string): Promise<void> {
  const uid = me();
  const [a, b] = uid < friend ? [uid, friend] : [friend, uid];
  await setDoc(ref(`${a}_${b}`), { a, b, names: { [uid]: myName, [friend]: theirName }, status: 'invited', by: uid, m: {}, together: {}, spent: 0, opened: 0, pack: null, prev: null });
}

/** Says yes to a friend's Bond. */
export async function acceptBond(d: BondDoc, myName: string): Promise<void> {
  const uid = me();
  await runTransaction(db, async (tx) => {
    const r = ref(pairId(d.a, d.b));
    const snap = await tx.get(r);
    if (!snap.exists()) throw new Error('That Bond was taken back.');
    tx.update(r, { status: 'active', names: { ...(snap.data() as BondDoc).names, [uid]: myName } });
  });
}

/** A Bond ended (or an ask taken back, or turned down), by either. */
export const endBond = (d: Pick<BondDoc, 'a' | 'b'>) => deleteDoc(ref(pairId(d.a, d.b)));

/** Today marked as played on this bond: a point for both if the friend played today too. */
export async function markToday(friend: string): Promise<'marked' | 'already' | 'refused'> {
  const uid = me();
  const day = todayKey();
  const key = `${day}_${uid}`;
  try {
    return await runTransaction(db, async (tx) => {
      const r = ref(pairId(uid, friend));
      const snap = await tx.get(r);
      if (!snap.exists()) return 'refused' as const;
      const d = snap.data() as BondDoc;
      if (d.status !== 'active') return 'refused' as const;
      if (d.m?.[key]) return 'already' as const;
      const both = !!d.m?.[`${day}_${friend}`];
      tx.update(r, { [`m.${key}`]: true, lastMark: key, ...(both ? { [`together.${day}`]: true } : {}) });
      return 'marked' as const;
    });
  } catch (e) {
    if (refused(e)) return 'refused';
    throw e;
  }
}

const seedOf = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (x) => x.toString(16).padStart(2, '0')).join('');

/** Starts a Bond pack (its points paid now); it opens once the friend joins. */
export async function startPack(friend: string): Promise<BondDoc> {
  const uid = me();
  return runTransaction(db, async (tx) => {
    const r = ref(pairId(uid, friend));
    const snap = await tx.get(r);
    if (!snap.exists()) throw new Error('No Bond with this friend.');
    const d = snap.data() as BondDoc;
    if (d.pack && !d.pack.joined) throw new Error('A pack is already waiting.');
    if (pointsOf(d) < BOND_PACK_COST) throw new Error('Not enough Bond points yet.');
    const pack = { by: uid, seed: seedOf(), at: serverTimestamp(), joined: null };
    tx.update(r, { pack, prev: d.pack ?? d.prev ?? null, spent: (d.spent ?? 0) + BOND_PACK_COST, opened: (d.opened ?? 0) + 1 });
    return { ...d, pack: { ...pack, at: null }, prev: d.pack ?? d.prev, spent: d.spent + BOND_PACK_COST, opened: d.opened + 1 };
  });
}

/** Joins the pack the friend started: it opens for both. */
export async function joinPack(friend: string): Promise<BondPack> {
  const uid = me();
  return runTransaction(db, async (tx) => {
    const r = ref(pairId(uid, friend));
    const snap = await tx.get(r);
    const d = snap.exists() ? (snap.data() as BondDoc) : null;
    if (!d?.pack || d.pack.joined || d.pack.by === uid) throw new Error('That pack is gone.');
    tx.update(r, { 'pack.joined': uid });
    return { ...d.pack, joined: uid };
  });
}

/** A pack nobody joined, taken back: its points come back. */
export async function cancelPack(friend: string): Promise<void> {
  const uid = me();
  await runTransaction(db, async (tx) => {
    const r = ref(pairId(uid, friend));
    const snap = await tx.get(r);
    const d = snap.exists() ? (snap.data() as BondDoc) : null;
    if (!d?.pack || d.pack.joined) return;
    tx.update(r, { pack: null, spent: d.spent - BOND_PACK_COST, opened: d.opened - 1 });
  });
}

// The active bonds, kept on this device so today can be marked when the save syncs (src/cloud/engine.ts).
const listKey = (uid: string) => `omnidle:bonds:${uid}`;
const markKey = (uid: string) => `omnidle:bonds-marked:${uid}`;
function remember(uid: string, active: BondDoc[]) {
  try {
    localStorage.setItem(listKey(uid), JSON.stringify(active.map((d) => otherOf(d, uid))));
  } catch {
    // No storage: marked when the Bond tab opens.
  }
}

/** Today marked on every active bond, once a day, when today's daily was played (called as the save syncs). */
export async function markAll(uid: string, playedToday: boolean): Promise<void> {
  if (!playedToday) return;
  try {
    const day = todayKey();
    if (localStorage.getItem(markKey(uid)) === day) return;
    const friends = JSON.parse(localStorage.getItem(listKey(uid)) ?? '[]') as string[];
    if (!friends.length) return;
    await Promise.all(friends.map((f) => markToday(f).catch(() => 'refused')));
    localStorage.setItem(markKey(uid), day);
  } catch {
    // Offline or no storage: next sync, or the Bond tab.
  }
}
