// The Boutique (Casino → Boutique): cosmetics bought outright with DleCoins, never won by chance. Name styles
// colour the player's name on their profile; pack wrappers dress every pack before it's torn (looks only: the
// cards inside are drawn the same). A golden pack keeps its gold whatever the wrapper.

export interface Cosmetic {
  /** "name:gold", "wrap:galaxy"... */
  id: string;
  name: string;
  price: number;
  /** Its look: a class in src/index.css (.name-style-*, .pack-wrap-*). */
  className: string;
  blurb: string;
}

export const NAME_STYLES: Cosmetic[] = [
  { id: 'name:gold', name: 'Gold', price: 2000, className: 'name-style-gold', blurb: 'Your name in polished gold.' },
  { id: 'name:frost', name: 'Frost', price: 3000, className: 'name-style-frost', blurb: 'Ice-blue, a cold shimmer running through it.' },
  { id: 'name:rainbow', name: 'Rainbow', price: 6000, className: 'name-style-rainbow', blurb: 'Every colour, flowing, like a Mythic card.' },
  { id: 'name:omni', name: 'Omni', price: 15000, className: 'name-style-omni', blurb: "An Omni's red and gold, glowing." },
];

export const WRAPPERS: Cosmetic[] = [
  { id: 'wrap:obsidian', name: 'Obsidian', price: 2000, className: 'pack-wrap-obsidian', blurb: 'Glossy black, the pack’s colours only on its edges.' },
  { id: 'wrap:sakura', name: 'Sakura', price: 3000, className: 'pack-wrap-sakura', blurb: 'Soft pink, petals drifting across.' },
  { id: 'wrap:holo', name: 'Holographic', price: 4000, className: 'pack-wrap-holo', blurb: 'A rainbow foil that shifts as it moves.' },
  { id: 'wrap:galaxy', name: 'Galaxy', price: 5000, className: 'pack-wrap-galaxy', blurb: 'Deep space and its stars, twinkling.' },
];

export const COSMETIC_BY_ID = new Map([...NAME_STYLES, ...WRAPPERS].map((c) => [c.id, c]));
