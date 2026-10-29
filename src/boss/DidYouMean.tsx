import { shownName } from '../lib/french';

/**
 * "Did you mean…?": the names a partial answer could stand for ("Kakashi" → Kakashi Hatake), as
 * buttons — picking one answers with it. No penalty for the half-name that brought them up.
 */
export function DidYouMean({ names, onPick }: { names: string[]; onPick: (name: string) => void }) {
  if (!names.length) return null;
  return (
    <div className="animate-pop flex flex-wrap items-center justify-center gap-2 text-sm" aria-live="polite">
      <span className="font-semibold text-ink-soft">Did you mean</span>
      {names.map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onPick(n)}
          className="rounded-full border-2 border-accent bg-accent-soft px-3 py-1 font-semibold text-ink transition hover:bg-accent hover:text-on-strong"
        >
          {shownName(n)}
        </button>
      ))}
      <span className="font-semibold text-ink-soft">?</span>
    </div>
  );
}
