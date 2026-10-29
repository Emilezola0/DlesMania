// Group codes: a daily played together counts for everyone at the table. Whoever played it (signed in)
// makes a code once they've finished the category; friends who haven't finished it type the code and
// get the same rounds, as if they'd played them — the same answers, the same score, the coins and the
// streak. A code is groups/<CODE> in Firestore: the day's draw and its ten rounds. It only works on its
// own day, for a few friends (MAX_JOINS), and a day that came from a code can't make one (no chains).
import { doc, getDoc, runTransaction } from 'firebase/firestore';
import { dayKey, useProgress } from '../store/progress';
import { todayKey } from '../lib/date';
import type { Domain, RoundRecord, RoundSpec } from '../types';
import { auth, db } from './firebase';

export const MAX_JOINS = 12;

export interface Group {
  code: string;
  host: string;
  hostName: string;
  domain: Domain;
  date: string;
  specs: RoundSpec[];
  /** The ten rounds, by index ("0".."9"). */
  rounds: Record<string, RoundRecord>;
  joined: number;
  createdAt: number;
}

/** Letters and digits that can't be misread (no O/0, I/1/L). */
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const newCode = () => Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
export const cleanGroupCode = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);

const finished = (r?: RoundRecord) => !!r && r.status !== 'playing';
/** Firestore keeps no `undefined`: the specs as plain JSON. */
const plain = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

/** Makes (or gives back) the code for a category the player finished today. */
export async function makeGroup(domain: Domain): Promise<string> {
  const u = auth.currentUser;
  if (!u) throw new Error('Sign in (Account page) to make a group code.');
  const date = todayKey();
  const key = dayKey(domain, date);
  const st = useProgress.getState();
  const mine = st.groups?.[key];
  if (mine?.role === 'host') return mine.code;
  if (mine?.role === 'joined') throw new Error('This daily came from a group code: only the player who played it can share it.');
  const rounds = st.days[key] ?? {};
  const specs = st.specs[key];
  if (!specs || specs.length !== 10 || !specs.every((_, i) => finished(rounds[i]))) throw new Error('Finish all ten rounds first.');
  for (let tries = 0; tries < 5; tries++) {
    const code = newCode();
    const ref = doc(db, 'groups', code);
    const made = await runTransaction(db, async (tx) => {
      if ((await tx.get(ref)).exists()) return false;
      const group: Group = {
        code,
        host: u.uid,
        hostName: u.displayName ?? u.email?.split('@')[0] ?? 'A player',
        domain,
        date,
        specs: plain(specs),
        rounds: plain(Object.fromEntries(specs.map((_, i) => [String(i), rounds[i]]))),
        joined: 0,
        createdAt: Date.now(),
      };
      tx.set(ref, group);
      return true;
    });
    if (made) {
      useProgress.getState().setGroup(key, { code, role: 'host' });
      return code;
    }
  }
  throw new Error('Could not make a code — try again.');
}

/** How many friends have used a code so far. */
export async function groupJoins(code: string): Promise<number> {
  const snap = await getDoc(doc(db, 'groups', cleanGroupCode(code)));
  return snap.exists() ? ((snap.data() as Group).joined ?? 0) : 0;
}

/**
 * Joins a group: the rounds of today's category not finished yet become the host's (rounds already
 * finished stay the player's own). Returns the group and how many rounds came from it.
 */
export async function joinGroup(raw: string, domain: Domain): Promise<{ group: Group; added: number }> {
  const code = cleanGroupCode(raw);
  if (code.length !== 6) throw new Error('A group code has 6 letters and digits.');
  const ref = doc(db, 'groups', code);
  const date = todayKey();
  const key = dayKey(domain, date);
  const check = (g: Group) => {
    if (g.date !== date) throw new Error("That code was for another day's daily.");
    if (g.domain !== domain) throw new Error(`That code is for the ${g.domain[0].toUpperCase()}${g.domain.slice(1)} daily — open that one to use it.`);
    if (auth.currentUser && g.host === auth.currentUser.uid) throw new Error("That's your own code.");
    if ((g.joined ?? 0) >= MAX_JOINS) throw new Error(`That code has been used by ${MAX_JOINS} friends already.`);
  };
  const st = useProgress.getState();
  if (st.groups?.[key]) throw new Error('You already used a group code for this daily.');
  const mine = st.days[key] ?? {};
  const own = st.specs[key];

  const group = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('No group with that code.');
    const g = snap.data() as Group;
    check(g);
    // Rounds already finished here must be the same rounds as the group's.
    const played = g.specs.map((_, i) => i).filter((i) => finished(mine[i]));
    if (played.length && (!own || played.some((i) => JSON.stringify(own[i]) !== JSON.stringify(g.specs[i])))) {
      throw new Error("Your rounds today aren't the same draw as the group's — the code can't be used here.");
    }
    if (played.length === g.specs.length) throw new Error('You already finished this daily.');
    tx.update(ref, { joined: (g.joined ?? 0) + 1 });
    return g;
  });

  // The rounds, one by one: each pays its coins and counts for the missions, as if played here.
  const p = useProgress.getState();
  if (!Object.values(mine).some(finished)) p.saveSpecs(domain, date, group.specs);
  let added = 0;
  group.specs.forEach((_, i) => {
    const r = group.rounds[String(i)];
    if (finished(mine[i]) || !finished(r)) return;
    useProgress.getState().setRound(domain, date, i, r);
    added++;
  });
  p.setGroup(key, { code, role: 'joined', host: group.hostName });
  return { group, added };
}
