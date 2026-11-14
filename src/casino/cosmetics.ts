// The Boutique (Casino → Boutique): cosmetics bought outright, never won by chance. Name styles colour the
// player's name on their profile; pack wrappers dress every pack before it's torn (looks only: the cards inside
// are drawn the same; a golden pack keeps its gold whatever the wrapper); titles go under the player's name.
// Each is paid in DleCoins or in casino tokens (the tokens the machines give, one per 20 coins played): most take
// either, a few only tokens, and a few are never sold: they're won at the claw machine. The Prestige pieces, at the end of
// each list, are the showiest: tokens only, and a lot of them.

export interface Cosmetic {
  /** "name:gold", "wrap:galaxy", "title:high-roller"... */
  id: string;
  name: string;
  /** Its price in DleCoins; 0 for one sold for tokens only. */
  price: number;
  /** Its price in casino tokens; 0 for one sold for DleCoins only. */
  tokens: number;
  /** Its look: a class in src/index.css (.name-style-*, .pack-wrap-*, .title-style-*). */
  className: string;
  blurb: string;
  /** The Prestige collection: the finest effects, for many casino tokens only. */
  prestige?: true;
  /** The Ascended collection, above Prestige: tokens only, a lock to open first (`lock`), and the wildest effects. */
  ascended?: true;
  /** What must be done before it can be bought: its text, and how far along the player is ([have, want]). */
  lock?: { text: string; need: (f: LockFacts) => [number, number] };
  /**
   * A piece that evolves: the dailies to finish after buying it to reach each stage (the first is 0). Each stage
   * adds to its look (a class .ascend-2, .ascend-3... next to its own). Friends see the stage too.
   */
  evolve?: number[];
  /** A wrapper that opens its own way (src/gacha/PackOpening.tsx): the pack's last moment, torn. */
  opening?: 'holofoil' | 'inferno' | 'portal' | 'singularity' | 'bigbang';
}

/** What a lock looks at (worked out by the Boutique). */
export interface LockFacts {
  packs: number;
  owned: string[];
  omni: boolean;
  bestStreak: number;
}

