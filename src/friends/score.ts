// A player's collection score, for the Friends chart (src/pages/Friends.tsx): every card owned counts once,
// worth more the rarer it is, and more again for each grade it was taken to (src/gacha/grades.ts); an Altered
// card (back from a black hole with an anomaly) is worth more still.
import { CARD_BY_ID, RARITIES, type Rarity } from '../gacha/cards';
import { gradeOf } from '../gacha/grades';

/** What one card is worth, by rarity. */
export const RARITY_POINTS: Record<Rarity, number> = {
  common: 1,
  rare: 3,
  epic: 8,
  legendary: 20,
  mythic: 50,
  omni: 120,
};
/** Each grade above the first adds this share of the card's worth (grade VII: ×4). */
export const GRADE_BONUS = 0.5;
/** An Altered card's worth is multiplied by this (a ticket: Altered cards count more). */
export const ALTERED_FACTOR = 2;

export interface ScoreInfo {
  /** The score itself. */
  score: number;
  /** Different cards owned. */
  cards: number;
  /** Cards owned at each rarity, from common to omni. */
  byRarity: number[];
  /** Grades gained above the first, all cards together. */
  grades: number;
}

/** `altered`: the cards with an anomaly (chosen, or still to choose). */
export function scoreOf(cards: Record<string, number>, grades: Record<string, number>, altered: ReadonlySet<string> = new Set()): ScoreInfo {
  let score = 0;
  let owned = 0;
  let gained = 0;
  const byRarity = RARITIES.map(() => 0);
  for (const [id, count] of Object.entries(cards)) {
    const card = CARD_BY_ID.get(id);
    if (!card || count <= 0) continue;
    const grade = gradeOf(grades, id);
    owned++;
    gained += grade - 1;
    byRarity[RARITIES.indexOf(card.rarity)]++;
    score += RARITY_POINTS[card.rarity] * (1 + GRADE_BONUS * (grade - 1)) * (altered.has(id) ? ALTERED_FACTOR : 1);
  }
  return { score: Math.round(score), cards: owned, byRarity, grades: gained };
}
