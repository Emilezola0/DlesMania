// The Defence Deck's battle (Friends → Defence Deck), with no imports so scripts/defence-sim.mjs can run it as is.
// Two teams of five cards, each in its order, within a points budget. Their first cards duel; the loser is out, the
// winner stays (a little tired) and meets the other side's next card. A team with no card left loses.
// A duel: the higher power wins (equal power, both are out); a card with the element's edge over the other gets
// DEFENCE.edge power for that duel. Before EDGE_FROM, the element alone decided (a weakness beat any power).
// Characters fight; a technique hits the card it meets as it arrives; a place, once out, lifts every card after it.
// An Altered card's anomaly gives it a twist. Each day an arena rule changes something for everyone.

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic' | 'omni';
export type Element = 'water' | 'air' | 'fire' | 'earth' | 'light' | 'darkness';
export type Kind = 'fighter' | 'technique' | 'place';
export type Anomaly = 'corrupted' | 'fake' | 'inverted' | 'mirror' | 'timelost' | 'void';

export const DEFENCE = {
  /** Cards in a team, and the points they may cost together. */
  size: 5,
  budget: 18,
  cost: { common: 1, rare: 2, epic: 3, legendary: 5, mythic: 6, omni: 7 } as Record<Rarity, number>,
  power: { common: 10, rare: 13, epic: 16, legendary: 20, mythic: 23, omni: 26 } as Record<Rarity, number>,
  /** Power for every two grades above the first (grades go to 8: +3 at most). */
  perGrade: 1,
  /** The defence fights at home: each of its cards gets this. */
  home: 1,
  /** Light shines: Light cards get this. */
  light: 0,
  /** Every two points of the budget left unspent: each card of the team gets this. */
  spare: 1,
  /** A time-lost card back from its slip is this much weaker. */
  timelost: 3,
  /** Three cards or more of one franchise: each of them gets this. */
  crew: 1,
  crewSize: 3,
  /** A technique's hit on the card it meets; a technique's and a place's own power, less than a character's. */
  techniqueHit: 4,
  kindMalus: 3,
  /** What each of a team's places lifts the cards after it, once it is out. */
  placeLift: 2,
  /** A card whose element beats the other's gets this much power for that duel. */
  edge: 6,
  /** A winner stays, this much weaker for each duel it has won. */
  fatigue: 2,
  /** What a battle pays: the attacker for a win, the defender for each attack held off. */
  win: 600,
  held: 150,
  /** Attacks a day (each on another friend). */
  attacksPerDay: 3,
};

/** The four basic elements beat each other round a circle. Light beats Fire, Air and Darkness, and falls to Earth and
 *  Water; Darkness falls only to Light. */
export const BASIC: Element[] = ['fire', 'air', 'earth', 'water'];
const CIRCLE: Record<string, Element> = { fire: 'air', air: 'earth', earth: 'water', water: 'fire' };
export const LIGHT_WEAK: Element[] = ['earth', 'water'];
export const LIGHT_BEATS: Element[] = ['fire', 'air'];
export function beats(a: Element, b: Element): boolean {
  if (CIRCLE[a] === b) return true;
  if (b === 'light' && LIGHT_WEAK.includes(a)) return true;
  if (a === 'light' && LIGHT_BEATS.includes(b)) return true;
  return a === 'light' && b === 'darkness';
}

/** A card as it fights: what it is, never whose. */
export interface Fighter {
  id: string;
  set: string;
  rarity: Rarity;
  element: Element;
  kind: Kind;
  grade: number;
  anomaly: Anomaly | null;
}

/** The day's arena rule (the same for everyone): see ARENAS. */
export interface Arena {
  id: string;
  name: string;
  icon: string;
  text: string;
  /** Power for cards of this element / this rarity. */
  element?: Element;
  rarity?: Rarity;
  bonus?: number;
  /** Places lift twice as much; techniques hit twice as hard; no tiredness; Darkness falls to every basic element; a stronger crew. */
  placesDouble?: boolean;
  techniquesDouble?: boolean;
  noFatigue?: boolean;
  darkExposed?: boolean;
  crew?: number;
  /** A card meeting a pricier one gets this. */
  underdog?: number;
}

