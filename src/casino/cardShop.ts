// The Daily Card Shop: a few cards a day, the same for everyone, bought only with casino tokens (one token
// for every CARD_SHOP.coinsPerToken DleCoins paid into the casino's machines). At least three legendaries,
// an epic or two and a rare; on a special occasion, a mythic too. Each card can be bought once a day.
// The numbers live in src/data/tuning/casino.json (`cardShop`).
import { CARDS, type Card, type Rarity } from '../gacha/cards';
import { fromKey } from '../lib/date';
import { hashString, mulberry32 } from '../lib/rng';
import { CARD_SHOP } from './casino';

export { CARD_SHOP, tokensFor } from './casino';

/** The days a mythic comes to the shop, by month-day. */
const OCCASIONS: Record<string, string> = {
  '01-01': 'New Year',
  '02-14': "Valentine's Day",
  '04-01': "April Fools' Day",
  '10-18': "Omnidle's birthday 🎂",
  '10-31': 'Halloween',
  '12-24': 'Christmas Eve',
  '12-25': 'Christmas',
  '12-31': "New Year's Eve",
};

/** Today's occasion, if any: a fixed one, a Friday the 13th, or a lucky day (the same for everyone). */
export function occasionOf(day: string): string | null {
  const fixed = OCCASIONS[day.slice(5)];
  if (fixed) return fixed;
  const d = fromKey(day);
  if (d.getDate() === 13 && d.getDay() === 5) return 'Friday the 13th';
  return mulberry32(hashString(`card-shop-lucky:${day}`))() < CARD_SHOP.luckyDayChance ? 'Lucky day' : null;
}

export interface ShopOffer {
  card: Card;
  price: number;
}

/** What can be sold: no omnis (they stay in packs), no places or techniques. */
const POOL: Partial<Record<Rarity, Card[]>> = {};
for (const c of CARDS) if (!c.place && !c.technique && c.rarity !== 'omni') (POOL[c.rarity] ??= []).push(c);

/** The day's shelf: the same cards for everyone that day, from different sets where it can. */
export function shopFor(day: string): { offers: ShopOffer[]; occasion: string | null } {
  const rand = mulberry32(hashString(`card-shop:${day}`));
  const occasion = occasionOf(day);
  const want: [Rarity, number][] = [...(occasion ? ([['mythic', 1]] as [Rarity, number][]) : []), ['legendary', CARD_SHOP.slots.legendary ?? 3], ['epic', CARD_SHOP.slots.epic ?? 2], ['rare', CARD_SHOP.slots.rare ?? 1]];
  const sets = new Set<string>();
  const offers: ShopOffer[] = [];
  for (const [rarity, n] of want) {
    const pool = POOL[rarity] ?? [];
    for (let k = 0; k < n && pool.length; k++) {
      let pick = pool[Math.floor(rand() * pool.length)];
      // A few more draws for a set not on the shelf yet.
      for (let tries = 0; tries < 12 && (sets.has(pick.set) || offers.some((o) => o.card.id === pick.id)); tries++) pick = pool[Math.floor(rand() * pool.length)];
      if (offers.some((o) => o.card.id === pick.id)) continue;
      sets.add(pick.set);
      offers.push({ card: pick, price: CARD_SHOP.prices[rarity] ?? 0 });
    }
  }
  return { offers, occasion };
}
