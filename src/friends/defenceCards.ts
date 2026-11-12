// The Defence Deck's cards as they fight (src/friends/defence.ts): a card's element, kind, grade and anomaly.
// The Legendaries, Mythics and Omnis have an element picked for who they are (src/data/card-elements.json); every other
// card gets one of the four basic elements from its id (always the same). A card taken to the element grade fights with
// the element its player chose for it.
import ELEMENTS_BY_CARD from '../data/card-elements.json';
import { ANOMALIES } from '../gacha/anomalies';
import { CARD_BY_ID, type Card } from '../gacha/cards';
import { ELEMENT_GRADE, ELEMENTS, gradeOf, isElement } from '../gacha/grades';
import { BASIC, DEFENCE, type Anomaly, type Element, type Fighter, type Kind } from './defence';

const PICKED = ELEMENTS_BY_CARD as Record<string, Element>;

/** A card's own element (before any grading): picked by hand, else one of the basic four from its id. */
export function cardElement(id: string): Element {
  const picked = PICKED[id];
  if (picked) return picked;
  let h = 0;
  for (const ch of id) h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0;
  return BASIC[Math.abs(h) % BASIC.length];
}

export const kindOf = (c: Card): Kind => (c.technique ? 'technique' : c.place ? 'place' : 'fighter');

/** What one card in a saved team holds: enough to fight it on another player's screen. */
export interface TeamCard {
  id: string;
  grade: number;
  element: Element;
  anomaly: Anomaly | null;
}

/** A card of this save as it would fight: its grade, the element it has (chosen at the element grade), its anomaly. */
export function teamCardOf(id: string, save: { grades: Record<string, number>; elements?: Record<string, string>; anomalies?: Record<string, string> }): TeamCard {
  const grade = gradeOf(save.grades, id);
  const chosen = save.elements?.[id];
  const element = grade >= ELEMENT_GRADE && isElement(chosen) ? (chosen as Element) : cardElement(id);
  const a = save.anomalies?.[id];
  return { id, grade, element, anomaly: a && a in ANOMALIES ? (a as Anomaly) : null };
}

/** A saved team card made a fighter (null if the card no longer exists). */
export function fighterOf(t: TeamCard): Fighter | null {
  const c = CARD_BY_ID.get(t.id);
  if (!c) return null;
  return { id: c.id, set: c.set, rarity: c.rarity, element: t.element, kind: kindOf(c), grade: t.grade, anomaly: t.anomaly };
}

export const fighters = (team: TeamCard[]): Fighter[] => team.map(fighterOf).filter((f): f is Fighter => !!f);

export const ELEMENT_INFO = ELEMENTS as Record<Element, { name: string; icon: string }>;
export const costOfCard = (c: Card) => DEFENCE.cost[c.rarity];
