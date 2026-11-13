// When each card joined the game (src/data/card-since.json, kept by `npm run cards:ledger`). Anything picked by the
// day (the Daily Choice, the Raid Boss, the Daily Card Shop) goes through these, so a card added or re-graded today only
// shows from tomorrow: a day that has started keeps its questions, votes, boss and shelf.
import SINCE from '../data/card-since.json';
import type { Card, Rarity } from './cards';

const LEDGER = SINCE as { cards: Record<string, string>; rarity: Record<string, [string, string][]> };

/** Whether a card was in the game on that day (cards not in the ledger always were). */
export const cardOn = (c: Pick<Card, 'id'>, day: string): boolean => (LEDGER.cards[c.id] ?? '') <= day;

/** A card's rarity on that day: the one it had before a later change, else its own. */
export function rarityOn(c: Pick<Card, 'id' | 'rarity'>, day: string): Rarity {
  for (const [from, before] of LEDGER.rarity[c.id] ?? []) if (day < from) return before as Rarity;
  return c.rarity;
}
