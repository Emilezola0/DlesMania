// The Black Market's stalls (src/casino/BlackMarket.tsx): the cards a player handed over in a trade, put up for
// their friends to buy for a week. They live in blackmarket/<seller uid>/stalls/<id>; only the seller and their
// friends (the seller's scores document's list) can read them; a friend buys one by writing their name on it,
// once (firestore.rules). The coins and the card itself are the save's (src/store/progress.ts), like every trade.
import { collection, doc, getDoc, getDocs, query, serverTimestamp, Timestamp, updateDoc, where, writeBatch } from 'firebase/firestore';
import { auth, db } from './firebase';

export interface Stall {
  /** Its document id, and the seller's uid. */
  id: string;
  uid: string;
  seller: string;
  card: string;
  rarity: 'mythic' | 'omni';
  /** When it was put up (ms). */
  at: number;
  buyer: string | null;
  buyerName: string | null;
}

/** How long a card stays on its stall. */
export const STALL_DAYS = 7;
const WEEK_MS = STALL_DAYS * 86_400_000;

function me() {
  const u = auth.currentUser;
  if (!u) throw new Error('Sign in to use the stalls.');
  return { uid: u.uid, name: (u.displayName ?? u.email?.split('@')[0] ?? 'A player').trim().slice(0, 40) || 'A player' };
}
export const signedInUid = () => auth.currentUser?.uid ?? null;
const stalls = (uid: string) => collection(db, 'blackmarket', uid, 'stalls');

/** This player's friends (their scores document's list; none before they've opened Friends). */
export async function myFriends(): Promise<string[]> {
  const { uid } = me();
  const snap = await getDoc(doc(db, 'scores', uid)).catch(() => null);
  const friends = snap?.exists() ? (snap.data().friends as unknown) : [];
  return Array.isArray(friends) ? friends.filter((f): f is string => typeof f === 'string') : [];
}

/** Puts the cards handed over in a trade up on this player's stall, for their friends. */
export async function putUp(cards: { id: string; rarity: 'mythic' | 'omni' }[]): Promise<void> {
  const { uid, name } = me();
  const batch = writeBatch(db);
  for (const c of cards) batch.set(doc(stalls(uid)), { seller: name, card: c.id, rarity: c.rarity, at: serverTimestamp(), buyer: null, buyerName: null });
  await batch.commit();
}

const toStall = (uid: string, id: string, d: Record<string, unknown>): Stall => ({
  id,
  uid,
  seller: String(d.seller ?? ''),
  card: String(d.card ?? ''),
  rarity: d.rarity === 'omni' ? 'omni' : 'mythic',
  at: d.at instanceof Timestamp ? d.at.toMillis() : Date.now(),
  buyer: (d.buyer as string | null) ?? null,
  buyerName: (d.buyerName as string | null) ?? null,
});

/** The stalls of these players (friends, or this player) from the last week, newest first; a stall that can't be read is left out. */
export async function stallsOf(uids: string[]): Promise<Stall[]> {
  const since = Timestamp.fromMillis(Date.now() - WEEK_MS);
  const lists = await Promise.all(
    uids.map((uid) =>
      getDocs(query(stalls(uid), where('at', '>', since)))
        .then((snap) => snap.docs.map((d) => toStall(uid, d.id, d.data())))
        .catch(() => [] as Stall[]),
    ),
  );
  return lists.flat().sort((a, b) => b.at - a.at);
}

/** Buys a friend's card off their stall: false if someone was quicker (or the week is over). */
export async function buyStall(s: Stall): Promise<boolean> {
  const { uid, name } = me();
  try {
    await updateDoc(doc(stalls(s.uid), s.id), { buyer: uid, buyerName: name, boughtAt: serverTimestamp() });
    return true;
  } catch (e) {
    if ((e as { code?: string })?.code === 'permission-denied') return false;
    throw e;
  }
}

