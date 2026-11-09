// Trading between players. An offer is a document in trades/<CODE>: up to a few cards and some DleCoins to
// give, and what's wanted in return: some cards by name, one card of the taker's choice, DleCoins — any mix.
// Making it sets what's given aside (it leaves the giver's save); the other player accepts with what it asks —
// that leaves their save, the offer enters it; the giver collects their side the next time they come by (or
// gets theirs back by cancelling an offer nobody took). Each step is a Firestore transaction, so an offer is
// only ever taken once; firestore.rules lets only the right player take each step.
// Only what was earned with an account signed in can be traded (tradeLock, src/store/progress.ts): a save
// farmed without one can't be linked to a throwaway account and handed over.
import { collection, doc, getDoc, getDocs, query, runTransaction, where } from 'firebase/firestore';
import { CARD_BY_ID } from '../gacha/cards';
import { TRADE_LIMITS } from '../gacha/economy';
import { tradableCoins, tradableCopies, useProgress } from '../store/progress';
import { auth, db } from './firebase';

export type TradeStatus = 'open' | 'accepted' | 'cancelled' | 'claimed';

export interface Trade {
  code: string;
  from: string;
  fromName: string;
  /** The cards given (a card may be there more than once). */
  give: string[];
  giveCoins: number;
  /** The cards wanted by name. */
  want: string[];
  /** One more card, of the taker's choice. */
  wantAny: boolean;
  wantCoins: number;
  status: TradeStatus;
  to?: string;
  toName?: string;
  /** The cards given in return. */
  got?: string[];
  createdAt: number;
  /** An offer made before trades held coins and several cards: one card for one (or any) card. */
  legacy?: boolean;
}

export const MAX_CARDS = TRADE_LIMITS.maxCards;
export const MAX_COINS = TRADE_LIMITS.maxCoins;

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

/** A document as stored (old offers held one card each way), as a Trade. */
function toTrade(d: Record<string, unknown>): Trade {
  const legacy = typeof d.give === 'string';
  const list = (x: unknown) => (Array.isArray(x) ? x.filter((v): v is string => typeof v === 'string') : typeof x === 'string' ? [x] : []);
  return {
    code: String(d.code ?? ''),
    from: String(d.from ?? ''),
    fromName: String(d.fromName ?? 'A player'),
    give: list(d.give),
    giveCoins: Number(d.giveCoins ?? 0) || 0,
    want: list(d.want),
    wantAny: legacy ? d.want == null : !!d.wantAny,
    wantCoins: Number(d.wantCoins ?? 0) || 0,
    status: d.status as TradeStatus,
    to: d.to as string | undefined,
    toName: d.toName as string | undefined,
    got: d.got === undefined ? undefined : list(d.got),
    createdAt: Number(d.createdAt ?? 0),
    ...(legacy ? { legacy: true } : {}),
  };
}

/** Card id -> copies, from a list. */
export const countOf = (ids: string[]) => {
  const n: Record<string, number> = {};
  for (const id of ids) n[id] = (n[id] ?? 0) + 1;
  return n;
};

/** What the player is missing to give these cards and coins: a sentence, or null when they can. */
export function cantGive(cards: string[], coins: number): string | null {
  const s = useProgress.getState();
  for (const [id, n] of Object.entries(countOf(cards))) {
    const card = CARD_BY_ID.get(id);
    if (!card) return 'Unknown card.';
    const free = tradableCopies(s, id);
    if (free < n) {
      const locked = Math.min(s.cards[id] ?? 0, s.tradeLock?.cards[id] ?? 0);
      return locked && (s.cards[id] ?? 0) >= n
        ? `${card.name}: the copies you have were earned before your account was linked, so they can't be traded.`
        : `You don't have ${n > 1 ? `${n} copies of ` : ''}${card.name}.`;
    }
  }
  if (coins > tradableCoins(s)) return coins > s.coins ? "You don't have that many DleCoins." : "Some of your DleCoins were earned before your account was linked: they can't be traded.";
  return null;
}

const move = (cards: Record<string, number>, coins: number) => {
  if (Object.keys(cards).length) useProgress.getState().moveCards(cards);
  if (coins) useProgress.setState((s) => ({ coins: Math.max(0, (s.coins ?? 0) + coins) }));
};
const neg = (n: Record<string, number>) => Object.fromEntries(Object.entries(n).map(([k, v]) => [k, -v]));

