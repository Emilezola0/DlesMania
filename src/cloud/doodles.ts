// The Daily Doodle (Friends → Daily Doodle): each player draws one character a day in 10 seconds, and their
// friends guess who it is (src/friends/Doodle.tsx). A drawing lives in doodles/<uid>_<day>; its friends' guesses
// in doodles/<id>/guesses/<their uid>. Only the artist and their friends can read it (firestore.rules). The
// answer is kept as a hash of the character's name, so a guess is checked without the name being written out.
import { arrayUnion, doc, getDoc, setDoc, writeBatch } from 'firebase/firestore';
import { auth, db } from './firebase';

/** One stroke: a colour and a width (indexes into the palette), its points packed in a string (see pack). */
export interface Stroke {
  c: number;
  w: number;
  p: string;
}

export interface DoodleDoc {
  uid: string;
  /** The artist's name, as on their friends' list. */
  name: string;
  day: string;
  /** The franchise (a card set): the hint everyone gets. */
  set: string;
  /** Seconds it was drawn in (10, 20 or 30): what a right guess pays. Missing on the first drawings: 10. */
  secs?: number;
  /** The character's name, hashed (see answerHash). */
  answer: string;
  strokes: Stroke[];
  /** Friends who guessed it. */
  solvers: string[];
  at: number;
}

export interface GuessDoc {
  tries: number;
  right: boolean;
  at: number;
}

export const doodleId = (uid: string, day: string) => `${uid}_${day}`;
const doodleRef = (id: string) => doc(db, 'doodles', id);
const guessRef = (id: string, uid: string) => doc(db, 'doodles', id, 'guesses', uid);

/** "Son Goku" → "son goku": a name as it's compared. */
export const normName = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** The hash a drawing keeps of its answer: tied to the drawing, so the same character hashes differently each time. */
export async function answerHash(id: string, name: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`omnidle-doodle:${id}:${normName(name)}`));
  return Array.from(new Uint8Array(bytes).slice(0, 12), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Which of these names is the answer (to show it once a player is done guessing). */
export async function findAnswer(d: DoodleDoc, names: string[]): Promise<string | null> {
  const id = doodleId(d.uid, d.day);
  for (const n of names) if ((await answerHash(id, n)) === d.answer) return n;
  return null;
}

function me() {
  const u = auth.currentUser;
  if (!u) throw new Error('Sign in to play the Daily Doodle.');
  return { uid: u.uid, name: (u.displayName ?? u.email?.split('@')[0] ?? 'A player').trim().slice(0, 40) || 'A player' };
}

/** Points (0 to 1) packed two characters a coordinate (4096 steps), so a drawing stays small. */
const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
export function pack(points: [number, number][]): string {
  let out = '';
  for (const [x, y] of points)
    for (const v of [x, y]) {
      const n = Math.max(0, Math.min(4095, Math.round(v * 4095)));
      out += ALPHA[n >> 6] + ALPHA[n & 63];
    }
  return out;
}
export function unpack(p: string): [number, number][] {
  const out: [number, number][] = [];
  const val = (i: number) => ((ALPHA.indexOf(p[i]) << 6) | ALPHA.indexOf(p[i + 1])) / 4095;
  for (let i = 0; i + 3 < p.length; i += 4) out.push([val(i), val(i + 2)]);
  return out;
}

/** This player's drawing of the day, if they've drawn it. */
export async function myDoodle(day: string): Promise<DoodleDoc | null> {
  const { uid } = me();
  const s = await getDoc(doodleRef(doodleId(uid, day)));
  return s.exists() ? (s.data() as DoodleDoc) : null;
}

/** Posts the day's drawing (once a day). */
export async function postDoodle(day: string, set: string, character: string, strokes: Stroke[], secs: number): Promise<DoodleDoc> {
  const { uid, name } = me();
  const id = doodleId(uid, day);
  const d: DoodleDoc = { uid, name, day, set, secs, answer: await answerHash(id, character), strokes, solvers: [], at: Date.now() };
  await setDoc(doodleRef(id), d);
  return d;
}

/** The friends' drawings of these days (one read each; a friend who drew nothing is left out). */
export async function friendDoodles(friends: string[], days: string[]): Promise<DoodleDoc[]> {
  const docs = await Promise.all(
    friends.flatMap((f) =>
      days.map((day) =>
        getDoc(doodleRef(doodleId(f, day)))
          .then((s) => (s.exists() ? (s.data() as DoodleDoc) : null))
          .catch(() => null),
      ),
    ),
  );
  return docs.filter((d): d is DoodleDoc => !!d).sort((a, b) => b.at - a.at);
}

/** This player's guesses at a drawing so far. */
export async function myGuess(d: DoodleDoc): Promise<GuessDoc | null> {
  const { uid } = me();
  const s = await getDoc(guessRef(doodleId(d.uid, d.day), uid)).catch(() => null);
  return s?.exists() ? (s.data() as GuessDoc) : null;
}

/** A guess at a drawing: whether it's right, and the guesses as they now stand. A right guess adds the player to its solvers. */
export async function guessDoodle(d: DoodleDoc, before: GuessDoc | null, name: string): Promise<GuessDoc> {
  const { uid } = me();
  const id = doodleId(d.uid, d.day);
  const right = (await answerHash(id, name)) === d.answer;
  const next: GuessDoc = { tries: (before?.tries ?? 0) + 1, right, at: Date.now() };
  const batch = writeBatch(db);
  batch.set(guessRef(id, uid), next);
  if (right) batch.update(doodleRef(id), { solvers: arrayUnion(uid) });
  await batch.commit();
  return next;
}
