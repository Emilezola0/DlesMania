// The Boutique (Casino → Boutique): cosmetics bought outright, never won by chance. Name styles colour the
// player's name on their profile; pack wrappers dress every pack before it's torn (looks only: the cards inside
// are drawn the same; a golden pack keeps its gold whatever the wrapper); titles go under the player's name.
// Each is paid in DleCoins or in casino tokens (the tokens the machines give, one per 20 coins played): most take
// either, a few only tokens, and a few are never sold: they're won at the claw machine.

export interface Cosmetic {
  /** "name:gold", "wrap:galaxy", "title:high-roller"... */
  id: string;
  name: string;
  /** Its price in DleCoins; 0 for one sold for tokens only. */
  price: number;
  /** Its price in casino tokens; 0 for one sold for DleCoins only. */
  tokens: number;
  /** Its look: a class in src/index.css (.name-style-*, .pack-wrap-*); none for a title. */
  className: string;
  blurb: string;
}

export const NAME_STYLES: Cosmetic[] = [
  { id: 'name:gold', name: 'Gold', price: 2000, tokens: 100, className: 'name-style-gold', blurb: 'Your name in polished gold.' },
  { id: 'name:ember', name: 'Ember', price: 2500, tokens: 125, className: 'name-style-ember', blurb: 'Red-hot, flames running through it.' },
  { id: 'name:frost', name: 'Frost', price: 3000, tokens: 150, className: 'name-style-frost', blurb: 'Ice-blue, a cold shimmer running through it.' },
  { id: 'name:toxic', name: 'Toxic', price: 3000, tokens: 150, className: 'name-style-toxic', blurb: 'Bright green ooze, glowing faintly.' },
  { id: 'name:neon', name: 'Neon', price: 3500, tokens: 175, className: 'name-style-neon', blurb: 'A pink neon sign, buzzing with light.' },
  { id: 'name:royal', name: 'Royal', price: 5000, tokens: 250, className: 'name-style-royal', blurb: 'Deep purple and gold, fit for a crown.' },
  { id: 'name:rainbow', name: 'Rainbow', price: 6000, tokens: 300, className: 'name-style-rainbow', blurb: 'Every colour, flowing, like a Mythic card.' },
  { id: 'name:omni', name: 'Omni', price: 15000, tokens: 750, className: 'name-style-omni', blurb: "An Omni's red and gold, glowing." },
  { id: 'name:glitch', name: 'Glitch', price: 0, tokens: 400, className: 'name-style-glitch', blurb: 'Your name breaking up in red and cyan, now and then.' },
  { id: 'name:candy', name: 'Candy', price: 0, tokens: 0, className: 'name-style-candy', blurb: 'Pink and mint stripes, like a sweet from the arcade.' },
  { id: 'name:jackpot', name: 'Jackpot', price: 0, tokens: 1200, className: 'name-style-jackpot', blurb: 'Gold and ruby, casino lights chasing along it.' },
];

export const WRAPPERS: Cosmetic[] = [
  { id: 'wrap:obsidian', name: 'Obsidian', price: 2000, tokens: 100, className: 'pack-wrap-obsidian', blurb: 'Glossy black, the pack’s colours only on its edges.' },
  { id: 'wrap:lava', name: 'Lava', price: 2500, tokens: 125, className: 'pack-wrap-lava', blurb: 'Black rock cracked open, molten light underneath.' },
  { id: 'wrap:sakura', name: 'Sakura', price: 3000, tokens: 150, className: 'pack-wrap-sakura', blurb: 'Soft pink, petals drifting across.' },
  { id: 'wrap:ocean', name: 'Ocean', price: 3000, tokens: 150, className: 'pack-wrap-ocean', blurb: 'Deep blue, light rippling down through the water.' },
  { id: 'wrap:circuit', name: 'Circuit', price: 3500, tokens: 175, className: 'pack-wrap-circuit', blurb: 'A green circuit board, a pulse running along its tracks.' },
  { id: 'wrap:holo', name: 'Holographic', price: 4000, tokens: 200, className: 'pack-wrap-holo', blurb: 'A rainbow foil that shifts as it moves.' },
  { id: 'wrap:synthwave', name: 'Synthwave', price: 4500, tokens: 225, className: 'pack-wrap-synthwave', blurb: 'A neon sunset over a glowing grid.' },
  { id: 'wrap:galaxy', name: 'Galaxy', price: 5000, tokens: 250, className: 'pack-wrap-galaxy', blurb: 'Deep space and its stars, twinkling.' },
  { id: 'wrap:aurora', name: 'Aurora', price: 5500, tokens: 275, className: 'pack-wrap-aurora', blurb: 'Northern lights, green and violet, slowly waving.' },
  { id: 'wrap:felt', name: 'Casino Felt', price: 0, tokens: 500, className: 'pack-wrap-felt', blurb: 'Green table felt, card suits stamped in gold.' },
  { id: 'wrap:plush', name: 'Plush', price: 0, tokens: 0, className: 'pack-wrap-plush', blurb: 'Soft pastel fabric, stitched at the seams.' },
  { id: 'wrap:marquee', name: 'Marquee', price: 0, tokens: 900, className: 'pack-wrap-marquee', blurb: 'Ruby red, framed in casino bulbs that chase round it.' },
];

/** Titles sold in the Boutique (the others are earned by playing: src/casino/unlocks.ts). Id "title:<title id>". */
export const TITLE_ITEMS: Cosmetic[] = [
  { id: 'title:card-shark', name: 'Card Shark', price: 4000, tokens: 200, className: '', blurb: 'For the one who always knows the odds.' },
  { id: 'title:high-roller', name: 'High Roller', price: 8000, tokens: 400, className: '', blurb: 'Big bets, bigger smile.' },
  { id: 'title:big-spender', name: 'Big Spender', price: 20000, tokens: 1000, className: '', blurb: 'Money is no object.' },
  { id: 'title:lucky-star', name: 'Lucky Star', price: 0, tokens: 300, className: '', blurb: 'The machines just like you.' },
  { id: 'title:claw-champion', name: 'Claw Champion', price: 0, tokens: 0, className: '', blurb: 'Nothing escapes the claw.' },
  { id: 'title:jackpot-hunter', name: 'Jackpot Hunter', price: 0, tokens: 1500, className: '', blurb: 'One more spin. Always one more spin.' },
];

/** Neither price: won only at the claw machine (src/casino/clawMachine.ts), never sold. */
export const isClawOnly = (c: Cosmetic) => !c.price && !c.tokens;
export const CLAW_COSMETICS = [...NAME_STYLES, ...WRAPPERS, ...TITLE_ITEMS].filter(isClawOnly);

export const COSMETIC_BY_ID = new Map([...NAME_STYLES, ...WRAPPERS, ...TITLE_ITEMS].map((c) => [c.id, c]));
