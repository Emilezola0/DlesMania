import { useEffect, useState } from 'react';
import { useProgress } from '../store/progress';

/**
 * Grades reached before grade-ups paid DleCoins (or brought in from another device) are paid once,
 * as soon as they're seen, with a note saying so. The card catalogue (for each card's rarity) loads
 * only when there's a grade to look at.
 */
export function GradeBackPay() {
  const grades = useProgress((s) => s.grades);
  const paid = useProgress((s) => s.gradesPaid);
  const payGradeBacklog = useProgress((s) => s.payGradeBacklog);
  const [note, setNote] = useState<{ coins: number; grades: number } | null>(null);

  useEffect(() => {
    const owed = Object.entries(grades ?? {}).some(([id, g]) => g > (paid?.[id] ?? 1));
    if (!owed) return;
    let live = true;
    void import('../gacha/cards').then(({ CARD_BY_ID }) => {
      if (!live) return;
      const r = payGradeBacklog((id) => CARD_BY_ID.get(id)?.rarity);
      if (r.coins > 0) setNote((n) => ({ coins: (n?.coins ?? 0) + r.coins, grades: (n?.grades ?? 0) + r.grades }));
    });
    return () => {
      live = false;
    };
  }, [grades, paid, payGradeBacklog]);

  if (!note) return null;
  return (
    <div role="status" className="animate-pop fixed inset-x-3 bottom-3 z-40 mx-auto flex max-w-md items-center gap-3 rounded-md border border-ochre bg-card px-4 py-3 shadow-2xl">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ochre font-display text-base text-on-strong" aria-hidden>
        🪙
      </span>
      <p className="min-w-0 flex-1 text-sm">
        <b className="font-display tracking-wider">+{note.coins} DleCoins</b>
        <span className="block text-ink-soft">
          Card grades now pay: here&apos;s the reward for the {note.grades} grade{note.grades === 1 ? '' : 's'} you had already reached.
        </span>
      </p>
      <button type="button" onClick={() => setNote(null)} aria-label="Close" className="shrink-0 rounded-md p-1 text-lg leading-none text-ink-faint hover:text-ink">
        ×
      </button>
    </div>
  );
}