/** Puts cards and coins up for trade: they leave the save until the offer is taken or cancelled. Returns the code. */
export async function makeOffer(o: { give: string[]; giveCoins: number; want: string[]; wantAny: boolean; wantCoins: number }): Promise<string> {
  const { uid, name } = me();
  const giveCoins = Math.max(0, Math.floor(o.giveCoins));
  const wantCoins = Math.max(0, Math.floor(o.wantCoins));
  if (!o.give.length && !giveCoins) throw new Error('Put at least a card or some DleCoins in your side.');
  if (!o.want.length && !o.wantAny && !wantCoins) throw new Error('Ask for something in return.');
  if (o.give.length > MAX_CARDS || o.want.length + (o.wantAny ? 1 : 0) > MAX_CARDS) throw new Error(`${MAX_CARDS} cards a side at most.`);
  if (giveCoins > MAX_COINS || wantCoins > MAX_COINS) throw new Error(`${MAX_COINS.toLocaleString('en')} DleCoins a side at most.`);
  if (o.want.some((id) => !CARD_BY_ID.has(id))) throw new Error('Unknown card.');
  const missing = cantGive(o.give, giveCoins);
  if (missing) throw new Error(missing);
  for (let tries = 0; tries < 5; tries++) {
    const code = newCode();
    const ref = doc(trades, code);
    const made = await runTransaction(db, async (tx) => {
      if ((await tx.get(ref)).exists()) return false;
      tx.set(ref, { code, from: uid, fromName: name, give: o.give, giveCoins, want: o.want, wantAny: o.wantAny, wantCoins, status: 'open', createdAt: Date.now() });
      return true;
    });
    if (made) {
      move(neg(countOf(o.give)), -giveCoins);
      return code;
    }
  }
  throw new Error('Could not make a code — try again.');
}

export async function loadOffer(code: string): Promise<Trade | null> {
  me();
  const snap = await getDoc(doc(trades, cleanCode(code)));
  return snap.exists() ? toTrade(snap.data()) : null;
}

/** Takes an offer: the cards it asks for (plus `pick`, when it asks for any one card) and its coins leave the save, the offer enters it. */
export async function acceptOffer(code: string, pick: string | null): Promise<Trade> {
  const { uid, name } = me();
  const ref = doc(trades, cleanCode(code));
  const trade = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('No offer with that code.');
    const t = toTrade(snap.data());
    if (t.from === uid) throw new Error("That's your own offer.");
    if (t.status !== 'open') throw new Error('Someone already took that offer (or it was cancelled).');
    if (t.wantAny && !pick) throw new Error('Pick the card you give.');
    const got = [...t.want, ...(t.wantAny && pick ? [pick] : [])];
    const missing = cantGive(got, t.wantCoins);
    if (missing) throw new Error(missing);
    // An old offer keeps its old shape: one card back.
    tx.update(ref, { status: 'accepted', to: uid, toName: name, got: t.legacy ? got[0] : got });
    return { ...t, status: 'accepted' as const, to: uid, toName: name, got };
  });
  const delta = neg(countOf(trade.got!));
  for (const id of trade.give) delta[id] = (delta[id] ?? 0) + 1;
  move(delta, trade.giveCoins - trade.wantCoins);
  return trade;
}

/** Takes back an offer nobody took: its cards and coins come home. */
export async function cancelOffer(code: string): Promise<Trade> {
  const { uid } = me();
  const ref = doc(trades, code);
  const t = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const x = snap.exists() ? toTrade(snap.data()) : undefined;
    if (!x || x.from !== uid) throw new Error('Not your offer.');
    if (x.status !== 'open') throw new Error('Too late: someone took it.');
    tx.update(ref, { status: 'cancelled' });
    return x;
  });
  move(countOf(t.give), t.giveCoins);
  return t;
}

/** What came back for the player's accepted offers, into the save (once each). */
export async function collectTrades(): Promise<Trade[]> {
  const { uid } = me();
  const done = await getDocs(query(trades, where('from', '==', uid), where('status', '==', 'accepted')));
  const got: Trade[] = [];
  for (const d of done.docs) {
    const t = await runTransaction(db, async (tx) => {
      const snap = await tx.get(d.ref);
      const x = snap.exists() ? toTrade(snap.data()) : undefined;
      if (!x || x.status !== 'accepted') return null;
      tx.update(d.ref, { status: 'claimed' });
      return x;
    });
    if (t) {
      move(countOf(t.got ?? []), t.wantCoins);
      got.push(t);
    }
  }
  return got;
}

/** The player's offers and the ones they took, latest first. */
export async function myTrades(): Promise<Trade[]> {
  const { uid } = me();
  const [mine, taken] = await Promise.all([getDocs(query(trades, where('from', '==', uid))), getDocs(query(trades, where('to', '==', uid)))]);
  return [...mine.docs, ...taken.docs].map((d) => toTrade(d.data())).sort((a, b) => b.createdAt - a.createdAt);
}
