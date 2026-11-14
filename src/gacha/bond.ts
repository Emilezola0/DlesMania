// A Bond pack's cards (src/cloud/bonds.ts): drawn from the pack's seed, so the two friends who open it get the very
// same five, and the same Bond card if it holds one (its rarest card, BOND_CHANCE of the time). Drawn like the
// Omnidle pack's (every set, the usual odds), with no pity, golden pack or cosmic event.
import { hashString, mulberry32 } from '../lib/rng';
import { SETS, type Card } from './cards';
import { packsFor, pullPack, type Pack } from './packs';
import { BOND_CHANCE, RANKS } from './ranks';

const general = packsFor(SETS).find((p) => p.id === 'general')!;

/** The pack as the opening shows it: in the Bond's colours. */
export const BOND_PACK: Pack = {
  ...general,
  id: 'bond',
  name: 'Bond pack',
  blurb: 'Five cards, the same for both of you.',
  cost: 0,
  icon: RANKS.bond.gem,
  colors: [RANKS.bond.colors[0], RANKS.bond.colors[2]],
};

export function bondPackCards(seed: string): { cards: Card[]; bond: Card | null } {
  const rand = mulberry32(hashString(`bond:${seed}`));
  const cards = pullPack(general, 1, rand);
  // The cards come rarest last.
  const bond = rand() < BOND_CHANCE ? cards[cards.length - 1] : null;
  return { cards, bond };
}
