// Genesis, the rarity above Omni: one card per franchise (GENESIS_CARDS in src/gacha/cards.ts), never in a pack,
// only ever forged by a ritual that can't be bought or rushed:
//   1. the whole set collected, and its guardian beaten on Hard (its Omnis awake);
//   2. an offering: a spare copy of one of the set's Omnis, and star shards (one per star a black hole swallowed);
//   3. the dawns: from that day, DAWNS dailies of the franchise's kind of work completed (any days from the offering on;
//      one before it, played in the Archive, doesn't count), about a month and a half at the earliest;
//   4. the trial: once the dawns are in, the set's boss beaten on Hell without losing a heart;
//   5. the forging: the card draws itself, and pays REWARD DleCoins.
// The numbers: src/data/tuning/genesis.json. The card's look: .card-genesis-* in src/index.css.
import T from '../data/tuning/genesis.json';
import { addDays } from '../lib/date';
import type { Domain } from '../types';
import { COLLECTIBLE, genesisOf, type Card } from './cards';

export const GENESIS_DAWNS = T.dawns;
export const GENESIS_SHARDS = T.shards;
export const GENESIS_REWARD = T.reward;
export const GENESIS_COLORS = T.colors as [string, string, string];

/** A ritual under way (or done), by set id. */
export interface GenesisRite {
  /** The day the offering was made: the dawns count from it. */
  begun: string;
  /** The day the card was forged. */
  forged?: string;
  /** Who forged it (signed in). */
  by?: string;
}

/** What the ritual reads from a save. */
export interface GenesisSave {
  cards: Record<string, number>;
  bosses: Record<string, { wins: number; flawlessAt?: string }>;
  days: Record<string, Record<number, { status: string }>>;
  starShards?: number;
  genesis?: Record<string, GenesisRite>;
}

const bossWon = (s: GenesisSave, set: string, d: 'hard' | 'hell') => (s.bosses[`${set}:${d}`]?.wins ?? 0) > 0;

/** The set's Omni with a spare to offer (the one with the most copies), if any. */
export function spareOmni(cards: Record<string, number>, set: string): Card | undefined {
  return COLLECTIBLE.filter((c) => c.set === set && c.rarity === 'omni' && (cards[c.id] ?? 0) > 1).sort((a, b) => (cards[b.id] ?? 0) - (cards[a.id] ?? 0))[0];
}

/** The days, from `from` on, whose daily of `domain` was completed, in order. */
export function dawnDays(days: GenesisSave['days'], domain: Domain, from: string, rounds: number): string[] {
  const out: string[] = [];
  const prefix = `${domain}:`;
  for (const [k, r] of Object.entries(days)) {
    if (!k.startsWith(prefix)) continue;
    const date = k.slice(prefix.length);
    if (date < from) continue;
    if (Object.values(r ?? {}).filter((x) => x.status !== 'playing').length >= rounds) out.push(date);
  }
  return out.sort();
}

export type GenesisStep = 'set' | 'awake' | 'offering' | 'dawns' | 'trial' | 'forge' | 'forged';

export interface GenesisStatus {
  card: Card;
  /** The step the player is on. */
  step: GenesisStep;
  setComplete: boolean;
  /** Cards of the set still missing. */
  missing: number;
  awake: boolean;
  rite?: GenesisRite;
  /** The Omni a spare would be taken from (before the offering). */
  omni?: Card;
  shards: number;
  dawns: number;
  /** The day the last dawn came (the trial must come after it). */
  dawnsDone?: string;
  trial: boolean;
}

/** Where a set's ritual stands. `rounds`: the rounds a daily has (ROUNDS_PER_DAY). */
export function genesisStatus(s: GenesisSave, set: string, rounds: number): GenesisStatus | null {
  const card = genesisOf(set);
  if (!card) return null;
  const missing = COLLECTIBLE.filter((c) => c.set === set && !(s.cards[c.id] ?? 0)).length;
  const setComplete = missing === 0;
  const awake = bossWon(s, set, 'hard');
  const rite = s.genesis?.[set];
  const shards = s.starShards ?? 0;
  const days = rite ? dawnDays(s.days, card.domain, rite.begun, rounds) : [];
  const dawns = Math.min(GENESIS_DAWNS, days.length);
  const dawnsDone = days.length >= GENESIS_DAWNS ? days[GENESIS_DAWNS - 1] : undefined;
  const flawless = s.bosses[`${set}:hell`]?.flawlessAt;
  const trial = !!dawnsDone && !!flawless && flawless >= dawnsDone;
  const base = { card, setComplete, missing, awake, rite, omni: spareOmni(s.cards, set), shards, dawns, dawnsDone, trial };
  const step: GenesisStep =
    rite?.forged || (s.cards[card.id] ?? 0) > 0
      ? 'forged'
      : !rite
        ? !setComplete
          ? 'set'
          : !awake
            ? 'awake'
            : 'offering'
        : !dawnsDone
          ? 'dawns'
          : !trial
            ? 'trial'
            : 'forge';
  return { ...base, step };
}

/** Whether the offering can be made now. */
export const canOffer = (g: GenesisStatus) => g.step === 'offering' && !!g.omni && g.shards >= GENESIS_SHARDS;
/** Whether the card can be forged now: the trial passed, and the set still whole. */
export const canForge = (g: GenesisStatus) => g.step === 'forge' && g.setComplete && g.awake;

/** The earliest day the dawns can be in, from the day of the offering. */
export const earliestDawn = (begun: string) => addDays(begun, GENESIS_DAWNS - 1);
