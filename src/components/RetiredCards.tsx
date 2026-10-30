import { useEffect, useState } from 'react';
import { RETIRED } from '../gacha/retired';
import { useProgress } from '../store/progress';

/**
 * Copies of a retired card (in this save, or brought in from another device) fold into the card that
 * replaced it as soon as they're seen, with a note saying what happened.
 */
export function RetiredCards() {
  const cards = useProgress((s) => s.cards);
  const foldRetiredCards = useProgress((s) => s.foldRetiredCards);
  const [note, setNote] = useState<{ text: string; coins: number } | null>(null);

  useEffect(() => {
    if (!Object.keys(RETIRED).some((id) => cards?.[id])) return;
    const r = foldRetiredCards();
    if (!r.folded.length) return;
    const text = r.folded.map((f) => `${f.copies} ${f.name} → ${f.intoName}`).join(', ');
    setNote({ text, coins: r.coins });
  }, [cards, foldRetiredCards]);

  if (!note) return null;
  return (
    <div role="status" className="animate-pop fixed inset-x-3 bottom-20 z-40 mx-auto flex max-w-md items-center gap-3 rounded-md border border-accent bg-card px-4 py-3 shadow-2xl">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent font-display text-base text-on-strong" aria-hidden>
        🎴
      </span>
      <p className="min-w-0 flex-1 text-sm">
        <b className="font-display tracking-wider">Cards merged: {note.text}</b>
        <span className="block text-ink-soft">
          They were the same character twice.{note.coins > 0 ? ` +${note.coins} DleCoins for the difference in rarity.` : ''}
        </span>
      </p>
      <button type="button" onClick={() => setNote(null)} aria-label="Close" className="shrink-0 rounded-md p-1 text-lg leading-none text-ink-faint hover:text-ink">
        ×
      </button>
    </div>
  );
}
