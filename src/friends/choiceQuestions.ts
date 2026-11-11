// The Daily Choice (Friends → Daily Choice): every day, the same three questions for everyone ("Who wins in a
// one-on-one fight?", "Who's the coolest?"…), each with two to four well-known characters from any franchise
// (Legendary or better: the favourites). Each choice made pays (src/data/daily-choice.json); friends see who
// chose what the next day (src/cloud/choices.ts).
import DATA from '../data/daily-choice.json';
import { COLLECTIBLE, type Card } from '../gacha/cards';
import { dayNumber } from '../lib/date';
import { hashString, mulberry32 } from '../lib/rng';

export const CHOICE = DATA as { coins: number; perDay: number; skipSets: string[]; rarities: string[]; launchSets: string[]; since: Record<string, string>; questions: { text: string; options: number }[] };

export interface ChoiceQuestion {
  /** 0, 1, 2: its place in the day. */
  index: number;
  text: string;
  options: Card[];
}

/**
 * The characters a question can ask about: Legendary or better, one card a name, no places, techniques or objects.
 * A set added after the Daily Choice launched joins only from its "since" day (daily-choice.json): votes are stored by
 * card id, so a past day must keep drawing the very same characters for its results to show.
 */
let pool: Card[] | null = null;
function allCharacters(): Card[] {
  if (pool) return pool;
  const seen = new Set<string>();
  pool = COLLECTIBLE.filter((c) => {
    if (c.place || c.technique || CHOICE.skipSets.includes(c.set) || !CHOICE.rarities.includes(c.rarity) || seen.has(c.name)) return false;
    seen.add(c.name);
    return true;
  });
  return pool;
}
function characters(day: string): Card[] {
  return allCharacters().filter((c) => CHOICE.launchSets.includes(c.set) || (CHOICE.since[c.set] !== undefined && CHOICE.since[c.set] <= day));
}

/**
 * The questions go round in blocks: every question once, shuffled (8 days for 24 questions at 3 a day), then a new
 * shuffle. A block's first day never repeats the last day of the block before: its clashing questions trade places
 * with ones from the middle of the block (never its last day, so the next block can count on it as shuffled).
 */
function shuffled(block: number): number[] {
  const rand = mulberry32(hashString(`daily-choice-block:${block}`));
  const order = CHOICE.questions.map((_, k) => k);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}
function blockOrder(block: number): number[] {
  const order = shuffled(block);
  const per = CHOICE.perDay;
  const last = new Set(shuffled(block - 1).slice(-per));
  for (let i = 0; i < per; i++) {
    if (!last.has(order[i])) continue;
    for (let j = per; j < order.length - per; j++) {
      if (!last.has(order[j])) {
        [order[i], order[j]] = [order[j], order[i]];
        break;
      }
    }
  }
  return order;
}
/** The questions a day asks (their place in CHOICE.questions). */
function templatesOf(day: string): number[] {
  const per = CHOICE.perDay;
  const days = Math.floor(CHOICE.questions.length / per);
  const n = dayNumber(day) + 10_000 * days; // Kept positive before the epoch too.
  const at = (n % days) * per;
  return blockOrder(Math.floor(n / days)).slice(at, at + per);
}

/** A day's questions: the same for everyone, none asked the day before, no character twice in the day. */
export function questionsOf(day: string): ChoiceQuestion[] {
  const rand = mulberry32(hashString(`daily-choice:${day}`));
  const picks = templatesOf(day);
  const cards = characters(day);
  return picks.map((k, i) => {
    const q = CHOICE.questions[k];
    const options: Card[] = [];
    while (options.length < q.options && cards.length) {
      // A franchise not in the question yet, when there's one left.
      const fresh = cards.filter((c) => !options.some((o) => o.set === c.set));
      const from = fresh.length ? fresh : cards;
      const pick = from[Math.floor(rand() * from.length)];
      cards.splice(cards.indexOf(pick), 1);
      options.push(pick);
    }
    return { index: i, text: q.text, options };
  });
}
