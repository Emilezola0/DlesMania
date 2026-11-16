// Teams (the Island, like a guild's): an island shared by its members, all of the same rank: each of them builds,
// digs, picks up and harvests anything there. On the Realtime Database (teams/<code>), never Firestore any more (each
// move was a write there, and a read for each member on the island). A player makes one from their own island (a copy
// of it: theirs stays theirs), and the others join with its code (TEAM_CODE letters). A player is in one team at most
// (teamOf/<uid>: its code). The moves are the island's own pure functions, run in a transaction, as on a friend's
// island (src/cloud/islands.ts); what's taken from or added to a bag goes to the player who moved, in their own save.
// The way the island is kept: src/cloud/rtIsland.ts. Rules: database.rules.json, "teams" and "teamOf".
// A team made before (Firestore, teams/<code>) moves over the first time one of its members opens the Team tab.
import { get, onValue, push, ref, remove, runTransaction, set, update } from 'firebase/database';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { upgradeIsland, type Island } from '../island/island';
import type { IslandLine } from './islands';
import { auth, db } from './firebase';
import { decodeState, encodeState, linesOf, oldLines, rdb, type StoredLine, type StoredState } from './rtIsland';

/** How many players a team takes, and its code's length. */
export const TEAM_SIZE = 20;
export const TEAM_CODE = 8;

export interface TeamDoc {
  code: string;
  name: string;
  /** Its members (uids), all of the same rank, and their names. */
  members: string[];
  names: Record<string, string>;
  island: Island;
  log: IslandLine[];
  createdBy: string;
}
interface Stored {
  name?: string;
  createdBy?: string;
  /** Its members: their names, by uid. */
  members?: Record<string, string>;
  state?: StoredState;
  log?: Record<string, StoredLine>;
}

const team = (code: string, path = '') => ref(rdb(), `teams/${code}${path}`);
const mine = (uid: string) => ref(rdb(), `teamOf/${uid}`);
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

/** A team made before, on Firestore: brought over (with all its members) if it isn't here yet. Its code, or null. */
async function bringOver(uid: string): Promise<string | null> {
  try {
    const s = await getDocs(query(collection(db, 'teams'), where('members', 'array-contains', uid)));
    const d = s.docs[0];
    if (!d) return null;
    const code = d.id;
    if (!(await get(team(code))).exists()) {
      const t = d.data() as { name?: string; members: string[]; names?: Record<string, string>; island: Island; log?: IslandLine[]; createdBy?: string };
      const log: Record<string, StoredLine> = {};
      (t.log ?? []).forEach((l, i) => (log[`a${String(i).padStart(3, '0')}`] = { uid: l.uid, name: l.name.slice(0, 40), what: l.what.slice(0, 12), day: l.day.slice(0, 10) }));
      await set(team(code), {
        name: (t.name ?? 'Team').slice(0, 40),
        createdBy: t.createdBy ?? uid,
        members: Object.fromEntries(t.members.slice(0, TEAM_SIZE).map((m) => [m, (t.names?.[m] ?? '?').slice(0, 40)])),
        state: encodeState(upgradeIsland(t.island)),
        log,
      });
    }
    return code;
  } catch {
    return null;
  }
}

/** The team you're in (its code), or null. */
export async function myTeam(): Promise<string | null> {
  const uid = me();
  const code = (await get(mine(uid))).val() as string | null;
  if (code && (await get(team(code, `/members/${uid}`))).exists()) return code;
  const before = await bringOver(uid);
  if (before) await set(mine(uid), before);
  else if (code) await remove(mine(uid));
  return before;
}

/** Follows a team (null: gone, or you're not in it any more). */
export function watchTeam(code: string, on: (d: TeamDoc | null) => void): () => void {
  const uid = auth.currentUser?.uid;
  return onValue(
    team(code),
    (s) => {
      const t = s.val() as Stored | null;
      if (!t?.members || !uid || !t.members[uid]) return on(null);
      on({ code, name: t.name ?? '', members: Object.keys(t.members), names: t.members, island: decodeState(t.state), log: linesOf(t.log), createdBy: t.createdBy ?? '' });
      // Keeping the book short (one member does it, the first).
      const old = oldLines(t.log);
      if (old.length && Object.keys(t.members).sort()[0] === uid) void update(team(code, '/log'), Object.fromEntries(old.map((k) => [k, null]))).catch(() => {});
    },
    () => on(null),
  );
}

/** Makes a team from your island (a copy: yours stays yours). Its code. */
export async function createTeam(name: string, myName: string, island: Island): Promise<string> {
  const uid = me();
  for (let tries = 0; tries < 5; tries++) {
    const code = newCode();
    const r = await runTransaction(team(code), (cur: Stored | null) =>
      cur ? undefined : { name: name.slice(0, 40) || 'Team', createdBy: uid, members: { [uid]: myName.slice(0, 40) || '?' }, state: encodeState(upgradeIsland(island)) },
    );
    if (!r.committed) continue;
    await set(mine(uid), code);
    return code;
  }
  throw new Error('No free code: try again.');
}

/** Joins a team by its code: an error message, or null. */
export async function joinTeam(code: string, myName: string): Promise<string | null> {
  const uid = me();
  try {
    const members = (await get(team(code, '/members'))).val() as Record<string, string> | null;
    if (!members) return 'No team has this code.';
    if (!members[uid]) {
      if (Object.keys(members).length >= TEAM_SIZE) return `This team is full (${TEAM_SIZE} players).`;
      await set(team(code, `/members/${uid}`), myName.slice(0, 40) || '?');
    }
    await set(mine(uid), code);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

/** Leaves a team (the last one out leaves it empty: nobody sees it any more). */
export async function leaveTeam(code: string): Promise<void> {
  const uid = me();
  await remove(team(code, `/members/${uid}`));
  await remove(mine(uid));
}

/** Applies a move to a team's island in a transaction; `line` (who did what) goes into its book. */
export async function teamMove(code: string, move: (island: Island) => Island, line?: Omit<IslandLine, 'uid'>): Promise<void> {
  const uid = me();
  if (!(await get(team(code, '/state'))).exists()) throw new Error('That team is gone.');
  // (The first try may see nothing yet: the database then gives the island as it is, and it runs again.)
  await runTransaction(team(code, '/state'), (cur: StoredState | null) => (cur ? encodeState(move(decodeState(cur))) : cur));
  if (line) await push(team(code, '/log'), { uid, name: line.name.slice(0, 40), what: line.what.slice(0, 12), day: line.day.slice(0, 10) }).catch(() => {});
}

/** Renames a team (any member). */
export async function renameTeam(code: string, name: string): Promise<void> {
  await set(team(code, '/name'), name.slice(0, 40));
}