/** An evolving piece's stage names, from the first. */
export const STAGE_NAMES = ['Dawn', 'Radiant', 'Celestial', 'Ascended'];
const ownedOf = (f: LockFacts, ids: string[]) => ids.filter((id) => f.owned.includes(id)).length;

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
  { id: 'name:starlight', name: 'Starlight', price: 0, tokens: 3000, className: 'name-style-starlight', prestige: true, blurb: 'A night sky inside the letters, its stars drifting by, a silver glow around them.' },
  { id: 'name:hellfire', name: 'Hellfire', price: 0, tokens: 4000, className: 'name-style-hellfire', prestige: true, blurb: 'Flames rising through every letter, flickering and throwing their light around.' },
  { id: 'name:void', name: 'Void', price: 0, tokens: 5000, className: 'name-style-void', prestige: true, blurb: 'Darker than black, a violet storm swirling inside, an edge that breathes light.' },
  { id: 'name:prism', name: 'Prism', price: 0, tokens: 6500, className: 'name-style-prism', prestige: true, blurb: 'Rainbow chrome turning through every colour, a flash of light sweeping across.' },
  { id: 'name:supernova', name: 'Supernova', price: 0, tokens: 8000, className: 'name-style-supernova', prestige: true, blurb: 'A star about to burst: white-hot, blue and violet, flaring out in a blinding pulse.' },
  { id: 'name:diamond', name: 'Diamond', price: 0, tokens: 12000, className: 'name-style-diamond', prestige: true, blurb: 'Cut like a gem: icy facets turning, glints of light, a brilliance all around.' },
  {
    id: 'name:ascendant',
    name: 'Ascendant',
    price: 0,
    tokens: 25000,
    className: 'name-style-ascendant',
    ascended: true,
    evolve: [0, 20, 60, 150],
    lock: { text: 'Own 3 Prestige name styles', need: (f) => [ownedOf(f, ['name:starlight', 'name:hellfire', 'name:void', 'name:prism', 'name:supernova', 'name:diamond']), 3] },
    blurb: 'It grows with you: pale gold at dawn, then a sweep of light, then stars circling it, and at last a blinding white-gold crown of rays.',
  },
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
  { id: 'wrap:storm', name: 'Thunderstorm', price: 0, tokens: 3000, className: 'pack-wrap-storm', prestige: true, blurb: 'Storm clouds rolling by, and now and then a bolt of lightning lights it all up.' },
  { id: 'wrap:dragon', name: 'Dragon Scale', price: 0, tokens: 4000, className: 'pack-wrap-dragon', prestige: true, blurb: "Crimson scales edged in gold, a dragon's shimmer rippling over them." },
  { id: 'wrap:crystal', name: 'Crystal', price: 0, tokens: 5000, className: 'pack-wrap-crystal', prestige: true, blurb: 'Cut glass in every colour, light breaking through its facets, sparkling.' },
  { id: 'wrap:phoenix', name: 'Phoenix', price: 0, tokens: 6500, className: 'pack-wrap-phoenix', prestige: true, blurb: 'Gold and fire, embers rising from the bottom, a heat haze breathing over it.' },
  { id: 'wrap:blackhole', name: 'Black Hole', price: 0, tokens: 8000, className: 'pack-wrap-blackhole', prestige: true, blurb: 'A burning disc of light turning around a hole of pure black.' },
  { id: 'wrap:deco', name: 'Gilded Deco', price: 0, tokens: 12000, className: 'pack-wrap-deco', prestige: true, blurb: 'Black lacquer and gold leaf, Art Deco fans, a gleam of gold sweeping across.' },
  {
    id: 'wrap:holofoil',
    name: 'Holo Foil',
    price: 0,
    tokens: 20000,
    className: 'pack-wrap-holofoil',
    ascended: true,
    opening: 'holofoil',
    lock: { text: 'Open 250 packs', need: (f) => [f.packs, 250] },
    blurb: 'A real holo foil: it tilts toward your pointer and the rainbow follows the light. Torn, its top peels off in 3D in a prismatic flash.',
  },
  {
    id: 'wrap:inferno',
    name: 'Inferno',
    price: 0,
    tokens: 30000,
    className: 'pack-wrap-inferno',
    ascended: true,
    opening: 'inferno',
    lock: { text: 'Own the Phoenix wrapper', need: (f) => [ownedOf(f, ['wrap:phoenix']), 1] },
    blurb: 'Charred black, cracks of fire glowing through, sparks rising. Torn, the whole pack burns away from the tear, in a burst of embers.',
  },
  {
    id: 'wrap:portal',
    name: 'Portal',
    price: 0,
    tokens: 45000,
    className: 'pack-wrap-portal',
    ascended: true,
    opening: 'portal',
    lock: { text: 'Own the Black Hole wrapper and an Omni card', need: (f) => [ownedOf(f, ['wrap:blackhole']) + (f.omni ? 1 : 0), 2] },
    blurb: 'A vortex turning inside the pack. Torn, the pack is spun into it and swallowed, and a ring of light bursts open where it was.',
  },
  {
    id: 'wrap:eventhorizon',
    name: 'Event Horizon',
    price: 0,
    tokens: 55000,
    className: 'pack-wrap-eventhorizon',
    ascended: true,
    opening: 'singularity',
    lock: { text: 'Own the Black Hole and Portal wrappers', need: (f) => [ownedOf(f, ['wrap:blackhole', 'wrap:portal']), 2] },
    blurb: 'A black hole in violet and cyan, space rippling into it, stars streaking in. Torn, the pack is stretched, twisted and sucked in, and the hole closes on it.',
  },
  {
    id: 'wrap:bigbang',
    name: 'Big Bang',
    price: 0,
    tokens: 80000,
    className: 'pack-wrap-bigbang',
    ascended: true,
    opening: 'bigbang',
    lock: { text: 'Own every other Ascended wrapper', need: (f) => [ownedOf(f, ['wrap:holofoil', 'wrap:inferno', 'wrap:portal', 'wrap:eventhorizon']), 4] },
    blurb: 'A point of light holding a whole universe, its plasma turning, rings rushing out. Torn, it all falls into the point, then a blinding flash, and nothing is left.',
  },
];