export const ARENAS: Arena[] = [
  { id: 'fire', name: 'Volcano', icon: '🌋', text: 'Fire cards +3 power.', element: 'fire', bonus: 3 },
  { id: 'water', name: 'Tidal Reef', icon: '🌊', text: 'Water cards +3 power.', element: 'water', bonus: 3 },
  { id: 'air', name: 'Sky Temple', icon: '🌪️', text: 'Air cards +3 power.', element: 'air', bonus: 3 },
  { id: 'earth', name: 'Canyon', icon: '⛰️', text: 'Earth cards +3 power.', element: 'earth', bonus: 3 },
  { id: 'light', name: 'Cathedral', icon: '☀️', text: 'Light cards +4 power.', element: 'light', bonus: 4 },
  { id: 'eclipse', name: 'Eclipse', icon: '🌑', text: 'Darkness falls to every basic element today.', darkExposed: true },
  { id: 'commons', name: 'Street Brawl', icon: '🥊', text: 'Commons +4 power.', rarity: 'common', bonus: 4 },
  { id: 'rares', name: 'Tournament', icon: '🏟️', text: 'Rares +3 power.', rarity: 'rare', bonus: 3 },
  { id: 'underdog', name: 'Underdog Day', icon: '🐕', text: 'A card meeting a pricier one gets +3 power.', underdog: 3 },
  { id: 'places', name: 'Home Ground', icon: '🏰', text: 'Places lift twice as much.', placesDouble: true },
  { id: 'techniques', name: 'Dojo', icon: '🥋', text: 'Techniques hit twice as hard.', techniquesDouble: true },
  { id: 'endurance', name: 'Second Wind', icon: '💨', text: 'Winners never tire.', noFatigue: true },
  { id: 'crew', name: 'Reunion', icon: '🤝', text: 'Three of one franchise: +3 each instead of +1.', crew: 3 },
];

