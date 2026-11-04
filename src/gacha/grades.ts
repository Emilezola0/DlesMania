// A card's grade, I to VII: separate from its rarity (which never changes). Five copies of the same
// card merge into one a grade higher — the card itself and four spares — and each grade has its emblem
// and a little more shine on top of the rarity's own. Every grade reached pays DleCoins, by the card's
// rarity and more for each grade up. The last, Singularity, also asks for the card's boss beaten on Hell.
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
 * as much as trading them, and more the higher the grade (Bronze ×1 … Singularity ×5).
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

/** Whether a card can go up a grade now: below the top, with enough spares and, for the last grade, its boss beaten on Hell. */
export const canGradeUp = (count: number, grade: number, hellBeaten: boolean) => grade < MAX_GRADE && count - 1 >= GRADE_COST && (grade + 1 < HELL_GRADE || hellBeaten);

/** Who took a card to the last grade, and when: written on the card. */
export interface Engraving {
  by?: string;
  date: string;
}
