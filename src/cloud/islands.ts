// Islands (src/island/, stage 3): islands/<uid>, a signed-in player's island, shared. The owner and the builders they
// invite (up to ISLAND_BUILDERS, among their friends) build on it; any friend may visit, and water a plot (it grows a
// day sooner; the helper gets a seed). The moves are the same pure functions as offline (src/island/island.ts), run in
// a transaction; what's taken from or added to a bag goes to the player who moved, in their own save.
import { doc, getDoc, onSnapshot, runTransaction, serverTimestamp, setDoc, updateDoc, type Timestamp } from 'firebase/firestore';
import { newIsland, type Island } from '../island/island';
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
    (s) => on(s.exists() ? (s.data() as IslandDoc) : null),
    () => on(null),
  );
}

/** Puts your island online the first time (from what you built offline). */
export async function publishIsland(island: Island | undefined, name: string): Promise<void> {
  const uid = me();
  const s = await getDoc(ref(uid));
  if (s.exists()) return;
  await setDoc(ref(uid), { owner: uid, name: name.slice(0, 40), island: island ?? newIsland(), builders: [], log: [], at: serverTimestamp() });
}

/** Applies a move to an island in a transaction; `line` (who did what) goes into its book. */
export async function islandMove(owner: string, move: (island: Island) => Island, line?: Omit<IslandLine, 'uid'>): Promise<void> {
  const uid = me();
  await runTransaction(db, async (tx) => {
    const s = await tx.get(ref(owner));
    if (!s.exists()) throw new Error('That island isn’t online.');
    const d = s.data() as IslandDoc;
    const island = move(d.island);
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
