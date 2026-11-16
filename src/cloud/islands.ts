// Islands (src/island/, stage 3): a signed-in player's island, shared, on the Realtime Database (isles/<uid>), never
// Firestore any more: every move (a block dug, a plant watered) was a write there and a read for each player on the
// island, against its free daily quota; the Realtime Database counts only the bytes. The owner and the builders they
// invite (up to ISLAND_BUILDERS, among their friends) build on it; any friend may visit, and water a plot (it grows a
// day sooner; the helper gets a seed). The moves are the same pure functions as offline (src/island/island.ts), run in a
// transaction; what's taken from or added to a bag goes to the player who moved, in their own save.
// Who may come: the database's rules can't read Firestore, so the island keeps a copy of its owner's friends
// (`friends`, written by the owner's page: syncFriends). The way it's kept: src/cloud/rtIsland.ts. Rules:
// database.rules.json, "isles".
// Islands made before (Firestore, islands/<uid>) move over the first time their owner opens their island page
// (publishIsland); until then their friends see them as they were, without changing them.
import { get, onValue, push, ref, remove, runTransaction, set, update } from 'firebase/database';
import { doc, getDoc, type Timestamp } from 'firebase/firestore';
import { newIsland, upgradeIsland, type Island } from '../island/island';
import type { EmoteEvent, Pose, TvEvent, TuneEvent } from '../island/live';
import { auth, db } from './firebase';
import { decodeState, encodeState, linesOf, oldLines, rdb, type StoredLine, type StoredState } from './rtIsland';

export const ISLAND_BUILDERS = 10;

export interface IslandLine {
  uid: string;
  name: string;
  /** What they did: "water", "build", "plant", "harvest", "pick". */
  what: string;
  day: string;
}
export interface IslandDoc {
  owner: string;
  name: string;
  island: Island;
  builders: string[];
  log: IslandLine[];
  /** Seen as it was on Firestore: its owner hasn't opened it since the move (it can't be changed yet). */
  old?: boolean;
}
interface Stored {
  owner: string;
  name?: string;
  builders?: Record<string, boolean>;
  friends?: Record<string, boolean>;
  state?: StoredState;
  log?: Record<string, StoredLine>;
}

const isle = (owner: string, path = '') => ref(rdb(), `isles/${owner}${path}`);
function me(): string {
  const u = auth.currentUser;
  if (!u) throw new Error('Sign in first.');
  return u.uid;
}
const docOf = (s: Stored, owner: string): IslandDoc => ({
  owner,
  name: s.name ?? '',
  island: decodeState(s.state),
  builders: Object.keys(s.builders ?? {}),
  log: linesOf(s.log),
});

/** The island as it was on Firestore (before the move), if there is one and you may see it. */
async function oldIsland(owner: string): Promise<IslandDoc | null> {
  try {
    const s = await getDoc(doc(db, 'islands', owner));
    if (!s.exists()) return null;
    const d = s.data() as { name?: string; island: Island; builders?: string[]; log?: IslandLine[] };
    return { owner, name: d.name ?? '', island: upgradeIsland(d.island), builders: d.builders ?? [], log: d.log ?? [], old: true };
  } catch {
    return null;
  }
}

/** Follows an island (null: it has none yet, or you may not see it). */
export function watchIsland(owner: string, on: (d: IslandDoc | null) => void): () => void {
  let gone = false;
  const mine = auth.currentUser?.uid === owner;
  // Not there (or not allowed: its owner hasn't opened it since the move, so you're not on its friends yet): as it
  // was on Firestore, if anything. (The owner's page moves theirs over: publishIsland.)
  const fallBack = () => {
    if (mine) return on(null);
    void oldIsland(owner).then((d) => !gone && on(d));
  };
  const stop = onValue(
    isle(owner),
    (s) => {
      if (!s.exists()) return fallBack();
      const st = s.val() as Stored;
      on(docOf(st, owner));
      // The owner keeps the book short.
      if (mine) {
        const old = oldLines(st.log);
        if (old.length) void update(isle(owner, '/log'), Object.fromEntries(old.map((k) => [k, null]))).catch(() => {});
      }
    },
    () => fallBack(),
  );
  return () => {
    gone = true;
    stop();
  };
}

