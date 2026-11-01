// Curve Clash online: a game is a document in clash/<CODE> — its field's seed, its two players, and its
// rounds, each one both players' moves. Both players fire at once: a round is over when both moves are in
// (or the clock ran out on one: the other then fills in "no shot" for them). Each device replays the
// rounds into the same game (src/arcade/curveClash.ts). firestore.rules lets only the two players write.
import { doc, onSnapshot, runTransaction } from 'firebase/firestore';
import type { Level, Move, Round } from '../arcade/curveClash';
import { auth, db } from './firebase';

export interface ClashGame {
  code: string;
  seed: number;
  /** The field's level (older games: medium). */
  level?: Level;
  host: string;
  hostName: string;
  guest: string | null;
  guestName: string | null;
  rounds: Round[];
  /** When the round being played started (ms). */
  roundAt: number;
  createdAt: number;
}

/** Seconds to write a function each round; a move missing that long after (plus a grace) is skipped. */
export const CLASH_SECONDS = 45;
const GRACE_MS = 5000;

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const newCode = () => Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
export const cleanClashCode = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);

function me() {
  const u = auth.currentUser;
  if (!u) throw new Error('Sign in to play online.');
  return { uid: u.uid, name: u.displayName ?? u.email?.split('@')[0] ?? 'A player' };
}
export const clashUid = () => auth.currentUser?.uid ?? null;
const ref = (code: string) => doc(db, 'clash', code);

/** A new game, waiting for someone to join: its code. */
export async function createClash(level: Level = 'medium'): Promise<string> {
  const { uid, name } = me();
  for (let tries = 0; tries < 5; tries++) {
    const code = newCode();
    const made = await runTransaction(db, async (tx) => {
      if ((await tx.get(ref(code))).exists()) return false;
      tx.set(ref(code), { code, seed: Math.floor(Math.random() * 1e9), level, host: uid, hostName: name, guest: null, guestName: null, rounds: [{}], roundAt: Date.now(), createdAt: Date.now() });
      return true;
    });
    if (made) return code;
  }
  throw new Error('Try again in a moment.');
}

/** Joins a game by its code (or comes back to one of one's own). */
export async function joinClash(code: string): Promise<void> {
  const { uid, name } = me();
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref(code));
    if (!snap.exists()) throw new Error('No game with that code.');
    const g = snap.data() as ClashGame;
    if (g.host === uid || g.guest === uid) return;
    if (g.guest) throw new Error('That game already has two players.');
    tx.update(ref(code), { guest: uid, guestName: name, roundAt: Date.now() });
  });
}

/** Puts a move in for a player (0 Blue, 1 Red) in the round being played; the last one in starts the next round. */
export async function sendMove(code: string, round: number, player: 0 | 1, move: Move): Promise<void> {
  me();
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref(code));
    if (!snap.exists()) return;
    const g = snap.data() as ClashGame;
    const rounds = g.rounds.map((r) => ({ ...r }));
    const r = rounds[round];
    const slot = player === 0 ? 'a' : 'b';
    if (!r || r[slot]) return;
    r[slot] = move;
    const update: Partial<ClashGame> = { rounds };
    if (r.a && r.b) (rounds.push({}), (update.roundAt = Date.now()));
    tx.update(ref(code), update);
  });
}

/** Whether the other player's move is late enough to be skipped. */
export const isLate = (g: ClashGame) => Date.now() > g.roundAt + CLASH_SECONDS * 1000 + GRACE_MS;

/** Follows a game as it changes. */
export function watchClash(code: string, on: (g: ClashGame | null) => void, onError: (e: Error) => void): () => void {
  return onSnapshot(ref(code), (s) => on(s.exists() ? (s.data() as ClashGame) : null), onError);
}
