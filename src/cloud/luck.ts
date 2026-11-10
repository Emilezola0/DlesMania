// The luck report (src/pages/Friends.tsx): every pack a signed-in player opens adds to luck/<uid> what it gave
// (Legendary, Mythic and Omni cards) and what its odds promised (src/gacha/packs.ts expectedTop), at the server's
// time. Only the player and their friends can read it (firestore.rules). It can't stop a cheat — the packs are
// rolled on the player's device — but it shows how far anyone's pulls are from the odds, and since when.
import { deleteDoc, doc, getDoc, runTransaction, serverTimestamp, Timestamp } from 'firebase/firestore';
import type { TopCount } from '../gacha/packs';
import { auth, db } from './firebase';

export interface Luck {
  uid: string;
  packs: number;
  got: TopCount;
  expected: TopCount;
  /** When the first pack was logged, and the last (ms). */
  since: number;
  at: number;
}

const ref = (uid: string) => doc(db, 'luck', uid);
const ms = (t: unknown) => (t instanceof Timestamp ? t.toMillis() : 0);
/** Expected counts are kept to 6 decimals (they add up over thousands of packs). */
const round = (n: number) => Math.round(n * 1e6) / 1e6;

function toLuck(uid: string, d: Record<string, unknown>): Luck {
  const n = (k: string) => Number(d[k] ?? 0) || 0;
  return {
    uid,
    packs: n('packs'),
    got: { legendary: n('legendary'), mythic: n('mythic'), omni: n('omni') },
    expected: { legendary: n('eLegendary'), mythic: n('eMythic'), omni: n('eOmni') },
    since: ms(d.since),
    at: ms(d.at),
  };
}

/** Adds an opening of `packs` packs to the signed-in player's luck. Quietly does nothing when it can't. */
export async function logPacks(packs: number, got: TopCount, expected: TopCount): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid || packs < 1) return;
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref(uid));
    const old = snap.exists() ? toLuck(uid, snap.data()) : null;
    const next = {
      packs: (old?.packs ?? 0) + packs,
      legendary: (old?.got.legendary ?? 0) + got.legendary,
      mythic: (old?.got.mythic ?? 0) + got.mythic,
      omni: (old?.got.omni ?? 0) + got.omni,
      eLegendary: round((old?.expected.legendary ?? 0) + expected.legendary),
      eMythic: round((old?.expected.mythic ?? 0) + expected.mythic),
      eOmni: round((old?.expected.omni ?? 0) + expected.omni),
      at: serverTimestamp(),
    };
    if (snap.exists()) tx.update(ref(uid), next);
    else tx.set(ref(uid), { ...next, since: serverTimestamp() });
  });
}

/**
 * Clears the signed-in player's luck report (the Test Lab, after testing with rigged packs): it starts again from
 * the next pack, with a new "since" date that friends see. False when no account is signed in.
 */
export async function resetLuck(): Promise<boolean> {
  const uid = auth.currentUser?.uid;
  if (!uid) return false;
  await deleteDoc(ref(uid));
  return true;
}

/** These players' luck (none for a player who hasn't opened a pack signed in, or whose luck can't be read). */
export async function loadLuck(uids: string[]): Promise<Record<string, Luck>> {
  const out: Record<string, Luck> = {};
  await Promise.all(
    uids.map((uid) =>
      getDoc(ref(uid))
        .then((s) => {
          if (s.exists()) out[uid] = toLuck(uid, s.data());
        })
        .catch(() => undefined),
    ),
  );
  return out;
}