/** Puts your island online the first time: the one you had on Firestore if any, else what you built offline. */
export async function publishIsland(island: Island | undefined, name: string): Promise<void> {
  const uid = me();
  if ((await get(isle(uid))).exists()) return;
  const before = await oldIsland(uid);
  const log: Record<string, StoredLine> = {};
  (before?.log ?? []).forEach((l, i) => (log[`a${String(i).padStart(3, '0')}`] = { uid: l.uid, name: l.name.slice(0, 40), what: l.what.slice(0, 12), day: l.day.slice(0, 10) }));
  await set(isle(uid), {
    owner: uid,
    name: (before?.name || name).slice(0, 40),
    builders: Object.fromEntries((before?.builders ?? []).slice(0, ISLAND_BUILDERS).map((b) => [b, true])),
    state: encodeState(before?.island ?? upgradeIsland(island ?? newIsland())),
    log,
  });
}

/**
 * Applies a move to an island in a transaction; `line` (who did what) goes into its book. The owner and its builders
 * change anything; a friend only one plot (watering): any other change is refused.
 */
export async function islandMove(owner: string, move: (island: Island) => Island, line?: Omit<IslandLine, 'uid'>): Promise<void> {
  const uid = me();
  const s = await get(isle(owner));
  if (!s.exists()) throw new Error('That island isn’t online yet: its owner has to open it once.');
  const st = s.val() as Stored;
  if (uid === owner || st.builders?.[uid]) {
    // (The first try may see nothing yet: the database then gives the island as it is, and it runs again.)
    await runTransaction(isle(owner, '/state'), (cur: StoredState | null) => (cur ? encodeState(move(decodeState(cur))) : cur));
  } else {
    const before = decodeState(st.state);
    const after = move(before);
    const rest = (i: Island) => JSON.stringify({ ...i, plots: {} });
    const keys = new Set([...Object.keys(before.plots), ...Object.keys(after.plots)]);
    const changed = [...keys].filter((k) => JSON.stringify(before.plots[k]) !== JSON.stringify(after.plots[k]));
    if (rest(before) !== rest(after) || changed.length !== 1 || !after.plots[changed[0]]) throw Object.assign(new Error('Not allowed on this island.'), { code: 'permission-denied' });
    const k = changed[0];
    await runTransaction(isle(owner, `/state/plots/c${k}`), (cur: string | null) => {
      if (!cur) return cur;
      const isl = { ...before, plots: { ...before.plots, [k]: JSON.parse(cur) } };
      const p = move(isl).plots[k];
      return p ? JSON.stringify(p) : undefined;
    });
  }
  if (line) await push(isle(owner, '/log'), { uid, name: line.name.slice(0, 40), what: line.what.slice(0, 12), day: line.day.slice(0, 10) }).catch(() => {});
}

/** The owner's builders (up to ISLAND_BUILDERS). */
export async function setBuilders(builders: string[]): Promise<void> {
  await set(isle(me(), '/builders'), Object.fromEntries([...new Set(builders)].slice(0, ISLAND_BUILDERS).map((b) => [b, true])));
}

/** The owner's island name. */
export async function renameIsland(name: string): Promise<void> {
  await set(isle(me(), '/name'), name.slice(0, 40));
}

/** The owner's friends, copied onto the island (they may come and water); only written when it changed. */
export async function syncFriends(friends: string[]): Promise<void> {
  const uid = me();
  const now = Object.keys(((await get(isle(uid, '/friends'))).val() ?? {}) as Record<string, boolean>).sort();
  const want = [...new Set(friends)].filter((f) => f && f !== uid).sort();
  if (JSON.stringify(now) === JSON.stringify(want)) return;
  if (!want.length) return void (await remove(isle(uid, '/friends')));
  await set(isle(uid, '/friends'), Object.fromEntries(want.map((f) => [f, true])));
}

/**
 * Who is on an island right now (src/island/live.ts, src/cloud/presence.ts): where they stand, the tool in their hand,
 * their last TV and music switches, their pose and emote, and which world they're in.
 */
export interface HereDoc {
  name: string;
  /** Their icon (a card id), if they picked one. */
  face: string | null;
  x: number;
  y: number;
  left: boolean;
  tool?: string;
  tv?: TvEvent | null;
  tune?: TuneEvent | null;
  pose?: Pose | null;
  emote?: EmoteEvent | null;
  /** The world they are in: "island", or "dungeon:<week>"; none: the island. */
  world?: string;
  at?: Timestamp | null;
}
