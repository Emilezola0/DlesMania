// A card's grade, I to VIII: separate from its rarity (which never changes). Five copies of the same
// card merge into one a grade higher — the card itself and four spares — and each grade has its emblem
// and a little more shine on top of the rarity's own. Every grade reached pays DleCoins, by the card's
// rarity and more for each grade up. Singularity (VII) also asks for the card's boss beaten on Hell; the
// last, Elemental (VIII), lets the player pick an element (Water, Air, Fire, Earth, Light, Darkness),
// which can be changed later for a few coins, and makes the card's spare copies worth a little more.
import { DUPLICATE_VALUE } from './economy';
import type { Rarity } from './cards';
// The numbers and the emblems' metals live in src/data/tuning/grades.json (edited from the dev-only #/admin page).
import T from '../data/tuning/grades.json';

export const MAX_GRADE = T.maxGrade;
/** The grade that also asks for the franchise's boss beaten on Hell. */
export const HELL_GRADE = T.hellGrade;
/** Spare copies a grade-up takes (with the card itself: five copies become one). */
export const GRADE_COST = T.gradeCost;

export interface GradeInfo {
  name: string;
  numeral: string;
  /** The emblem's metal: light, mid, dark. */
  metal: [string, string, string];
}

export const GRADES = T.grades as unknown as Record<number, GradeInfo>;

export const gradeOf = (grades: Record<string, number> | undefined, id: string) => Math.min(MAX_GRADE, Math.max(1, grades?.[id] ?? 1));

/**
 * A grade's reward: what the four spares would fetch traded in, times this — so a grade-up always pays
 * as much as trading them, and more the higher the grade (Bronze ×1 … Elemental ×7).
 */
export const GRADE_REWARD_SHARE: Record<number, number> = T.rewardShare;
export const gradeReward = (rarity: Rarity, grade: number, cost = GRADE_COST, share: Record<number, number> = GRADE_REWARD_SHARE) =>
  Math.round(DUPLICATE_VALUE[rarity] * cost * (share[grade] ?? 0));
/** Every grade's reward from `from` (excluded) up to `to`. */
export function gradeRewards(rarity: Rarity, from: number, to: number): number {
  let sum = 0;
  for (let g = Math.max(1, from) + 1; g <= Math.min(MAX_GRADE, to); g++) sum += gradeReward(rarity, g);
  return sum;
}

/** Whether a card can go up a grade now: below the top, with enough spares and, from Singularity on, its boss beaten on Hell. */
export const canGradeUp = (count: number, grade: number, hellBeaten: boolean) => grade < MAX_GRADE && count - 1 >= GRADE_COST && (grade + 1 < HELL_GRADE || hellBeaten);

/** The grade where the player picks an element, and what changing it later costs. */
export const ELEMENT_GRADE = T.elementGrade;
export const ELEMENT_SWITCH_COST = T.switchCost;

export type ElementId = 'water' | 'air' | 'fire' | 'earth' | 'light' | 'darkness';

export interface ElementInfo {
  id: ElementId;
  name: string;
  icon: string;
  /** The grade look it builds on: Celestial's (VI) or Singularity's (VII), recoloured; its own effects in index.css. */
  look: 'celestial' | 'singularity';
  /** An extra layer on the card (Earth's veins). */
  overlay?: 'veins';
  blurb: string;
  /** The emblem's metal: light, mid, dark. */
  metal: [string, string, string];
  /** The card's colours: edge light, body, glow (CSS variables --e1, --e2, --e3). */
  colors: [string, string, string];
}

export const ELEMENTS = Object.fromEntries(Object.entries(T.elements).map(([id, e]) => [id, { ...e, id }])) as unknown as Record<ElementId, ElementInfo>;
export const ELEMENT_IDS = Object.keys(ELEMENTS) as ElementId[];
export const isElement = (x: unknown): x is ElementId => typeof x === 'string' && x in ELEMENTS;

/** A card's element: only at the element grade (and Light if a save somehow lacks one). */
export const elementOf = (grade: number, element: string | undefined): ElementInfo | undefined =>
  grade >= ELEMENT_GRADE ? ELEMENTS[isElement(element) ? element : 'light'] : undefined;

/** A grade's name, with the element at the element grade: "Gold", "Fire". */
export const gradeName = (grade: number, element?: string) => elementOf(grade, element)?.name ?? GRADES[grade]?.name ?? '';

/** What a spare copy fetches traded in: more for a card at the element grade. */
export const spareValue = (rarity: Rarity, grade: number) => (grade >= ELEMENT_GRADE ? Math.round(DUPLICATE_VALUE[rarity] * T.resaleBonus) : DUPLICATE_VALUE[rarity]);
export const RESALE_BONUS = T.resaleBonus;

/** Who took a card to Singularity, and when: written on the card. */
export interface Engraving {
  by?: string;
  date: string;
}
