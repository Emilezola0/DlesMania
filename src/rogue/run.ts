// Expedition, the roguelike: a run is a branching map of rooms, each a short challenge borrowed
// from the other games. Hearts, gold and relics carry from room to room; out of hearts, the run ends.
// The run is plain data (saved in the store), so a refresh doesn't lose it.
import { mulberry32 } from '../lib/rng';
import type { Domain } from '../types';
import { ALL_MEDIA, challengesFor } from './pools';

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

export const CHALLENGE_INFO: Record<ChallengeKind, { icon: string; name: string }> = {
  portrait: { icon: '🌫️', name: 'Blurred portrait' },
  higherlower: { icon: '↕️', name: 'Higher or Lower' },
  odd: { icon: '🧩', name: 'Odd One Out' },
  whoami: { icon: '🕵️', name: 'Who Am I?' },
  sort: { icon: '↔️', name: 'Quick Sort' },
  name5: { icon: '📝', name: 'Name them' },
};

/**
 * One act's map: ROWS rows of 2–3 rooms, each leading to the rooms just below it, then the boss.
 * The first row is all challenges, the row before the boss a campfire; elites only from row 2.
 */
export function makeMap(act: number, seed: number, media: Domain[] = ALL_MEDIA): MapNode[] {
  const CHALLENGES = challengesFor(media);
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

export function newRun(media: Domain[] = ALL_MEDIA, seed = Math.floor(Math.random() * 1e9)): RunState {
  return { seed, act: 1, hearts: START_HEARTS, maxHearts: START_HEARTS, gold: 0, relics: [], map: makeMap(1, seed, media), at: null, cleared: 0, log: [], over: false, won: false, media };
}

export const mediaOf = (run: RunState) => (run.media?.length ? run.media : ALL_MEDIA);

/** Rooms the player can enter now. */
export function reachable(run: RunState): MapNode[] {
  if (!run.at) return run.map.filter((n) => n.row === 0);
  const here = run.map.find((n) => n.id === run.at)!;
  return run.map.filter((n) => here.next.includes(n.id));
}

export const has = (run: RunState, r: RelicId) => run.relics.includes(r);

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
  /** The kinds of work to draw from. */
  media: Domain[];
}

export const modsFor = (run: RunState, hard: boolean): Mods => ({
  bonusSeconds: has(run, 'hourglass') ? 5 : 0,
  lantern: has(run, 'lantern'),
  forgive: has(run, 'secondwind') ? 1 : 0,
  loupe: has(run, 'loupe'),
  hard,
  media: mediaOf(run),
});

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
