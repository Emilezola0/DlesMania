// Expedition, the roguelike: a run is a branching map of rooms, each a short challenge borrowed
// from the other games. Hearts, gold and relics carry from room to room; out of hearts, the run ends.
// The run is plain data (saved in the store), so a refresh doesn't lose it.
import { mulberry32 } from '../lib/rng';
import type { Domain } from '../types';
import { ALL_KEYS, ALL_ROOMS, challengesFor, keysFor, mediaOfKeys } from './pools';

export type RelicId = 'hourglass' | 'lantern' | 'secondwind' | 'loupe' | 'vitality' | 'greedy' | 'luckycoin' | 'bandage';

export const RELICS: Record<RelicId, { icon: string; name: string; blurb: string; price: number }> = {
  hourglass: { icon: '⏳', name: 'Hourglass', blurb: '+5 s on every timer.', price: 45 },
  lantern: { icon: '🏮', name: 'Lantern', blurb: 'Naming rooms show the first letter of the answer.', price: 50 },
  secondwind: { icon: '🌬️', name: 'Second wind', blurb: 'Your first mistake in each room is forgiven.', price: 60 },
  loupe: { icon: '🔍', name: 'Loupe', blurb: 'Blurred pictures are half as blurred.', price: 35 },
  vitality: { icon: '❤️', name: 'Vitality', blurb: 'One more heart, and a heart back now.', price: 50 },
  greedy: { icon: '💰', name: 'Greed', blurb: 'Double gold from rooms — but one heart less.', price: 30 },
  luckycoin: { icon: '🪙', name: 'Lucky coin', blurb: '+5 gold for every room won.', price: 35 },
  bandage: { icon: '🩹', name: 'Bandage', blurb: 'Heal a heart after each boss.', price: 40 },
};

export type ChallengeKind = 'portrait' | 'higherlower' | 'odd' | 'whoami' | 'sort' | 'name5';
export type NodeKind = 'fight' | 'elite' | 'shop' | 'rest' | 'event' | 'boss';

export interface MapNode {
  id: string;
  row: number;
  col: number;
  kind: NodeKind;
  /** For fights and elites: which challenge. */
  challenge?: ChallengeKind;
  /** Nodes in the next row this one leads to. */
  next: string[];
}

export interface RunState {
  seed: number;
  act: number;
  hearts: number;
  maxHearts: number;
  gold: number;
  relics: RelicId[];
  map: MapNode[];
  /** Where the player stands (null: before the first row). */
  at: string | null;
  /** Rooms won so far, all acts. */
  cleared: number;
  /** Last room's outcome, shown on the map. */
  log: string[];
  over: boolean;
  won: boolean;
  /** The kinds of work the rooms draw from (runs saved before the choice existed: all of them). */
  media?: Domain[];
  /** The franchises the rooms draw from (runs saved before: every franchise of `media`). */
  picks?: string[];
  /** The kinds of room the map is made of (runs saved before: all of them). */
  rooms?: ChallengeKind[];
}

export const ACTS = 2;
export const ROWS = 6;
export const START_HEARTS = 3;
export const MAX_HEARTS_CAP = 6;

export const NODE_INFO: Record<NodeKind, { icon: string; name: string }> = {
  fight: { icon: '⚔️', name: 'Challenge' },
  elite: { icon: '💀', name: 'Elite' },
  shop: { icon: '🛒', name: 'Shop' },
  rest: { icon: '🔥', name: 'Campfire' },
  event: { icon: '❓', name: 'Gamble' },
  boss: { icon: '👑', name: 'Boss' },
};

/** `rule` and `elite` match the limits in src/rogue/Rooms.tsx. */
export const CHALLENGE_INFO: Record<ChallengeKind, { icon: string; name: string; rule: string; elite: string }> = {
  portrait: { icon: '🌫️', name: 'Blurred portrait', rule: 'Name the character from a blurred, black-and-white picture: 3 tries, 22 s.', elite: '2 tries, 15 s, and more blur.' },
  higherlower: { icon: '↕️', name: 'Higher or Lower', rule: 'Call 3 in a row right — bounties, release years, box office… One wrong call loses the room.', elite: '5 calls in a row.' },
  odd: { icon: '🧩', name: 'Odd One Out', rule: "Five cards, four share a link: spot the one that doesn't belong.", elite: 'Two rounds in a row.' },
  whoami: { icon: '🕵️', name: 'Who Am I?', rule: 'Name the character from clues, up to 4 of them.', elite: 'Only 3 clues.' },
  sort: { icon: '↔️', name: 'Quick Sort', rule: 'Sort 10 cards left or right, 3 s each, without a mistake.', elite: '15 cards, 2 s each.' },
  name5: { icon: '📝', name: 'Name them', rule: 'Name 5 from a list in 50 s.', elite: '7 names in 45 s.' },
};

