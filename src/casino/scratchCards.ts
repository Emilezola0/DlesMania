// Scratch cards (Casino → Scratch): a few a day, and unlike the machines they pay back more than they cost
// on average (about ×1.2): a reward for players who farmed the DleCoins to buy them. Each card is a grid of
// nine prizes under a foil; three of the same prize win it. Some cards win little or nothing, now and then one
// wins big. The cards, prices, daily limits and prize odds live in src/data/tuning/casino.json (`scratch`).
import T from '../data/tuning/casino.json';

export interface ScratchCard {
  id: string;
  name: string;
  icon: string;
  cost: number;
  perDay: number;
  /** [prize in DleCoins, weight]: 0 is no win. */
  prizes: [number, number][];
}

export const SCRATCH_CARDS = T.scratch.cards as ScratchCard[];
export const SCRATCH_BY_ID = new Map(SCRATCH_CARDS.map((c) => [c.id, c]));

/** A card bought and not yet cashed in: its nine cells (prize amounts) and what it wins. */
export interface ScratchTicket {
  card: string;
  cells: number[];
  prize: number;
}

/** What a card pays back on average, per coin spent (shown nowhere; for tuning). */
export const payback = (c: ScratchCard) => c.prizes.reduce((t, [p, w]) => t + p * w, 0) / c.prizes.reduce((t, [, w]) => t + w, 0) / c.cost;

/** The card's top prize. */
export const topPrize = (c: ScratchCard) => Math.max(...c.prizes.map(([p]) => p));

function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** A fresh ticket: its prize drawn by weight, then a grid that shows it (three of it) and nothing else three times. */
export function rollScratch(c: ScratchCard): ScratchTicket {
  const total = c.prizes.reduce((t, [, w]) => t + w, 0);
  let x = Math.random() * total;
  const prize = (c.prizes.find(([, w]) => (x -= w) < 0) ?? c.prizes[0])[0];
  const values = c.prizes.map(([p]) => p).filter((p) => p > 0);
  const cells: number[] = prize > 0 ? [prize, prize, prize] : [];
  const count = new Map<number, number>(prize > 0 ? [[prize, 3]] : []);
  const add = (v: number) => (cells.push(v), count.set(v, (count.get(v) ?? 0) + 1));
  // Half the time, two of a top prize: so close.
  const top = values.filter((v) => v !== prize).slice(-2);
  if (top.length && Math.random() < 0.5) {
    const v = top[Math.floor(Math.random() * top.length)];
    add(v);
    add(v);
  }
  // The rest: other prizes, never a third of any.
  while (cells.length < 9) {
    const free = values.filter((v) => v !== prize && (count.get(v) ?? 0) < 2);
    add(free[Math.floor(Math.random() * free.length)]);
  }
  return { card: c.id, cells: shuffle(cells), prize };
}
