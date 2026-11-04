// Effect cards (a proposal, not played yet): cards that change a number of the game for a while — a buff,
// a debuff, or both at once. Each effect is data (src/data/tuning/effects.json, edited from the dev-only
// #/admin page): what it changes (`modifiers`, each a target, an operation and a value), how long it lasts
// (uses, fights or days: whichever ends first) and what playing it again does. The games would call
// `applyEffects(target, base, active)` where they compute that number (the coins of a game, a pack's
// luck, a boss clock…); nothing calls it yet, and `enabled` stays false until the owner approves.
import T from '../data/tuning/effects.json';
import type { Rarity } from './cards';

/** The numbers an effect can change: each one a hook to add where the game computes it. */
export type EffectTarget =
  | 'roundCoins'
  | 'arcadeCoins'
  | 'bossWinCoins'
  | 'expeditionCoins'
  | 'duplicateValue'
  | 'packLuck'
  | 'packBoost'
  | 'packCost'
  | 'bossClock'
  | 'bossHearts'
  | 'radarErrors';

export interface Modifier {
  target: EffectTarget;
  op: 'multiply' | 'add' | 'set';
  value: number;
}

export interface Effect {
  id: string;
  name: string;
  icon: string;
  kind: 'buff' | 'debuff' | 'mixed';
  blurb: string;
  modifiers: Modifier[];
  /** Ends at whichever comes first. */
  duration: { uses?: number; fights?: number; days?: number };
  /** Played again while active: ignored, its time reset, or a second copy on top. */
  stacking: 'none' | 'refresh' | 'stack';
  /** The rarities that can carry it. */
  rarities: Rarity[];
}

/** An effect in play, as a save would keep it. */
export interface ActiveEffect {
  id: string;
  /** Copies on top of each other (stacking: 'stack'). */
  stacks: number;
  usesLeft?: number;
  fightsLeft?: number;
  /** The last day it's active, "YYYY-MM-DD". */
  until?: string;
}

export const EFFECTS_ENABLED: boolean = T.enabled;
export const EFFECTS = Object.fromEntries(Object.entries(T.effects).map(([id, e]) => [id, { ...e, id }])) as Record<string, Effect>;

/** A number with every active effect on it: `set` first, then additions, then multiplications. */
export function applyEffects(target: EffectTarget, base: number, active: ActiveEffect[], effects: Record<string, Effect> = EFFECTS): number {
  if (!EFFECTS_ENABLED && effects === EFFECTS) return base;
  const mods = active.flatMap((a) => (effects[a.id]?.modifiers ?? []).filter((m) => m.target === target).map((m) => ({ m, n: Math.max(1, a.stacks) })));
  let v = base;
  for (const { m } of mods) if (m.op === 'set') v = m.value;
  for (const { m, n } of mods) if (m.op === 'add') v += m.value * n;
  for (const { m, n } of mods) if (m.op === 'multiply') v *= m.value ** n;
  return v;
}