/**
 * One act's map: ROWS rows of 2–3 rooms, each leading to the rooms just below it, then the boss.
 * The first row is all challenges, the row before the boss a campfire; elites only from row 2.
 */
export function makeMap(act: number, seed: number, picks: string[] = ALL_KEYS, rooms: ChallengeKind[] = ALL_ROOMS): MapNode[] {
  const CHALLENGES = challengesFor(picks, rooms);
  const rand = mulberry32(seed * 31 + act);
  const rows: MapNode[][] = [];
  for (let r = 0; r < ROWS; r++) {
    const width = 2 + Math.floor(rand() * 2);
    rows.push(
      Array.from({ length: width }, (_, c) => {
        let kind: NodeKind = 'fight';
        const x = rand();
        if (r === ROWS - 1) kind = 'rest';
        else if (r > 0) kind = x < 0.5 ? 'fight' : x < 0.66 && r >= 2 ? 'elite' : x < 0.78 ? 'shop' : x < 0.9 ? 'event' : r >= 2 ? 'rest' : 'fight';
        const challenge = kind === 'fight' || kind === 'elite' ? CHALLENGES[Math.floor(rand() * CHALLENGES.length)] : undefined;
        return { id: `a${act}r${r}c${c}`, row: r, col: c, kind, challenge, next: [] };
      }),
    );
  }
  const boss: MapNode = { id: `a${act}boss`, row: ROWS, col: 0, kind: 'boss', next: [] };
  // Links: each room to the rooms below it that are close in position (as a fraction across the row).
  for (let r = 0; r < ROWS; r++) {
    const here = rows[r];
    const below = r + 1 < ROWS ? rows[r + 1] : [boss];
    here.forEach((n, i) => {
      const pos = here.length === 1 ? 0.5 : i / (here.length - 1);
      const near = below.filter((_, j) => Math.abs((below.length === 1 ? 0.5 : j / (below.length - 1)) - pos) <= 0.55);
      n.next = (near.length ? near : [below[Math.round(pos * (below.length - 1))]]).map((x) => x.id);
    });
    // Every room below must be reachable.
    below.forEach((b, j) => {
      if (!here.some((n) => n.next.includes(b.id))) here[Math.round((j / Math.max(1, below.length - 1)) * (here.length - 1))].next.push(b.id);
    });
  }
  return [...rows.flat(), boss];
}

export function newRun(picks: string[] = ALL_KEYS, rooms: ChallengeKind[] = ALL_ROOMS, seed = Math.floor(Math.random() * 1e9)): RunState {
  const media = mediaOfKeys(picks);
  return { seed, act: 1, hearts: START_HEARTS, maxHearts: START_HEARTS, gold: 0, relics: [], map: makeMap(1, seed, picks, rooms), at: null, cleared: 0, log: [], over: false, won: false, media, picks, rooms };
}

export const mediaOf = (run: RunState) => (run.media?.length ? run.media : mediaOfKeys(ALL_KEYS));
export const picksOf = (run: RunState) => (run.picks?.length ? run.picks : keysFor(mediaOf(run)));
export const roomsOf = (run: RunState) => (run.rooms?.length ? run.rooms : ALL_ROOMS);

/** Rooms the player can enter now. */
export function reachable(run: RunState): MapNode[] {
  if (!run.at) return run.map.filter((n) => n.row === 0);
  const here = run.map.find((n) => n.id === run.at)!;
  return run.map.filter((n) => here.next.includes(n.id));
}

export const has = (run: RunState, r: RelicId) => run.relics.includes(r);

