// A card's grade, I to V: separate from its rarity (which never changes). Five copies of the same
// card merge into one a grade higher — the card itself and four spares — and each grade has its emblem
// and a little more shine on top of the rarity's own.

export const MAX_GRADE = 5;
/** Spare copies a grade-up takes (with the card itself: five copies become one). */
export const GRADE_COST = 4;

export interface GradeInfo {
  name: string;
  numeral: string;
  /** The emblem's metal: light, mid, dark. */
  metal: [string, string, string];
}

export const GRADES: Record<number, GradeInfo> = {
  1: { name: 'Grade I', numeral: 'I', metal: ['#e2e8f0', '#94a3b8', '#475569'] },
  2: { name: 'Bronze', numeral: 'II', metal: ['#ffd7a8', '#cd7f32', '#6b3a12'] },
  3: { name: 'Silver', numeral: 'III', metal: ['#ffffff', '#cbd5e1', '#64748b'] },
  4: { name: 'Gold', numeral: 'IV', metal: ['#fff7c2', '#fbbf24', '#92400e'] },
  5: { name: 'Radiant', numeral: 'V', metal: ['#ffffff', '#f0abfc', '#6d28d9'] },
};

export const gradeOf = (grades: Record<string, number> | undefined, id: string) => Math.min(MAX_GRADE, Math.max(1, grades?.[id] ?? 1));

/** Whether a card can go up a grade now: below V, with enough spares. */
export const canGradeUp = (count: number, grade: number) => grade < MAX_GRADE && count - 1 >= GRADE_COST;
