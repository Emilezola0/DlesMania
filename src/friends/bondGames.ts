// The two Bond games (Friends → Bond), played by the two friends of a Bond, each giving the Bond points on top of its
// day-together points (src/cloud/bonds.ts `extra`). The numbers here are in firestore.rules too (meldRounds(),
// meldPoints(), eggDays(), eggPair(), eggHatch()): change both.
//   Mind Meld: two cards; each of you writes, unseen, one word that links them. The same word: a Meld, points (more the
//   sooner). Not the same: next round, link the two words you wrote, and so on, up to MELD.rounds. One game a day.
//   Bond Egg: an egg you raise together. Each day each of you does one thing for it (train, play, teach, cuddle);
//   two different things the same day are teamwork (a point). After EGG.days days you both tended it, it hatches,
//   into a creature shaped by how you raised it (more points). Then keep the pet alive together: each day it needs one
//   thing from each of you, and each sees only what the OTHER must do (tell each other!). Happy days give more points;
//   at 0 hearts it dies, and joins the Bond's past pets; then a new egg.
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
  /** Once hatched, the pet: the day it hatched, what each did for it each day ("<day>_<uid>": a PET_ACTIONS id), and
   *  what each told the other to do ("<day>_<uid>": the friend's need, said by uid). */
  hatchedOn?: string;
  care?: Record<string, string>;
  told?: Record<string, string>;
  /** The last tell's key ("<day>_<uid>"), so the rules can check it. */
  said?: string;
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
  id: string;
  name: string;
  fr: string;
  icon: string;
  color: string;
  blurb: string;
}
const pet = (id: string, name: string, fr: string, icon: string, color: string, blurb: string): Pet => ({ id, name, fr, icon, color, blurb });
/** The creatures an egg can hatch into: one per stat raised most, one per two stats raised together, and the rare ones. */
export const PETS: Pet[] = [
  pet('drake', 'Ember Drake', 'Drakon de braise', '🐉', '#f97316', 'Raised on training: small, proud, and breathing sparks.'),
  pet('fox', 'Sunny Fox', 'Renard soleil', '🦊', '#facc15', 'Raised on games: it never stops bouncing.'),
  pet('owl', 'Owl Sage', 'Hibou sage', '🦉', '#818cf8', 'Raised on lessons: it already knows every daily answer.'),
  pet('bunny', 'Moon Bunny', 'Lapin de lune', '🐰', '#f0abfc', 'Raised on cuddles: soft, sleepy, and glowing faintly.'),
  pet('tiger', 'Thunder Cub', 'Tigreau tonnerre', '🐯', '#fb923c', 'Training and games: it pounces on everything, roaring like a storm.'),
  pet('rhino', 'Rune Rhino', 'Rhino runique', '🦏', '#a78bfa', 'Training and lessons: strong, stubborn, and covered in glowing runes.'),
  pet('turtle', 'Stone Turtle', 'Tortue de pierre', '🐢', '#4ade80', 'Training and cuddles: slow, steady, and impossible to tip over.'),
  pet('monkey', 'Mischief Monkey', 'Singe farceur', '🐒', '#fbbf24', 'Games and lessons: too clever, and always up to something.'),
  pet('sheep', 'Cloud Sheep', 'Mouton nuage', '🐑', '#e0f2fe', 'Games and cuddles: a fluffy cloud that floats when it is happy.'),
  pet('octopus', 'Ink Octopus', 'Pieuvre d’encre', '🐙', '#c084fc', 'Lessons and cuddles: a dreamy thinker writing poems in ink.'),
  pet('phoenix', 'Prism Phoenix', 'Phénix prisme', '🦚', '#5eead4', 'Raised on a bit of everything: every colour at once. Rare.'),
  pet('whale', 'Star Whale', 'Baleine étoilée', '🐋', '#60a5fa', 'Raised in perfect teamwork, every single day: it swims through the stars. The rarest.'),
];
export const PET_BY_ID = new Map(PETS.map((p) => [p.id, p]));
const SOLO: Record<EggStat, string> = { str: 'drake', joy: 'fox', wit: 'owl', calm: 'bunny' };
const DUO: Record<string, string> = { 'joy+str': 'tiger', 'str+wit': 'rhino', 'calm+str': 'turtle', 'joy+wit': 'monkey', 'calm+joy': 'sheep', 'calm+wit': 'octopus' };

