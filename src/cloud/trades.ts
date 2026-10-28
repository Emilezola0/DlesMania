// Trading cards between players. An offer is a document in trades/<CODE>: a card to give, and
// the card wanted in return (or any). Making it sets the card aside (it leaves the giver's album);
// the other player accepts with a card of theirs — it leaves their album, the offered one enters it;
// the giver collects that card the next time they come by (or gets theirs back by cancelling an
// offer nobody took). Each step is a Firestore transaction, so an offer is only ever taken once;
// firestore.rules lets only the right player take each step.
import { collection, doc, getDoc, getDocs, query, runTransaction, where } from 'firebase/firestore';
import { CARD_BY_ID } from '../gacha/cards';
import { useProgress } from '../store/progress';
import { auth, db } from './firebase';

export type TradeStatus = 'open' | 'accepted' | 'cancelled' | 'claimed';

export interface Trade {
  code: string;
  from: string;
  fromName: string;
  give: string;
  /** The card wanted in return; null: any card. */
  want: string | null;
  status: TradeStatus;
  to?: string;
  toName?: string;
  /** The card given in return. */
  got?: string;
  createdAt: number;
}

/** Letters and digits that can't be misread (no O/0, I/1/L). */
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const newCode = () => Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
export const cleanCode = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);

const trades = collection(db, 'trades');

function me() {
  const u = auth.currentUser;
  if (!u) throw new Error('Sign in to trade.');
  return { uid: u.uid, name: u.displayName ?? u.email?.split('@')[0] ?? 'A player' };
}
/** The signed-in player's id: whether a trade was theirs or taken by them. */
export const myUid = () => auth.currentUser?.uid ?? null;

const owned = (id: string) => useProgress.getState().cards[id] ?? 0;
const move = (delta: Record<string, number>) => useProgress.getState().moveCards(delta);

/** Puts a card up for trade: it leaves the album until the offer is taken or cancelled. Returns the code. */
export async function makeOffer(give: string, want: string | null): Promise<string> {
  const { uid, name } = me();
  if (!CARD_BY_ID.has(give) || owned(give) < 1) throw new Error("You don't have that card.");
  if (want && !CARD_BY_ID.has(want)) throw new Error('Unknown card.');
  for (let tries = 0; tries < 5; tries++) {
    const code = newCode();
    const ref = doc(trades, code);
    const made = await runTransaction(db, async (tx) => {
      if ((await tx.get(ref)).exists()) return false;
      tx.set(ref, { code, from: uid, fromName: name, give, want, status: 'open', createdAt: Date.now() });
      return true;
    });
    if (made) {
      move({ [give]: -1 });
      return code;
    }
  }
  throw new Error('Could not make a code — try again.');
}

export async function loadOffer(code: string): Promise<Trade | null> {
  me();
  const snap = await getDoc(doc(trades, cleanCode(code)));
  return snap.exists() ? (snap.data() as Trade) : null;
}

/** Takes an offer, giving `got` for it: `got` leaves the album, the offered card enters it. */
export async function acceptOffer(code: string, got: string): Promise<Trade> {
  const { uid, name } = me();
  if (owned(got) < 1) throw new Error("You don't have that card.");
  const ref = doc(trades, cleanCode(code));
  const trade = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('No offer with that code.');
    const t = snap.data() as Trade;
    if (t.from === uid) throw new Error("That's your own offer.");
    if (t.status !== 'open') throw new Error('Someone already took that offer (or it was cancelled).');
    if (t.want && t.want !== got) throw new Error(`This offer wants ${CARD_BY_ID.get(t.want)?.name ?? 'another card'}.`);
    const next = { ...t, status: 'accepted' as const, to: uid, toName: name, got };
    tx.update(ref, { status: 'accepted', to: uid, toName: name, got });
    return next;
  });
  move({ [got]: -1, [trade.give]: +1 });
  return trade;
}

/** Takes back an offer nobody took: the card comes home. */
export async function cancelOffer(code: string): Promise<void> {
  const { uid } = me();
  const ref = doc(trades, code);
  const give = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const t = snap.data() as Trade | undefined;
    if (!t || t.from !== uid) throw new Error('Not your offer.');
    if (t.status !== 'open') throw new Error('Too late: someone took it.');
    tx.update(ref, { status: 'cancelled' });
    return t.give;
  });
  move({ [give]: +1 });
}

/** The cards that came back for the player's accepted offers, into the album (once each). */
export async function collectTrades(): Promise<Trade[]> {
  const { uid } = me();
  const done = await getDocs(query(trades, where('from', '==', uid), where('status', '==', 'accepted')));
  const got: Trade[] = [];
  for (const d of done.docs) {
    const t = await runTransaction(db, async (tx) => {
      const snap = await tx.get(d.ref);
      const x = snap.data() as Trade | undefined;
      if (!x || x.status !== 'accepted') return null;
      tx.update(d.ref, { status: 'claimed' });
      return x;
    });
    if (t?.got) {
      move({ [t.got]: +1 });
      got.push(t);
    }
  }
  return got;
}

/** The player's offers and the ones they took, latest first. */
export async function myTrades(): Promise<Trade[]> {
  const { uid } = me();
  const [mine, taken] = await Promise.all([getDocs(query(trades, where('from', '==', uid))), getDocs(query(trades, where('to', '==', uid)))]);
  return [...mine.docs, ...taken.docs].map((d) => d.data() as Trade).sort((a, b) => b.createdAt - a.createdAt);
}
