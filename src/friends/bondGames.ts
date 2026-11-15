// The two Bond games (Friends → Bond), played by the two friends of a Bond, each giving the Bond points on top of its
// day-together points (src/cloud/bonds.ts `extra`). The numbers here are in firestore.rules too (meldRounds(),
// meldPoints(), eggDays(), eggPair(), eggHatch()): change both.
//   Mind Meld: two cards; each of you writes, unseen, one word that links them. The same word: a Meld, points (more the
//   sooner). Not the same: next round, link the two words you wrote, and so on, up to MELD.rounds. One game a day.
//   Bond Egg: an egg you raise together. Each day each of you does one thing for it (train, play, teach, cuddle);
//   two different things the same day are teamwork (a point). After EGG.days days you both tended it, it hatches,
//   into a creature shaped by what you did most (more points), and joins your Bond's pets; then a new egg.
import type { BondDoc } from '../cloud/bonds';
import { CARDS, SETS } from '../gacha/cards';

export const MELD = {
  /** Rounds before a game is lost. */
  rounds: 8,
  /** Points for a Meld on round 1, 2, and later. */
  points: [3, 2, 1],
};

/** The points a Meld on this round gives. */
export const meldPoints = (round: number) => MELD.points[Math.min(round, MELD.points.length) - 1];

/** A word as compared: lower case, no accents, no punctuation, single spaces ("Pokémon!" → "pokemon"). */
export function normWord(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 24);
}

/** Two characters to link, from the same franchise (a new game; never the JLPT's kanji, never the same character twice). */
export function meldCards(rand: () => number = Math.random): [string, string] {
  const sets = SETS.filter((s) => s.id !== 'jlpt' && CARDS.filter((c) => c.set === s.id).length >= 2);
  const set = sets[Math.floor(rand() * sets.length)].id;
  const pool = CARDS.filter((c) => c.set === set);
  const a = pool[Math.floor(rand() * pool.length)];
  const others = pool.filter((c) => c.id !== a.id && c.name !== a.name);
  const b = others[Math.floor(rand() * others.length)] ?? pool.find((c) => c.id !== a.id)!;
  return [a.id, b.id];
}

export interface MeldGame {
  /** Games played on this Bond (this one's number). */
  id: number;
  /** The day it was started (one a day). */
  day: string;
  /** The two cards of round 1 (ids). */
  cards: string[];
  /** The round being played. */
  round: number;
  /** Every word written: "<round>_<uid>". */
  words: Record<string, string>;
  done: boolean;
  /** The points it gave (0 while played, or lost). */
  won: number;
}

/** The rounds so far: each one's two words (one maybe still missing, or hidden). */
export function meldRounds(g: MeldGame, a: string, b: string): { round: number; a?: string; b?: string }[] {
  return Array.from({ length: g.round }, (_, k) => ({ round: k + 1, a: g.words[`${k + 1}_${a}`], b: g.words[`${k + 1}_${b}`] }));
}

// ---- Bond Egg

export type EggStat = 'str' | 'joy' | 'wit' | 'calm';
export interface EggAction {
  id: string;
  stat: EggStat;
  icon: string;
  label: string;
  fr: string;
}
export const EGG_ACTIONS: EggAction[] = [
  { id: 'train', stat: 'str', icon: '💪', label: 'Train', fr: 'Entraîner' },
  { id: 'play', stat: 'joy', icon: '🎾', label: 'Play', fr: 'Jouer' },
  { id: 'teach', stat: 'wit', icon: '📖', label: 'Teach', fr: 'Apprendre' },
  { id: 'cuddle', stat: 'calm', icon: '🤗', label: 'Cuddle', fr: 'Câliner' },
];
export const ACTION_BY_ID = new Map(EGG_ACTIONS.map((a) => [a.id, a]));

export const EGG = {
  /** Days you both tended it before it hatches. */
  days: 10,
  /** Points for a day of teamwork (two different things), and for hatching it. */
  pair: 1,
  hatch: 5,
};

export interface Egg {
  /** The day it was laid. */
  born: string;
  /** What each did each day: "<day>_<uid>": action id. */
  acts: Record<string, string>;
  /** The last act ("<day>_<uid>"; the rules read it). */
  last: string;
  /** Days you both tended it. */
  days: number;
  stats: Record<EggStat, number>;
  hatched: boolean;
}

export const newEgg = (day: string): Egg => ({ born: day, acts: {}, last: '', days: 0, stats: { str: 0, joy: 0, wit: 0, calm: 0 }, hatched: false });

/**
 * What an act adds to the stats: +2 to its own; and if the friend has already tended it today, +1 more each to both
 * things done (teamwork), or +1 to the same one (they did the same). Never more than 3 on one stat (the rules check it).
 */