/** Titles sold in the Boutique (the others are earned by playing: src/casino/unlocks.ts). Id "title:<title id>". */
export const TITLE_ITEMS: Cosmetic[] = [
  { id: 'title:card-shark', name: 'Card Shark', price: 4000, tokens: 200, className: 'title-style-shark', blurb: 'For the one who always knows the odds.' },
  { id: 'title:high-roller', name: 'High Roller', price: 8000, tokens: 400, className: 'title-style-roller', blurb: 'Big bets, bigger smile.' },
  { id: 'title:big-spender', name: 'Big Spender', price: 20000, tokens: 1000, className: 'title-style-spender', blurb: 'Money is no object.' },
  { id: 'title:lucky-star', name: 'Lucky Star', price: 0, tokens: 300, className: 'title-style-lucky', blurb: 'The machines just like you.' },
  { id: 'title:claw-champion', name: 'Claw Champion', price: 0, tokens: 0, className: 'title-style-claw', blurb: 'Nothing escapes the claw.' },
  { id: 'title:jackpot-hunter', name: 'Jackpot Hunter', price: 0, tokens: 1500, className: 'title-style-jackpot', blurb: 'One more spin. Always one more spin.' },
  { id: 'title:the-whale', name: 'The Whale', price: 0, tokens: 3000, className: 'title-style-whale', prestige: true, blurb: 'The casino rolls out the red carpet. Deep-sea blue, waves of light.' },
  { id: 'title:house-wins', name: 'The House Always Wins', price: 0, tokens: 5000, className: 'title-style-house', prestige: true, blurb: "You're not playing the casino: you are the casino. Ruby and gold lights chasing." },
  { id: 'title:untouchable', name: 'Untouchable', price: 0, tokens: 7000, className: 'title-style-untouchable', prestige: true, blurb: 'Ice-white, a cold glow pulsing around it.' },
  { id: 'title:living-legend', name: 'Living Legend', price: 0, tokens: 9000, className: 'title-style-legend', prestige: true, blurb: 'Every colour of a Mythic card flowing through it, glowing.' },
  { id: 'title:omnipotent', name: 'Omnipotent', price: 0, tokens: 12000, className: 'title-style-omnipotent', prestige: true, blurb: "An Omni's red and gold, blazing, a flare running through it." },
  {
    id: 'title:eternal',
    name: 'Eternal',
    price: 0,
    tokens: 35000,
    className: 'title-style-eternal',
    ascended: true,
    evolve: [0, 30, 90, 200],
    lock: { text: 'A 30-day streak', need: (f) => [Math.min(f.bestStreak, 30), 30] },
    blurb: 'Evolves as you keep playing: silver, then gold, then a dawn of every colour, and at last a living flame with stars around it.',
  },
];

/** Neither price: won only at the claw machine (src/casino/clawMachine.ts), never sold. */
export const isClawOnly = (c: Cosmetic) => !c.price && !c.tokens;
export const CLAW_COSMETICS = [...NAME_STYLES, ...WRAPPERS, ...TITLE_ITEMS].filter(isClawOnly);

export const COSMETIC_BY_ID = new Map([...NAME_STYLES, ...WRAPPERS, ...TITLE_ITEMS].map((c) => [c.id, c]));

/**
 * An evolving piece's stage rides on its id as friends see it ("name:ascendant#3"): the id alone, and the stage
 * (1 for the first, or for a piece that doesn't evolve).
 */
export function staged(id: string | null | undefined): [string, number] {
  const [base, n] = (id ?? '').split('#');
  const c = COSMETIC_BY_ID.get(base) ?? COSMETIC_BY_ID.get(`title:${base}`);
  const max = c?.evolve?.length ?? 1;
  return [base, Math.min(max, Math.max(1, Math.floor(Number(n)) || 1))];
}

/** A stage's class next to the piece's own: none for the first. */
const stageClass = (stage: number) => (stage > 1 ? ` ascend-${stage}` : '');

/** A name style's look (its id, maybe with a stage: "name:ascendant#3"). */
export function nameStyleClass(id: string | null | undefined): string {
  const [base, stage] = staged(id);
  const c = COSMETIC_BY_ID.get(base);
  return c ? c.className + stageClass(stage) : '';
}

/** The stage an evolving piece has reached: `since` dailies finished after it was bought. */
export function stageOf(c: Cosmetic | undefined, since: number): number {
  if (!c?.evolve) return 1;
  return c.evolve.filter((at) => since >= at).length;
}

/** A title's look: a title from the Boutique has its own colours; '' for one earned by playing (plain). Its stage may ride on it ("eternal#2"). */
export const titleStyle = (titleId: string | null | undefined) => {
  const [base, stage] = staged(titleId);
  const c = COSMETIC_BY_ID.get(`title:${base}`);
  return c ? c.className + stageClass(stage) : '';
};
