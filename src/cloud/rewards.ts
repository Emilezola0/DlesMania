// Birthday and special-date rewards, for signed-in players. The birthday is kept in rewards/<uid>,
// written once and never changed; each reward is claimed by creating rewards/<uid>/claims/<id>
// (birthday-2026, christmas-2026...), which the database rules (firestore.rules) allow only once, and
// only while it's open by the server's clock. The coins are added to the save only once the claim is
// accepted, so two devices, a reset browser or a moved clock never pay a reward twice.
import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { todayKey } from '../lib/date';
import { daysIn, dueRewards, type Birthday, type DueReward } from '../lib/rewards';
import { useProgress } from '../store/progress';
import { auth, db } from './firebase';

function uid(): string {
  const u = auth.currentUser;
  if (!u) throw new Error('Sign in first.');
  return u.uid;
}

/** The account's birthday, or null when it hasn't been set yet. */
export async function getBirthday(): Promise<Birthday | null> {
  const snap = await getDoc(doc(db, 'rewards', uid()));
  const d = snap.data();
  return d && typeof d.month === 'number' && typeof d.day === 'number' ? { month: d.month, day: d.day } : null;
}

/** Sets the birthday, for good: refused when one is already set (here and by the database rules). */
export async function setBirthday(b: Birthday): Promise<Birthday> {
  if (!Number.isInteger(b.month) || b.month < 1 || b.month > 12 || !Number.isInteger(b.day) || b.day < 1 || b.day > daysIn(b.month)) throw new Error("That date doesn't exist.");
  const ref = doc(db, 'rewards', uid());
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists()) {
      const d = snap.data();
      return { month: d.month, day: d.day } as Birthday;
    }
    tx.set(ref, { month: b.month, day: b.day, at: serverTimestamp() });
    return b;
  });
}

/** Claims already seen this session (taken here or on another device): not asked about again. */
const seen = new Set<string>();

/** Claims every reward open today that this account hasn't had yet, and adds its coins: the ones paid. */
export async function claimDue(birthday: Birthday | null): Promise<DueReward[]> {
  const me = uid();
  const paid: DueReward[] = [];
  for (const r of dueRewards(birthday, todayKey())) {
    const mark = `${me}:${r.id}`;
    if (seen.has(mark)) continue;
    const ref = doc(db, 'rewards', me, 'claims', r.id);
    try {
      const fresh = await runTransaction(db, async (tx) => {
        if ((await tx.get(ref)).exists()) return false;
        tx.set(ref, { at: serverTimestamp() });
        return true;
      });
      seen.add(mark);
      if (fresh) {
        useProgress.setState((s) => ({ coins: (s.coins ?? 0) + r.coins }));
        paid.push(r);
      }
    } catch (e) {
      // Refused (this device's date is off from the server's) or no connection: tried again later.
      if ((e as { code?: string })?.code === 'permission-denied') seen.add(mark);
    }
  }
  return paid;
}
