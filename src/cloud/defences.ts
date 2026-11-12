// The Defence Deck (src/friends/DefenceDeck.tsx): defences/<uid>, a player's defence (five cards in order, changed at
// most once a day), read by them and their friends; defences/<uid>/attacks/<attacker>_<day>, an attack a friend made on
// it (once a day each), with both teams as they fought, so the defender can watch it again. The defender lists their
// attacks; the attacker reads their own (firestore.rules).
import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where, type Timestamp } from 'firebase/firestore';
import type { TeamCard } from '../friends/defenceCards';
import { auth, db } from './firebase';

export interface DefenceDoc {
  uid: string;
  name: string;
  /** The day it was last set (it can change once a day). */
  day: string;
  team: TeamCard[];
  at: Timestamp | null;
}

export interface AttackDoc {
  /** The attacker. */
  uid: string;
  name: string;
  day: string;
  /** Whether the attacker won. */
  won: boolean;
  /** The attacker's team, and the defence as it stood, both in their order. */
  team: TeamCard[];
  def: TeamCard[];
  at: Timestamp | null;
}

const defRef = (uid: string) => doc(db, 'defences', uid);
const attackRef = (defender: string, attacker: string, day: string) => doc(db, 'defences', defender, 'attacks', `${attacker}_${day}`);

function me() {
  const u = auth.currentUser;
  if (!u) throw new Error('Sign in to play the Defence Deck.');
  return { uid: u.uid, name: (u.displayName ?? u.email?.split('@')[0] ?? 'A player').trim().slice(0, 40) || 'A player' };
}

/** Firestore keeps no `undefined`: a card's missing anomaly is stored as null. */
const clean = (team: TeamCard[]): TeamCard[] => team.map((t) => ({ id: t.id, grade: t.grade, element: t.element, anomaly: t.anomaly ?? null }));

export async function defenceOf(uid: string): Promise<DefenceDoc | null> {
  const s = await getDoc(defRef(uid)).catch(() => null);
  return s?.exists() ? (s.data() as DefenceDoc) : null;
}

/** These players' defences (one read each; a player with none is left out). */
export async function defencesOf(uids: string[]): Promise<DefenceDoc[]> {
  const docs = await Promise.all(uids.map(defenceOf));
  return docs.filter((d): d is DefenceDoc => !!d);
}

/** Sets this player's defence (once a day). */
export async function setDefence(day: string, team: TeamCard[]): Promise<DefenceDoc> {
  const { uid, name } = me();
  const d = { uid, name, day, team: clean(team) };
  await setDoc(defRef(uid), { ...d, at: serverTimestamp() });
  return { ...d, at: null };
}

/** Records an attack on a friend's defence (once a day per friend). */
export async function recordAttack(defender: string, day: string, won: boolean, team: TeamCard[], def: TeamCard[]): Promise<AttackDoc> {
  const { uid, name } = me();
  const a = { uid, name, day, won, team: clean(team), def: clean(def) };
  await setDoc(attackRef(defender, uid, day), { ...a, at: serverTimestamp() });
  return { ...a, at: null };
}

/** This player's attacks of a day on these friends (one read each). */
export async function myAttacks(defenders: string[], day: string): Promise<Map<string, AttackDoc>> {
  const { uid } = me();
  const out = new Map<string, AttackDoc>();
  await Promise.all(
    defenders.map((d) =>
      getDoc(attackRef(d, uid, day))
        .then((s) => s.exists() && out.set(d, s.data() as AttackDoc))
        .catch(() => undefined),
    ),
  );
  return out;
}

/** The attacks on this player's defence since a day. */
export async function attacksOnMe(since: string): Promise<AttackDoc[]> {
  const { uid } = me();
  const snap = await getDocs(query(collection(db, 'defences', uid, 'attacks'), where('day', '>=', since)));
  return snap.docs.map((d) => d.data() as AttackDoc).sort((a, b) => (b.at?.toMillis() ?? 0) - (a.at?.toMillis() ?? 0));
}
