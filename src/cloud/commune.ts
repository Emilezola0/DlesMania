// The commune (a daily gift code, src/gacha/codes.ts `commune`): redeemed, it doubles the player's DleCoins; everyone
// who redeems it the same day ends up with the average of their balances (the owner's call, 12 Nov 2026).
//
// commune/<day>/members/<uid> holds each member's balance once doubled: written once, only by that player, only on
// its day by the server's clock (firestore.rules), and readable by every signed-in player. Nobody can change
// another player's save, so each one settles their own: the day's average minus their balance, less what was already
// settled (save's `commune`). A comrade who joins later moves the average: it's settled again the next time the site
// opens or the Shop is shown, until the day's pot closes.
import { collection, doc, getDocs, runTransaction, serverTimestamp } from 'firebase/firestore';
import { todayKey } from '../lib/date';
import { useProgress } from '../store/progress';
import { auth, db } from './firebase';

/** The highest balance a member can put in the pot (the rules' cap too): a made-up fortune can't flood everyone's. */
export const COMMUNE_CAP = 10_000_000;

function me(): string {
  const u = auth.currentUser;
  if (!u) throw new Error('Sign in first.');
  return u.uid;
}

const members = (day: string) => collection(db, 'commune', day, 'members');

/** Joins today's pot with this balance (already doubled): 'fresh', 'done' when this account joined today already, 'refused' when the database won't take it. */
export async function joinCommune(day: string, balance: number): Promise<'fresh' | 'done' | 'refused'> {
  const uid = me();
  const ref = doc(members(day), uid);
  try {
    return await runTransaction(db, async (tx) => {
      if ((await tx.get(ref)).exists()) return 'done' as const;
      tx.set(ref, { uid, balance: Math.min(COMMUNE_CAP, Math.max(0, Math.round(balance))), at: serverTimestamp() });
      return 'fresh' as const;
    });
  } catch (e) {
    if ((e as { code?: string })?.code === 'permission-denied') return 'refused';
    throw e;
  }
}

/** The day's members' balances. */
export async function communeBalances(day: string): Promise<number[]> {
  const snap = await getDocs(members(day));
  return snap.docs.map((d) => Number(d.data().balance)).filter((n) => Number.isFinite(n) && n >= 0);
}

/** A day "YYYY-MM-DD" plus n days. */
const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/**
 * Settles this player's share of their commune day (if it's today or yesterday: late joiners in other time zones can
 * still move it): their coins move by the average minus their balance, less what was settled already. What's known
 * of the pot, or null when there's nothing to settle (or no connection).
 */
export async function settleCommune(): Promise<{ day: string; members: number; average: number } | null> {
  const c = useProgress.getState().commune;
  if (!c || !auth.currentUser) return null;
  const today = todayKey();
  if (c.day !== today && addDays(c.day, 1) !== today) return null;
  try {
    const balances = await communeBalances(c.day);
    if (!balances.length) return null;
    const average = Math.round(balances.reduce((a, b) => a + b, 0) / balances.length);
    useProgress.getState().settleCommune(c.day, average - c.balance);
    return { day: c.day, members: balances.length, average };
  } catch {
    return null;
  }
}
