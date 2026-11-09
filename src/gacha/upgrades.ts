// Paid rarity upgrades: a card players loved, raised to a higher rarity as a new card. The old card is vaulted —
// no pack, renewal or cosmic event gives it any more, and it no longer counts towards a complete set or album —
// but whoever has it keeps it, and can pay DleCoins to turn each copy into the new one. The new card is pulled
// like any other: paying is for those who already had the old one, so nobody gets an Omni they didn't earn.

export interface Upgrade {
  /** The card each copy becomes. */
  into: string;
  /** DleCoins per copy. */
  coins: number;
}

export const UPGRADES: Record<string, Upgrade> = {
  // Sokka's Mythic, the Mightiest Warrior: 10,000 DleCoins (the price of 100 Omnidle packs) to raise him to Omni.
  'avatar:mythic-sokka': { into: 'avatar:omni-sokka', coins: 10_000 },
  // Acheron's Mythic, the Rain at Dusk: the same price to raise her to Omni.
  'hsr:mythic-2': { into: 'hsr:omni-acheron', coins: 10_000 },
};

/** Cards no longer given out (see UPGRADES): kept by their owners, upgradable, not needed to complete a set. */
export const VAULTED = new Set(Object.keys(UPGRADES));
export const isVaulted = (id: string) => VAULTED.has(id);
