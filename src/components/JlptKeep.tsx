import { jlptEntry } from '../arcade/jlpt';
import { useProgress } from '../store/progress';

/** A row of stars for the JLPT words or kanji a round showed, each one onto the review list ("☆ 犬"). */
export function KeepRow({ ids }: { ids: string[] }) {
  const list = [...new Set(ids)].filter((id) => jlptEntry(id));
  if (!list.length) return null;
  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5">
      <span className="text-xs text-ink-faint">Review list:</span>
      {list.map((id) => (
        <KeepButton key={id} id={id} label={jlptEntry(id)!.text} />
      ))}
    </div>
  );
}

/** The star that puts a word on the review list, or takes it off (`label`: a short one, the word itself). */
export function KeepButton({ id, label }: { id: string; label?: string }) {
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
      {label ? (
        <span lang="ja">
          {kept ? '★' : '☆'} {label}
        </span>
      ) : kept ? (
        '★ In my review list'
      ) : (
        '☆ Add to my review list'
      )}
    </button>
  );
}

/** The same for a grammar point, on its own review list ("N4|～ばよかった"). */
export function GrammarKeepButton({ level, pattern }: { level: string; pattern: string }) {
  const key = `${level}|${pattern}`;
  const kept = useProgress((s) => key in s.jlptGrammarReview);
  const add = useProgress((s) => s.addJlptGrammarReview);
  const remove = useProgress((s) => s.removeJlptGrammarReview);
  return (
    <button
      type="button"
      onClick={() => (kept ? remove(key) : add([key]))}
      aria-pressed={kept}
      className={`rounded-full border px-3 py-1 font-display text-xs font-bold transition ${kept ? 'border-ochre bg-ochre/15 text-ochre' : 'border-rule-strong text-ink-soft hover:text-ink'}`}
    >
      {kept ? '★ In my grammar review list' : '☆ Add to my grammar review list'}
    </button>
  );
}
