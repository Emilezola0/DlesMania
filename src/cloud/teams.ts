// Teams (the Island, like a guild's): teams/<code>, an island shared by its members, all of the same rank: each of them
// builds, digs, picks up and harvests anything there. A player makes one from their own island (a copy of it: theirs
// stays theirs), and the others join with its code (the doc's id, TEAM_CODE letters). A player is in one team at most.
// The moves are the island's own pure functions, run in a transaction, as on a friend's island (src/cloud/islands.ts);
// what's taken from or added to a bag goes to the player who moved, in their own save. Rules: firestore.rules, teams.
import { collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, query, runTransaction, serverTimestamp, setDoc, where, type Timestamp } from 'firebase/firestore';
import { upgradeIsland, type Island } from '../island/island';
import type { IslandLine } from './islands';
import { auth, db } from './firebase';

/** How many players a team takes, and its code's length. */
export const TEAM_SIZE = 20;
export const TEAM_CODE = 8;
const LOG = 30;

export interface TeamDoc {
  code: string;
  name: string;
  /** Its members (uids), all of the same rank, and their names. */
  members: string[];
  names: Record<string, string>;
  island: Island;
  log: IslandLine[];
  createdBy: string;
  at?: Timestamp | null;
}

const ref = (code: string) => doc(db, 'teams', code);
function me(): string {
  const u = auth.currentUser;
  if (!u) throw new Error('Sign in first.');
  return u.uid;
}
/** A code: letters and digits that can't be mixed up (no O/0, I/1). */
function newCode(): string {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const r = crypto.getRandomValues(new Uint32Array(TEAM_CODE));
  return [...r].map((n) => abc[n % abc.length]).join('');
}
export const cleanCode = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, TEAM_CODE);

/** The team you're in (its code), or null. */
export async function myTeam(): Promise<string | null> {
  const s = await getDocs(query(collection(db, 'teams'), where('members', 'array-contains', me())));
  return s.docs[0]?.id ?? null;
}

/** Follows a team (null: gone, or you're not in it any more). */
export function watchTeam(code: string, on: (d: TeamDoc | null) => void): () => void {
  return onSnapshot(
    ref(code),
    (s) => on(s.exists() ? { ...(s.data() as Omit<TeamDoc, 'code'>), code: s.id, island: upgradeIsland((s.data() as TeamDoc).island) } : null),
    () => on(null),
  );
}

/** Makes a team from your island (a copy: yours stays yours). Its code. */
export async function createTeam(name: string, myName: string, island: Island): Promise<string> {
  const uid = me();
  const code = newCode();
  await setDoc(ref(code), {
    name: name.slice(0, 40) || 'Team',
    members: [uid],
    names: { [uid]: myName.slice(0, 40) },
    island: JSON.parse(JSON.stringify(upgradeIsland(island))),
    log: [],
    createdBy: uid,
    at: serverTimestamp(),
  });
  return code;
}

/** Joins a team by its code: an error message, or null. */
export async function joinTeam(code: string, myName: string): Promise<string | null> {
  const uid = me();
  try {
    return await runTransaction(db, async (tx) => {
      const s = await tx.get(ref(code));
      if (!s.exists()) return 'No team has this code.';
      const d = s.data() as TeamDoc;
      if (d.members.includes(uid)) return null;
      if (d.members.length >= TEAM_SIZE) return `This team is full (${TEAM_SIZE} players).`;
      tx.update(ref(code), { members: [...d.members, uid], names: { ...d.names, [uid]: myName.slice(0, 40) }, at: serverTimestamp() });
      return null;
    });
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

/** Leaves a team (the last one out takes it down). */
export async function leaveTeam(code: string): Promise<void> {
  const uid = me();
  const s = await getDoc(ref(code));
  if (!s.exists()) return;
  const d = s.data() as TeamDoc;
  if (d.members.length <= 1) return deleteDoc(ref(code));
  await runTransaction(db, async (tx) => {
    const t = await tx.get(ref(code));
    if (!t.exists()) return;
    const x = t.data() as TeamDoc;
    const names = { ...x.names };
    delete names[uid];
    tx.update(ref(code), { members: x.members.filter((m) => m !== uid), names, at: serverTimestamp() });
  });
}

/** Applies a move to a team's island in a transaction; `line` (who did what) goes into its book. */
export async function teamMove(code: string, move: (island: Island) => Island, line?: Omit<IslandLine, 'uid'>): Promise<void> {
  const uid = me();
  await runTransaction(db, async (tx) => {
    const s = await tx.get(ref(code));
    if (!s.exists()) throw new Error('That team is gone.');
    const d = s.data() as TeamDoc;
    const island = JSON.parse(JSON.stringify(move(upgradeIsland(d.island)))) as Island;
    tx.update(ref(code), {
      island,
      ...(line ? { log: [...(d.log ?? []), { ...line, uid }].slice(-LOG) } : {}),
      at: serverTimestamp(),
    } as unknown as Record<string, never>);
  });
}

/** Renames a team (any member). */
export async function renameTeam(code: string, name: string): Promise<void> {
  await runTransaction(db, async (tx) => {
    tx.update(ref(code), { name: name.slice(0, 40), at: serverTimestamp() });
  });
}
