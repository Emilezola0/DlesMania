import { useProgress } from '../store/progress';

/** The star that puts a word on the review list, or takes it off. */
export function KeepButton({ id }: { id: string }) {
  const kept = useProgress((s) => id in s.jlptReview);
  const add = useProgress((s) => s.addJlptReview);
  const remove = useProgress((s) => s.removeJlptReview);
  return (
    <button
      type="button"
      onClick={() => (kept ? remove(id) : add([id]))}
      aria-pressed={kept}
      className={`rounded-full border px-3 py-1 font-display text-xs font-bold transition ${kept ? 'border-ochre bg-ochre/15 text-ochre' : 'border-rule-strong text-ink-soft hover:text-ink'}`}
    >
      {kept ? '★ In my review list' : '☆ Add to my review list'}
    </button>
  );
}