/** Days of teamwork (both tended it, two different things). */
export function teamworkDays(e: Pick<Egg, 'acts'>): number {
  const byDay = new Map<string, string[]>();
  for (const [k, a] of Object.entries(e.acts)) {
    const day = k.split('_')[0];
    byDay.set(day, [...(byDay.get(day) ?? []), a]);
  }
  return [...byDay.values()].filter((a) => a.length === 2 && a[0] !== a[1]).length;
}

/**
 * What an egg hatches into: Star Whale when every day was teamwork; Prism Phoenix when all four stats are close; the
 * stat raised most alone when it's well ahead; else the two raised most, together.
 */
export function petOf(e: Pick<Egg, 'stats' | 'acts'>): Pet {
  const s = e.stats;
  if (teamworkDays(e) >= EGG.days) return PET_BY_ID.get('whale')!;
  const vals = Object.values(s);
  if (Math.max(...vals) - Math.min(...vals) <= 4) return PET_BY_ID.get('phoenix')!;
  const [a, b] = (Object.keys(s) as EggStat[]).sort((x, y) => s[y] - s[x]);
  if (s[a] - s[b] >= 6) return PET_BY_ID.get(SOLO[a])!;
  return PET_BY_ID.get(DUO[[a, b].sort().join('+')])!;
}

/** How far along it is: 0 a smooth egg, 1 cracks, 2 big cracks and a glow, 3 hatched. */
export const eggStage = (e: Pick<Egg, 'days' | 'hatched'>) => (e.hatched ? 3 : e.days >= EGG.days - 2 ? 2 : e.days >= EGG.days / 2 - 1 ? 1 : 0);

// ---- The pet, once hatched: keep it alive together.
//   Each day it needs one thing from each of you, but each of you sees only what it needs from the OTHER: tell your
//   friend (the 📣 button, or any chat). Both right: a happy day (+1 heart, PET.points). Each wrong or missed one: −1
//   heart. At 0 hearts it dies; then a new egg.

export const PET_ACTIONS = [
  { id: 'feed', icon: '🍖', label: 'Feed', fr: 'Nourrir' },
  { id: 'play', icon: '🎾', label: 'Play', fr: 'Jouer' },
  { id: 'wash', icon: '🛁', label: 'Wash', fr: 'Laver' },
  { id: 'cuddle', icon: '🤗', label: 'Cuddle', fr: 'Câliner' },
  { id: 'rest', icon: '🌙', label: 'Put to bed', fr: 'Coucher' },
];
export const PET_ACTION_BY_ID = new Map(PET_ACTIONS.map((a) => [a.id, a]));

export const PET = {
  /** Hearts it hatches with, and the most it can have. */
  hearts: 3,
  max: 5,
  /** Points for a happy day (both did what it needed). */
  points: 3,
};

/** A string's hash (FNV-1a): the same on both friends' devices. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** What the pet needs from this player on this day (the same on both devices: from the Bond, the day and the player). */
export const petNeed = (bond: string, born: string, day: string, uid: string) => PET_ACTIONS[hash(`${bond}|${born}|${day}|${uid}`) % PET_ACTIONS.length].id;

