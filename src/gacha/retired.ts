// Cards taken out of the game, each folded into the card it duplicated: the copies (and grade) move over,
// with coins for the difference when the retired card was the rarer of the two.

export interface Retired {
  /** The card that takes its place. */
  into: string;
  /** DleCoins per copy moved over. */
  coins: number;
  /** For the note shown when it happens. */
  name: string;
  intoName: string;
}

export const RETIRED: Record<string, Retired> = {
  // "Polo Marco" was Marco twice over (the wiki's full name): an Epic card of the same picture as the Rare Marco.
  // The difference between an Epic and a Rare spare traded in (15 − 5) for each copy.
  'onepiece:polo-marco': { into: 'onepiece:marco', coins: 10, name: 'Polo Marco', intoName: 'Marco' },
};
