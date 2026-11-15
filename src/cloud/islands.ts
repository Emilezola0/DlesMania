// Islands (src/island/, stage 3): islands/<uid>, a signed-in player's island, shared. The owner and the builders they
// invite (up to ISLAND_BUILDERS, among their friends) build on it; any friend may visit, and water a plot (it grows a
// day sooner; the helper gets a seed). The moves are the same pure functions as offline (src/island/island.ts), run in
// a transaction; what's taken from or added to a bag goes to the player who moved, in their own save.
import { collection, deleteDoc, doc, getDoc, onSnapshot, runTransaction, serverTimestamp, setDoc, updateDoc, type Timestamp } from 'firebase/firestore';
import { ISLAND_V, newIsland, upgradeIsland, type Island } from '../island/island';
import type { EmoteEvent, Pose, TvEvent, TuneEvent } from '../island/live';
import { auth, db } from './firebase';

export const ISLAND_BUILDERS = 10;
/** How many lines the visitors' book keeps. */
const LOG = 30;

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
  at?: Timestamp | null;
}

const ref = (uid: string) => doc(db, 'islands', uid);
function me(): string {
  const u = auth.currentUser;
  if (!u) throw new Error('Sign in first.');
  return u.uid;
}

/** Follows an island (null: it has none yet, or you may not see it). */
export function watchIsland(owner: string, on: (d: IslandDoc | null) => void): () => void {
  return onSnapshot(
    ref(owner),
    (s) => {
      if (!s.exists()) return on(null);
      const d = s.data() as IslandDoc;
      // Saved before the world grew: shown moved into the new world; the owner's own page saves it moved (friends
      // may only water, which can't move an island).
      if (d.island?.v !== ISLAND_V && auth.currentUser?.uid === owner) void islandMove(owner, (i) => i).catch(() => {});
      on({ ...d, island: upgradeIsland(d.island) });
    },
    () => on(null),
  );
}

/** Puts your island online the first time (from what you built offline). */
export async function publishIsland(island: Island | undefined, name: string): Promise<void> {
  const uid = me();
  const s = await getDoc(ref(uid));
  if (s.exists()) return;
  await setDoc(ref(uid), { owner: uid, name: name.slice(0, 40), island: upgradeIsland(island ?? newIsland()), builders: [], log: [], at: serverTimestamp() });
}

/** Applies a move to an island in a transaction; `line` (who did what) goes into its book. */
export async function islandMove(owner: string, move: (island: Island) => Island, line?: Omit<IslandLine, 'uid'>): Promise<void> {
  const uid = me();
  await runTransaction(db, async (tx) => {
    const s = await tx.get(ref(owner));
    if (!s.exists()) throw new Error('That island isn’t online.');
    const d = s.data() as IslandDoc;
    // Firestore refuses undefined fields (a layer or a book of names a move left empty): drop them.
    const island = JSON.parse(JSON.stringify(move(upgradeIsland(d.island)))) as Island;
    tx.update(ref(owner), {
      island,
      ...(line ? { log: [...(d.log ?? []), { ...line, uid }].slice(-LOG) } : {}),
      at: serverTimestamp(),
    } as unknown as Record<string, never>);
  });
}

/** The owner's builders (up to ISLAND_BUILDERS). */
export async function setBuilders(builders: string[]): Promise<void> {
  await updateDoc(ref(me()), { builders: [...new Set(builders)].slice(0, ISLAND_BUILDERS), at: serverTimestamp() });
}

/** The owner's island name. */
export async function renameIsland(name: string): Promise<void> {
  await updateDoc(ref(me()), { name: name.slice(0, 40), at: serverTimestamp() });
}

/**
 * Who is on an island right now (islands/<owner>/here/<uid>): where they stand, written a few times a second while
 * they move (and now and then while they stand still), removed when they leave. Seen by everyone on the island.
 */
export interface HereDoc {
  name: string;
  /** Their icon (a card id), if they picked one. */
  face: string | null;
  x: number;
  y: number;
  left: boolean;
  /** The tool in their hand, and their last TV and music switches (src/island/live.ts). */
  tool?: string;
  tv?: TvEvent | null;
  tune?: TuneEvent | null;
  pose?: Pose | null;
  emote?: EmoteEvent | null;
  /** The world they are in: "island", or "dungeon:<week>" (src/island/live.ts); none: the island. */
  world?: string;
  at?: Timestamp | null;
}
const here = (owner: string, uid: string) => doc(db, 'islands', owner, 'here', uid);

export function watchHere(owner: string, on: (list: (HereDoc & { uid: string })[]) => void): () => void {
  return onSnapshot(
    collection(db, 'islands', owner, 'here'),
    (s) => on(s.docs.map((d) => ({ uid: d.id, ...(d.data() as HereDoc) }))),
    () => on([]),
  );
}

export async function sayHere(owner: string, h: Omit<HereDoc, 'at'>): Promise<void> {
  await setDoc(here(owner, me()), {
    name: h.name.slice(0, 40),
    face: h.face ?? null,
    x: h.x,
    y: h.y,
    left: h.left,
    tool: h.tool ?? 'walk',
    tv: h.tv ?? null,
    tune: h.tune ?? null,
    pose: h.pose ?? null,
    emote: h.emote ?? null,
    ...(h.world ? { world: h.world.slice(0, 24) } : {}),
    at: serverTimestamp(),
  });
}

export async function leaveHere(owner: string): Promise<void> {
  const u = auth.currentUser;
  if (u) await deleteDoc(here(owner, u.uid)).catch(() => {});
}