function dayBefore(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** The days after `from` up to `to` (both "YYYY-MM-DD"), `from` left out. */
function daysAfter(from: string, to: string): string[] {
  const out: string[] = [];
  const d = new Date(`${from}T12:00:00Z`);
  for (let k = 0; k < 4000; k++) {
    d.setUTCDate(d.getUTCDate() + 1);
    const key = d.toISOString().slice(0, 10);
    if (key > to) break;
    out.push(key);
  }
  return out;
}

export interface PetLife {
  hearts: number;
  dead: boolean;
  /** The day it died, if it did. */
  diedOn?: string;
  /** Days it lived through (since hatching), and the happy ones. */
  lived: number;
  happy: number;
  /** Yesterday's outcome, for the page: both right, someone wrong or missed. */
  last?: { day: string; mine: boolean; theirs: boolean };
}

/**
 * The pet's life, worked out from what each of you did each day since it hatched (nothing stored but the acts): the
 * day it hatched doesn't count; a day before today counts as it is (a missed act is a wrong one); today counts once
 * you both did something.
 */
export function petLife(e: Egg, bond: string, me: string, friend: string, today: string): PetLife {
  const care = e.care ?? {};
  // A pet hatched before pets needed care (no hatchedOn) starts its life the day before its first care, or today.
  const first = Object.keys(care).map((k) => k.split('_')[0]).sort()[0] ?? today;
  const from = e.hatchedOn ?? dayBefore(first);
  let hearts = PET.hearts;
  let lived = 0;
  let happy = 0;
  let last: PetLife['last'];
  for (const day of daysAfter(from, today)) {
    const a = care[`${day}_${me}`];
    const b = care[`${day}_${friend}`];
    if (day === today && !(a && b)) break;
    const okA = a === petNeed(bond, e.born, day, me);
    const okB = b === petNeed(bond, e.born, day, friend);
    lived++;
    if (okA && okB) {
      happy++;
      hearts = Math.min(PET.max, hearts + 1);
    } else hearts -= (okA ? 0 : 1) + (okB ? 0 : 1);
    last = { day, mine: okA, theirs: okB };
    if (hearts <= 0) return { hearts: 0, dead: true, diedOn: day, lived, happy, last };
  }
  return { hearts, dead: false, lived, happy, last };
}

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
  // (A pet still alive can be let go too: the page only offers it once the pet has died.)
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
  const egg: Egg = { ...e, acts: { ...e.acts, [key]: action }, last: key, days, stats: tendStats(e.stats, action, theirs), hatched, ...(hatched ? { hatchedOn: day, care: {}, told: {} } : {}) };
  return { egg, extra: (d.extra ?? 0) + tendPoints(action, theirs, hatched) };
}

/** Today's care for the pet, one thing each: a happy day (both did what it needed) gives PET.points. */
export function petCare(d: BondDoc, uid: string, friend: string, action: string, day: string): Partial<BondDoc> {
  const e = d.egg;
  if (!e?.hatched) throw new Error('No pet yet: hatch your egg first.');
  if (!PET_ACTION_BY_ID.has(action)) throw new Error('Pick something to do.');
  const bond = `${d.a}_${d.b}`;
  if (petLife(e, bond, uid, friend, day).dead) throw new Error('Your pet is gone: lay a new egg.');
  const care = e.care ?? {};
  const key = `${day}_${uid}`;
  if (care[key]) throw new Error('You already took care of it today.');
  const theirs = care[`${day}_${friend}`];
  const happy = !!theirs && action === petNeed(bond, e.born, day, uid) && theirs === petNeed(bond, e.born, day, friend);
  return { egg: { ...e, care: { ...care, [key]: action }, last: key }, extra: (d.extra ?? 0) + (happy ? PET.points : 0) };
}

/** Tells the friend what the pet needs from them today (once a day). */
export function petTell(d: BondDoc, uid: string, friend: string, day: string): Partial<BondDoc> {
  const e = d.egg;
  if (!e?.hatched) throw new Error('No pet yet.');
  const told = e.told ?? {};
  const key = `${day}_${uid}`;
  if (told[key]) throw new Error('You already told them.');
  return { egg: { ...e, told: { ...told, [key]: petNeed(`${d.a}_${d.b}`, e.born, day, friend) }, said: key } };
}