/** A day's arena: the same for everyone (a hash of the day). */
export function arenaOf(day: string): Arena {
  let h = 2166136261;
  for (const ch of `arena:${day}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return ARENAS[(h >>> 0) % ARENAS.length];
}

export const costOf = (team: { rarity: Rarity }[]) => team.reduce((n, c) => n + DEFENCE.cost[c.rarity], 0);
export const teamOk = (team: { rarity: Rarity; id: string }[]) => team.length === DEFENCE.size && costOf(team) <= DEFENCE.budget && new Set(team.map((c) => c.id)).size === team.length;

/** The day the element became a power bonus (DEFENCE.edge) instead of a sure win: battles of earlier days replay as they were. */
export const EDGE_FROM = '2026-11-12';

/** What a card's power in a duel is made of, piece by piece (shown as its power bar). */
export type PartKey = 'rarity' | 'grade' | 'kind' | 'crew' | 'light' | 'spare' | 'arena' | 'home' | 'lift' | 'hit' | 'fatigue' | 'timelost' | 'underdog' | 'edge';
export type Part = [PartKey, number];
export const sumParts = (parts: Part[]) => parts.reduce((n, [, v]) => n + v, 0);

/** A card's power before the battle's own changes, piece by piece: rarity, grade, kind, crew, unspent points, arena. */
export function powerParts(c: Fighter, team: Fighter[], arena: Arena): Part[] {
  const parts: Part[] = [['rarity', DEFENCE.power[c.rarity]]];
  const add = (k: PartKey, v: number) => {
    if (v) parts.push([k, v]);
  };
  add('grade', DEFENCE.perGrade * Math.floor(Math.max(0, Math.min(7, c.grade - 1)) / 2));
  if (c.kind !== 'fighter') add('kind', -DEFENCE.kindMalus);
  if (team.filter((t) => t.set === c.set).length >= DEFENCE.crewSize) add('crew', arena.crew ?? DEFENCE.crew);
  if (c.element === 'light') add('light', DEFENCE.light);
  // Unspent points count once the team is whole (not while it's being made).
  if (team.length === DEFENCE.size) add('spare', DEFENCE.spare * Math.floor(Math.max(0, DEFENCE.budget - costOf(team)) / 2));
  if ((arena.element && arena.element === c.element) || (arena.rarity && arena.rarity === c.rarity)) add('arena', arena.bonus ?? 0);
  return parts;
}

/** A card's power before the battle's own changes. */
export const basePower = (c: Fighter, team: Fighter[], arena: Arena) => sumParts(powerParts(c, team, arena));

export type Side = 'a' | 'd';
export type Reason = 'element' | 'power' | 'tie';
export type BattleEvent =
  | { t: 'enter'; side: Side; i: number }
  | { t: 'technique'; side: Side; i: number; hit: number }
  | { t: 'element'; side: Side; i: number; element: Element; why: 'mirror' | 'corrupted' }
  | {
      t: 'duel';
      a: number;
      d: number;
      /** Each card's power this duel, the element's edge included, and what it's made of. */
      pa: number;
      pd: number;
      parts: Record<Side, Part[]>;
      ea: Element;
      ed: Element;
      /** The side with the element's edge (after an inverted card turned it over). */
      edge: Side | null;
      winner: Side | 'both';
      /** 'element': the edge alone decided (battles before EDGE_FROM). */
      reason: Reason;
      inverted?: boolean;
    }
  | { t: 'out'; side: Side; i: number }
  | { t: 'timelost'; side: Side; i: number }
  | { t: 'place'; side: Side; i: number; lift: number };

export interface Battle {
  winner: Side;
  /** Why the battle ended so: a side ran out, or both did and the cheaper team (or the defence, on a tie) won. */
  how: 'out' | 'cheaper' | 'defence';
  events: BattleEvent[];
}

/** A small, seeded random for the corrupted cards: the same battle always plays the same. */
function seeded(seed: string): () => number {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  let s = h >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The battle of an attacking team against a defence, both in their order. `seed` fixes the corrupted cards' luck (the
 * attacker, the defender and the day: the same attack always ends the same).
 */
export function fight(attack: Fighter[], defence: Fighter[], arena: Arena, seed: string, day?: string): Battle {
  const rand = seeded(seed);
  const oldRules = !!day && day < EDGE_FROM;
  const events: BattleEvent[] = [];
  const teams: Record<Side, Fighter[]> = { a: attack, d: defence };
  const base: Record<Side, Part[][]> = { a: attack.map((c) => powerParts(c, attack, arena)), d: defence.map((c) => [...powerParts(c, defence, arena), ['home', DEFENCE.home] as Part]) };
  const queue: Record<Side, number[]> = { a: attack.map((_, i) => i), d: defence.map((_, i) => i) };
  const lift: Record<Side, number> = { a: 0, d: 0 };
  const field: Record<Side, { i: number; wins: number; hit: number; fresh: boolean } | null> = { a: null, d: null };
  const timeUsed = new Set<string>();
  const other = (s: Side): Side => (s === 'a' ? 'd' : 'a');

  for (let guard = 0; guard < 40; guard++) {
    for (const s of ['a', 'd'] as Side[]) {
      if (!field[s] && queue[s].length) {
        const i = queue[s].shift()!;
        field[s] = { i, wins: 0, hit: 0, fresh: true };
        events.push({ t: 'enter', side: s, i });
      }
    }
    if (!field.a || !field.d) break;
    // Techniques strike as they arrive (the lower power first does not matter: each hits the other).
    for (const s of ['a', 'd'] as Side[]) {
      const f = field[s]!;
      if (f.fresh && teams[s][f.i].kind === 'technique') {
        const hit = DEFENCE.techniqueHit * (arena.techniquesDouble ? 2 : 1);
        field[other(s)]!.hit += hit;
        events.push({ t: 'technique', side: s, i: f.i, hit });
      }
    }
    field.a.fresh = false;
    field.d.fresh = false;

    const ca = teams.a[field.a.i];
    const cd = teams.d[field.d.i];
    // Elements, as they stand this duel (a mirror takes the other's; a corrupted card's changes every duel).
    const elementOf = (s: Side, c: Fighter, vs: Fighter): Element => {
      if (c.anomaly === 'mirror' && vs.anomaly !== 'mirror') {
        events.push({ t: 'element', side: s, i: field[s]!.i, element: vs.element, why: 'mirror' });
        return vs.element;
      }
      if (c.anomaly === 'corrupted') {
        const e = (['water', 'air', 'fire', 'earth', 'light', 'darkness'] as Element[])[Math.floor(rand() * 6)];
        events.push({ t: 'element', side: s, i: field[s]!.i, element: e, why: 'corrupted' });
        return e;
      }
      return c.element;
    };
    const ea = elementOf('a', ca, cd);
    const ed = elementOf('d', cd, ca);
    const wins = (x: Element, y: Element) => beats(x, y) || (!!arena.darkExposed && BASIC.includes(x) && y === 'darkness');
    let elementSide: Side | null = wins(ea, ed) ? 'a' : wins(ed, ea) ? 'd' : null;
    // An inverted card turns the element's verdict over in its duels (two of them cancel out).
    const inverted = (ca.anomaly === 'inverted') !== (cd.anomaly === 'inverted');
    if (elementSide && inverted) elementSide = other(elementSide);
    const partsOf = (s: Side, c: Fighter, vs: Fighter): Part[] => {
      const f = field[s]!;
      const parts = [...base[s][f.i]];
      const add = (k: PartKey, v: number) => {
        if (v) parts.push([k, v]);
      };
      add('lift', lift[s]);
      add('hit', -f.hit);
      add('fatigue', arena.noFatigue ? 0 : -DEFENCE.fatigue * f.wins);
      add('timelost', timeUsed.has(`${s}${f.i}`) ? -DEFENCE.timelost : 0);
      if (arena.underdog && DEFENCE.cost[c.rarity] < DEFENCE.cost[vs.rarity]) add('underdog', arena.underdog);
      if (!oldRules && elementSide === s) add('edge', DEFENCE.edge);
      return parts;
    };
    const parts = { a: partsOf('a', ca, cd), d: partsOf('d', cd, ca) };
    const pa = sumParts(parts.a);
    const pd = sumParts(parts.d);
    let winner: Side | 'both';
    let reason: Reason;
    if (oldRules && elementSide) {
      winner = elementSide;
      reason = 'element';
    } else if (pa !== pd) {
      winner = pa > pd ? 'a' : 'd';
      reason = 'power';
    } else {
      winner = 'both';
      reason = 'tie';
    }
    events.push({ t: 'duel', a: field.a.i, d: field.d.i, pa, pd, parts, ea, ed, edge: elementSide, winner, reason, inverted: inverted && elementSide ? true : undefined });

    for (const s of ['a', 'd'] as Side[]) {
      if (winner === s) {
        field[s]!.wins++;
        field[s]!.hit = 0;
        continue;
      }
      const f = field[s]!;
      const c = teams[s][f.i];
      field[s] = null;
      // A time-lost card slips away once, to the back of its team, instead of falling.
      if (c.anomaly === 'timelost' && !timeUsed.has(`${s}${f.i}`)) {
        timeUsed.add(`${s}${f.i}`);
        queue[s].push(f.i);
        events.push({ t: 'timelost', side: s, i: f.i });
        continue;
      }
      events.push({ t: 'out', side: s, i: f.i });
      if (c.kind === 'place') {
        const up = DEFENCE.placeLift * (arena.placesDouble ? 2 : 1);
        lift[s] += up;
        events.push({ t: 'place', side: s, i: f.i, lift: up });
      }
    }
  }

  const left = (s: Side) => (field[s] ? 1 : 0) + queue[s].length;
  if (left('a') && !left('d')) return { winner: 'a', how: 'out', events };
  if (left('d') && !left('a')) return { winner: 'd', how: 'out', events };
  // Both out at once: the cheaper team; the defence if they cost the same.
  const ca = costOf(attack);
  const cd = costOf(defence);
  if (ca !== cd) return { winner: ca < cd ? 'a' : 'd', how: 'cheaper', events };
  return { winner: 'd', how: 'defence', events };
}
