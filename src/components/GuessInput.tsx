import { useEffect, useMemo, useRef, useState } from 'react';
import { workNames } from '../lib/text';
import { rankBySearch, searchScore } from '../utils/textMatcher';
import type { Work } from '../types';

interface Props {
  pool: Work[];
  exclude: string[];
  onGuess: (id: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function GuessInput({ pool, exclude, onGuess, placeholder = 'Type a title…', disabled }: Props) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus without autoFocus so switching rounds doesn't scroll the page.
  useEffect(() => inputRef.current?.focus({ preventScroll: true }), []);

  const results = useMemo(
    () => rankBySearch(query, pool.filter((w) => !exclude.includes(w.id)), workNames),
    [pool, exclude, query],
  );

  // Years are a clue in most rounds (hints, Classic's Year column), so they're only shown
  // to tell apart two entries with the same name.
  const sharedNames = useMemo(() => {
    const seen = new Set<string>();
    const dupes = new Set<string>();
    for (const w of pool) (seen.has(w.name) ? dupes : seen).add(w.name);
    return dupes;
  }, [pool]);

  const submit = (w: Work | undefined) => {
    if (!w) return;
    onGuess(w.id);
    setQuery('');
    setActive(0);
    inputRef.current?.focus();
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        value={query}
        disabled={disabled}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, results.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === 'Enter') {
            submit(results[active]);
          } else if (e.key === 'Escape') {
            setQuery('');
          }
        }}
        placeholder={placeholder}
        className="w-full rounded-xl border border-rule-strong bg-card/90 px-4 py-3 text-base outline-none ring-accent/30 transition placeholder:text-ink-faint focus:border-accent focus:ring-4 disabled:opacity-50"
      />
      {results.length > 0 && (
        <ul className="animate-pop absolute z-20 mt-2 max-h-80 w-full overflow-auto rounded-xl border border-rule-strong bg-card shadow-2xl">
          {results.map((w, i) => (
            <li key={w.id}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => submit(w)}
                className={`flex w-full items-baseline justify-between gap-3 px-4 py-2.5 text-left ${
                  i === active ? 'bg-accent-soft' : 'hover:bg-tile'
                }`}
              >
                <span className="font-medium">
                  {w.name}
                  {/* Show the French title when that's what the player typed. */}
                  {w.nameFr && (searchScore(query, w.nameFr) ?? 9) < (searchScore(query, w.name) ?? 9) && (
                    <span className="ml-1.5 font-serif text-sm italic text-ink-soft">· {w.nameFr}</span>
                  )}
                </span>
                <span className="shrink-0 text-xs text-ink-soft">
                  {[w.subtitle, sharedNames.has(w.name) ? w.year : null].filter(Boolean).join(' · ')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
