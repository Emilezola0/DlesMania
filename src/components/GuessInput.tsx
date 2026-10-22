import { useEffect, useMemo, useRef, useState } from 'react';
import { workNames, type Named } from '../lib/text';
import { rankBySearch, searchScore } from '../utils/textMatcher';

interface Props {
  pool: Named[];
  exclude: string[];
  onGuess: (id: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

/** A second name to show next to the main one: the alias that matched the query best, else the first alias. */
function otherName(w: Named, query: string): string | undefined {
  const aliases = (w.aliases ?? []).filter((a) => a !== w.name);
  if (!aliases.length) return undefined;
  const score = (s: string) => searchScore(query, s) ?? 9;
  const typed = aliases.filter((a) => score(a) < score(w.name)).sort((a, b) => score(a) - score(b))[0];
  return typed ?? aliases[0];
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

  const submit = (w: Named | undefined) => {
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
                className={`flex w-full justify-between gap-3 px-4 text-left ${w.image ? 'items-center py-1.5' : 'items-baseline py-2.5'} ${
                  i === active ? 'bg-accent-soft' : 'hover:bg-tile'
                }`}
              >
                <span className="flex items-center gap-2.5 font-medium">
                  {w.image && <img src={w.image} alt="" loading="lazy" className="size-9 shrink-0 rounded-md bg-tile object-cover object-top" />}
                  <span>
                    {w.name}
                    {/* Show the French title when that's what the player typed. */}
                    {w.nameFr && (searchScore(query, w.nameFr) ?? 9) < (searchScore(query, w.name) ?? 9) && (
                      <span className="ml-1.5 font-serif text-sm italic text-ink-soft">· {w.nameFr}</span>
                    )}
                    {/* Characters: their other name (the one typed, if that's how they were found). */}
                    {w.image && otherName(w, query) && <span className="ml-1.5 font-serif text-sm italic text-ink-soft">· {otherName(w, query)}</span>}
                  </span>
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