/** What a room on the map is, for its hover card: what you'll face, what you can win, what you can lose. */
export function describeNode(run: RunState, n: MapNode, heartPrice: number, restGold: number): { title: string; body: string[]; win?: string; lose?: string } {
  const c = n.challenge && CHALLENGE_INFO[n.challenge];
  switch (n.kind) {
    case 'fight':
      return { title: c!.name, body: [c!.rule], win: `🪙 ${goldFor(run, 'fight', false)} (+5 if flawless)`, lose: '❤ −1' };
    case 'elite':
      return { title: `Elite · ${c!.name}`, body: [c!.rule, `Elite: ${c!.elite}`], win: `🪙 ${goldFor(run, 'elite', false)} and a relic of your choice`, lose: '❤ −1' };
    case 'shop':
      return { title: 'Shop', body: [`Spend your gold on relics, or a heart for 🪙 ${heartPrice}.`] };
    case 'rest':
      return { title: 'Campfire', body: [`Rest to heal a heart, or search the camp for 🪙 ${restGold}.`] };
    case 'event':
      return { title: 'Gamble', body: ["A stranger's wager: beat an elite challenge of their choosing — or walk away."], win: 'A relic of your choice', lose: '❤ −1' };
    case 'boss':
      return {
        title: `Act ${run.act} boss`,
        body: [
          run.act === 1 ? "A guardian's Knowledge Blitz: name as many answers as you can against the clock." : "A guardian's Final Blow: name the faces before time runs out.",
          'A boss must be beaten: lose and you face it again.',
        ],
        win: `🪙 ${goldFor(run, 'boss', false)}${run.act < ACTS ? ', a relic, and the next act' : ' and the expedition'}`,
        lose: '❤ −2',
      };
  }
}

/** Gold for winning a room. */
export function goldFor(run: RunState, kind: NodeKind, perfect: boolean): number {
  const base = kind === 'boss' ? 50 : kind === 'elite' ? 25 : 12;
  return (base + (perfect ? 5 : 0) + (has(run, 'luckycoin') ? 5 : 0)) * (has(run, 'greedy') ? 2 : 1);
}

/** What a room's challenge allows, with the relics applied. */
export interface Mods {
  bonusSeconds: number;
  lantern: boolean;
  forgive: number;
  loupe: boolean;
  /** Elites: tighter limits. */
  hard: boolean;
  /** The franchises to draw from. */
  keys: string[];
  /** How far into the run this room is, 0 (first row of act 1) to 1 (last row of the last act): rooms get harder. */
  depth: number;
}

export const modsFor = (run: RunState, hard: boolean): Mods => ({
  bonusSeconds: has(run, 'hourglass') ? 5 : 0,
  lantern: has(run, 'lantern'),
  forgive: has(run, 'secondwind') ? 1 : 0,
  loupe: has(run, 'loupe'),
  hard,
  keys: picksOf(run),
  depth: depthOf(run),
});

function depthOf(run: RunState): number {
  const row = run.map.find((n) => n.id === run.at)?.row ?? 0;
  return Math.min(1, ((run.act - 1) * ROWS + Math.min(row, ROWS - 1)) / (ACTS * ROWS - 1));
}

/** A relic's effect on taking it (most work through `Mods` instead). */
export function takeRelic(run: RunState, r: RelicId): RunState {
  const next = { ...run, relics: [...run.relics, r] };
  if (r === 'vitality') {
    next.maxHearts = Math.min(MAX_HEARTS_CAP, next.maxHearts + 1);
    next.hearts = Math.min(next.maxHearts, next.hearts + 1);
  }
  if (r === 'greedy') {
    next.maxHearts = Math.max(1, next.maxHearts - 1);
    next.hearts = Math.min(next.hearts, next.maxHearts);
  }
  return next;
}

/** Three relics the player doesn't have yet (fewer when few are left). */
export function relicOffer(run: RunState, rand: () => number = Math.random): RelicId[] {
  const left = (Object.keys(RELICS) as RelicId[]).filter((r) => !run.relics.includes(r));
  const out: RelicId[] = [];
  while (out.length < 3 && left.length) out.push(left.splice(Math.floor(rand() * left.length), 1)[0]);
  return out;
}

/** The score a run is remembered by: rooms won and gold kept, a lot more for a full clear. */
export const runScore = (run: RunState) => run.cleared * 10 + run.gold + (run.won ? 200 : 0);
