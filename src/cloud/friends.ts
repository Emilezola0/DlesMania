// Friends and their collection scores (src/pages/Friends.tsx). Each player who opens Friends gets:
//   friendcodes/<CODE>        { uid }: their friend code, so anyone who has it can find them;
//   scores/<uid>              their name, icon, code, friends and score log (one entry a day they come by).
// Friends are mutual: typing a code adds each player to the other's list (the one adding proves they had
// the code by leaving a note under it, friendcodes/<CODE>/joins/<uid>); removing a friend takes each off
// the other's list. A score can only be read by its player and the players on their list
// (firestore.rules): only friends see each other. A new code stops the old one working.
import { arrayRemove, arrayUnion, deleteDoc, doc, getDoc, runTransaction, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { COSMETIC_BY_ID } from '../casino/cosmetics';
import { bestPlush } from '../casino/plushies';
import { featsOf, TITLE_BY_ID } from '../casino/unlocks';
import { dailyPoints } from '../friends/league';
import { scoreOf } from '../friends/score';
import { todayKey } from '../lib/date';
import { useProgress } from '../store/progress';
import { auth, db } from './firebase';

/** At most this many friends. */
export const MAX_FRIENDS = 30;
/** Days kept in a score log (older ones are dropped). */
const KEEP_DAYS = 400;

/**
 * One day in a log: [score, cards, common, rare, epic, legendary, mythic, omni, grades, dailies points]. The last (the
 * Weekly League's, src/friends/league.ts) is missing on days logged before it came.
 */
export type DayEntry = number[];

export interface ScoreDoc {
  uid: string;
  name: string;
  avatar: string | null;
  frame: string | null;
  /** The name style worn (src/casino/cosmetics.ts), and the title (src/casino/unlocks.ts TITLES); missing in older documents. */
  nameStyle?: string | null;
  title?: string | null;
  /** The best plush won at the claw machine (src/casino/plushies.ts); missing in older documents. */
  plush?: string | null;
  code: string;
  friends: string[];
  log: Record<string, DayEntry>;
  at: number;
}

/** Letters and digits that can't be misread (no O/0, I/1/L); eight of them, too many to guess. */
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const makeCode = () => Array.from({ length: 8 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
export const cleanFriendCode = (s: string) =>
  s
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8);
/** K7QXM3TP → K7QX-M3TP. */
export const showCode = (c: string) => (c.length === 8 ? `${c.slice(0, 4)}-${c.slice(4)}` : c);

const scoreRef = (uid: string) => doc(db, 'scores', uid);
const codeRef = (code: string) => doc(db, 'friendcodes', code);

function me() {
  const u = auth.currentUser;
  if (!u) throw new Error('Sign in to see your friends.');
  return {
    uid: u.uid,
    name: (u.displayName ?? u.email?.split('@')[0] ?? 'A player').trim().slice(0, 40) || 'A player',
  };
}

/** Firebase refusing means the database's rules don't have the friends section yet: said plainly. */
function explain(e: unknown): Error {
  if ((e as { code?: string })?.code === 'permission-denied') return new Error("Friends aren't switched on in the database yet: its rules need the friends section (firestore.rules) published.");
  return e instanceof Error ? e : new Error(String(e));
}

/** Today's entry, from this device's save. */
function today(): DayEntry {
  const s = useProgress.getState();
  const altered = new Set([...Object.keys(s.anomalies ?? {}), ...Object.entries(s.anomalyOptions ?? {}).filter(([, o]) => o?.length).map(([id]) => id)]);
  const info = scoreOf(s.cards, s.grades, altered);
  return [info.score, info.cards, ...info.byRarity, info.grades, dailyPoints(s.days, todayKey())];
}
/** What logToday last wrote on this device: the day and its dailies points (written again when they change). */
const logMark = (entry: DayEntry) => `${todayKey()}:${entry[entry.length - 1]}`;

/** What friends see: the icon card (if still owned), the frame, the name style (if bought) and the title (if earned). */
function looks() {
  const s = useProgress.getState();
  const title = TITLE_BY_ID.get(s.title ?? '');
  return {
    avatar: s.avatar && s.cards[s.avatar] ? s.avatar : null,
    frame: s.frame ?? null,
    nameStyle: s.nameStyle && COSMETIC_BY_ID.has(s.nameStyle) && (s.cosmetics ?? []).includes(s.nameStyle) ? s.nameStyle : null,
    title: title && title.id !== 'newcomer' && title.has(featsOf(s)) ? title.id : null,
    // The plush picked on the Account page (if still owned), else the best one.
    plush: s.shownPlush && s.claw?.plush?.[s.shownPlush] ? s.shownPlush : (bestPlush(s.claw?.plush)?.id ?? null),
  };
}
type Looks = ReturnType<typeof looks>;

/** Database rules from before the plush (or the name style and title) refuse those fields: tried with them all, then with fewer. */
const refused = (e: unknown) => (e as { code?: string })?.code === 'permission-denied';
async function withLooks<T>(write: (l: Partial<Looks>) => Promise<T>): Promise<T> {
  const l = looks();
  const tries: Partial<Looks>[] = [l, { avatar: l.avatar, frame: l.frame, nameStyle: l.nameStyle, title: l.title }, { avatar: l.avatar, frame: l.frame }];
  for (let k = 0; ; k++) {
    try {
      return await write(tries[k]);
    } catch (e) {
      if (!refused(e) || k === tries.length - 1) throw e;
    }
  }
}

/** Takes a free code for this player (a transaction: two players can never get the same one). */
async function claimCode(uid: string): Promise<string> {
  for (let tries = 0; tries < 5; tries++) {
    const code = makeCode();
    const ok = await runTransaction(db, async (tx) => {
      if ((await tx.get(codeRef(code))).exists()) return false;
      tx.set(codeRef(code), { uid });
      return true;
    });
    if (ok) return code;
  }
  throw new Error('Could not make a friend code. Try again.');
}

/** This player's score document: made (with a friend code) the first time, today's score written. */
export async function openMine(): Promise<ScoreDoc> {
  const { uid, name } = me();
  try {
    const snap = await getDoc(scoreRef(uid));
    const day = todayKey();
    if (!snap.exists()) {
      const code = await claimCode(uid);
      return await withLooks(async (l) => {
        const fresh: ScoreDoc = { uid, name, avatar: null, frame: null, ...l, code, friends: [], log: { [day]: today() }, at: Date.now() };
        await setDoc(scoreRef(uid), fresh);
        return fresh;
      });
    }
    const mine = snap.data() as ScoreDoc;
    const entry = today();
    const days = Object.keys(mine.log ?? {}).sort();
    if (days.length >= KEEP_DAYS) {
      // Too long: the oldest days go, the whole log rewritten once.
      const log = Object.fromEntries(days.slice(-(KEEP_DAYS - 1)).map((d) => [d, mine.log[d]]));
      log[day] = entry;
      return await withLooks(async (l) => {
        await updateDoc(scoreRef(uid), { log, name, ...l, at: Date.now() });
        return { ...mine, log, name, ...l };
      });
    }
    return await withLooks(async (l) => {
      await updateDoc(scoreRef(uid), { [`log.${day}`]: entry, name, ...l, at: Date.now() });
      return { ...mine, name, ...l, log: { ...mine.log, [day]: entry } };
    });
  } catch (e) {
    throw explain(e);
  }
}

/**
 * Today's score, written when the save syncs (src/cloud/engine.ts) once a day, and again whenever the day's dailies
 * points change (the Weekly League), only for players who opened Friends: their friends see them move even on days
 * they don't open it.
 */
export async function logToday(uid: string): Promise<void> {
  const key = `omnidle:score-day:${uid}`;
  const day = todayKey();
  try {
    if (localStorage.getItem(`omnidle:friends:${uid}`) !== '1') return;
    const entry = today();
    if (localStorage.getItem(key) === logMark(entry)) return;
    // The looks too, so friends see a new name style or title without this player opening Friends.
    await withLooks((l) => updateDoc(scoreRef(uid), { [`log.${day}`]: entry, ...l, at: Date.now() }));
    localStorage.setItem(key, logMark(entry));
  } catch {
    // No storage, no score document yet, or offline: tomorrow, or when Friends opens.
  }
}

/** Remembers that this device's player uses Friends (for logToday). */
export function markFriendsOn(uid: string) {
  try {
    localStorage.setItem(`omnidle:friends:${uid}`, '1');
    localStorage.setItem(`omnidle:score-day:${uid}`, logMark(today()));
  } catch {
    // No storage: the score is only written when Friends opens.
  }
}

/** The friends' score documents (one read each); a friend who can't be read any more is left out. */
export async function loadFriends(mine: ScoreDoc): Promise<ScoreDoc[]> {
  const docs = await Promise.all(
    mine.friends.map((f) =>
      getDoc(scoreRef(f))
        .then((s) => (s.exists() ? (s.data() as ScoreDoc) : null))
        .catch(() => null),
    ),
  );
  return docs.filter((d): d is ScoreDoc => !!d);
}

/** Adds the player whose code this is, and adds this player to theirs. */
export async function addFriend(mine: ScoreDoc, raw: string): Promise<ScoreDoc> {
  const { uid } = me();
  const code = cleanFriendCode(raw);
  if (code.length !== 8) throw new Error('A friend code has 8 letters and digits.');
  try {
    const found = await getDoc(codeRef(code));
    if (!found.exists()) throw new Error('No player has that code (it may have been changed).');
    const them = (found.data() as { uid: string }).uid;
    if (them === uid) throw new Error("That's your own code.");
    if (mine.friends.includes(them)) throw new Error("You're already friends.");
    if (mine.friends.length >= MAX_FRIENDS) throw new Error(`You have ${MAX_FRIENDS} friends already: remove one first.`);
    const batch = writeBatch(db);
    batch.set(doc(db, 'friendcodes', code, 'joins', uid), { at: Date.now() });
    batch.update(scoreRef(them), { friends: arrayUnion(uid) });
    batch.update(scoreRef(uid), { friends: arrayUnion(them) });
    await batch.commit();
    return { ...mine, friends: [...mine.friends, them] };
  } catch (e) {
    throw explain(e);
  }
}

/** Removes a friend: each leaves the other's list. */
export async function removeFriend(mine: ScoreDoc, them: string): Promise<ScoreDoc> {
  const { uid } = me();
  try {
    const batch = writeBatch(db);
    batch.update(scoreRef(uid), { friends: arrayRemove(them) });
    batch.update(scoreRef(them), { friends: arrayRemove(uid) });
    await batch.commit().catch(async () => {
      // Their document gone or already without us: take them off ours at least.
      await updateDoc(scoreRef(uid), { friends: arrayRemove(them) });
    });
    return { ...mine, friends: mine.friends.filter((f) => f !== them) };
  } catch (e) {
    throw explain(e);
  }
}

/** A new friend code: the old one stops working (friends already added stay). */
export async function changeCode(mine: ScoreDoc): Promise<ScoreDoc> {
  const { uid } = me();
  try {
    const code = await claimCode(uid);
    await updateDoc(scoreRef(uid), { code });
    await deleteDoc(codeRef(mine.code)).catch(() => undefined);
    return { ...mine, code };
  } catch (e) {
    throw explain(e);
  }
}

export const myUid = () => auth.currentUser?.uid ?? null;