export function tendStats(stats: Egg['stats'], mine: string, theirs: string | undefined): Egg['stats'] {
  const out = { ...stats };
  const m = ACTION_BY_ID.get(mine)!.stat;
  out[m] += 2;
  if (theirs) {
    const t = ACTION_BY_ID.get(theirs)!.stat;
    out[m] += 1;
    if (t !== m) out[t] += 1;
  }
  return out;
}

/** The points an act gives: teamwork on the day, and the hatching. */
export function tendPoints(mine: string, theirs: string | undefined, hatches: boolean): number {
  return (theirs && theirs !== mine ? EGG.pair : 0) + (hatches ? EGG.hatch : 0);
}

export interface Pet {
  name: string;
  fr: string;
  icon: string;
  color: string;
  blurb: string;
}
const PETS: Record<EggStat | 'all', Pet> = {
  str: { name: 'Ember Drake', fr: 'Drakon de braise', icon: '🐉', color: '#f97316', blurb: 'Raised on training: small, proud, and breathing sparks.' },
  joy: { name: 'Sunny Fox', fr: 'Renard soleil', icon: '🦊', color: '#facc15', blurb: 'Raised on games: it never stops bouncing.' },
  wit: { name: 'Owl Sage', fr: 'Hibou sage', icon: '🦉', color: '#818cf8', blurb: 'Raised on lessons: it already knows every daily answer.' },
  calm: { name: 'Moon Bunny', fr: 'Lapin de lune', icon: '🐰', color: '#f0abfc', blurb: 'Raised on cuddles: soft, sleepy, and glowing faintly.' },
  all: { name: 'Prism Phoenix', fr: 'Phénix prisme', icon: '🦚', color: '#5eead4', blurb: 'Raised on a bit of everything: every colour at once. The rarest.' },
};

/** What an egg hatches into: the stat it got most, or the Prism Phoenix when they're all close. */
export function petOf(stats: Egg['stats']): Pet {
  const vals = Object.values(stats);
  if (Math.max(...vals) - Math.min(...vals) <= 4) return PETS.all;
  const top = (Object.keys(stats) as EggStat[]).reduce((b, k) => (stats[k] > stats[b] ? k : b), 'str');
  return PETS[top];
}

/** How far along it is: 0 a smooth egg, 1 cracks, 2 big cracks and a glow, 3 hatched. */
export const eggStage = (e: Pick<Egg, 'days' | 'hatched'>) => (e.hatched ? 3 : e.days >= EGG.days - 2 ? 2 : e.days >= EGG.days / 2 - 1 ? 1 : 0);

// ---- The moves (the same in the cloud, src/cloud/bonds.ts, as in the demo): the fields each one writes.

export function meldStart(d: BondDoc, day: string): Partial<BondDoc> {
  if (d.meld && d.meld.day === day) throw new Error('Today’s Mind Meld is already on.');
  return { meld: { id: (d.meld?.id ?? 0) + 1, day, cards: meldCards(), round: 1, words: {}, done: false, won: 0 } };
}

export function meldSay(d: BondDoc, uid: string, friend: string, raw: string): Partial<BondDoc> {
  const g = d.meld;
  if (!g || g.done) throw new Error('No Mind Meld on: start one.');
  const word = normWord(raw);
  if (!word) throw new Error('Write a word.');
  const mine = `${g.round}_${uid}`;
  if (g.words[mine]) throw new Error('You already wrote your word for this round.');
  const theirs = g.words[`${g.round}_${friend}`];
  const words = { ...g.words, [mine]: word };
  if (theirs === undefined) return { meld: { ...g, words } };
  if (theirs === word) {
    const won = meldPoints(g.round);
    return { meld: { ...g, words, done: true, won }, extra: (d.extra ?? 0) + won };
  }
  return { meld: g.round < MELD.rounds ? { ...g, words, round: g.round + 1 } : { ...g, words, done: true } };
}

export function eggLay(d: BondDoc, day: string): Partial<BondDoc> {
  if (d.egg && !d.egg.hatched) throw new Error('Your egg hasn’t hatched yet.');
  return { egg: newEgg(day), pets: d.egg ? [...(d.pets ?? []), d.egg] : (d.pets ?? []) };
}

export function eggTend(d: BondDoc, uid: string, friend: string, action: string, day: string): Partial<BondDoc> {
  const e = d.egg;
  if (!e || e.hatched) throw new Error('No egg to tend: lay one.');
  if (!ACTION_BY_ID.has(action)) throw new Error('Pick something to do.');
  const key = `${day}_${uid}`;
  if (e.acts[key]) throw new Error('You already tended it today.');
  const theirs = e.acts[`${day}_${friend}`];
  const days = e.days + (theirs ? 1 : 0);
  const hatched = days >= EGG.days;
  const egg: Egg = { ...e, acts: { ...e.acts, [key]: action }, last: key, days, stats: tendStats(e.stats, action, theirs), hatched };
  return { egg, extra: (d.extra ?? 0) + tendPoints(action, theirs, hatched) };
}
