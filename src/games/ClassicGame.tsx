import { useMemo } from 'react';
import { GuessInput } from '../components/GuessInput';
import { Outcome } from '../components/Outcome';
import { candidates, domainInfo, getWork } from '../data';
import { shownName } from '../lib/french';
import { scoreFor } from '../lib/scoring';
import { workNames } from '../lib/text';
import type { Domain, GameProps, Work } from '../types';
import { compactText, normalizeText } from '../utils/textMatcher';
import { GAME_META } from './meta';

type Verdict = 'hit' | 'near' | 'miss';

interface Column {
  label: string;
  get: (w: Work) => string | string[] | number;
}

const COLUMNS: Record<Domain, Column[]> = {
  games: [
    { label: 'Genre', get: (w) => w.genres },
    { label: 'Platforms', get: (w) => w.platforms ?? [w.format] },
    { label: 'Studio', get: (w) => w.studio },
    { label: 'Origin', get: (w) => w.origin },
    { label: 'Year', get: (w) => w.year },
  ],
  anime: [
    { label: 'Genre', get: (w) => w.genres },
    { label: 'Format', get: (w) => w.format },
    { label: 'Source', get: (w) => w.source ?? '—' },
    { label: 'Creator', get: (w) => w.creator },
    { label: 'Studio', get: (w) => w.studio },
    { label: 'Year', get: (w) => w.year },
  ],
  cinema: [
    { label: 'Genre', get: (w) => w.genres },
    { label: 'Type', get: (w) => w.format },
    { label: 'Director', get: (w) => w.creator },
    { label: 'Studio', get: (w) => w.studio },
    { label: 'Origin', get: (w) => w.origin },
    { label: 'Year', get: (w) => w.year },
  ],
  music: [
    { label: 'Genre', get: (w) => w.genres },
    { label: 'Artist', get: (w) => w.creator },
    { label: 'Label', get: (w) => w.studio },
    { label: 'Origin', get: (w) => w.origin },
    { label: 'Year', get: (w) => w.year },
  ],
};

/** A year this close to the target (but not equal) is shown yellow. */
const NEAR_YEARS = 3;

function compare(guess: string | string[] | number, target: string | string[] | number): Verdict {
  if (Array.isArray(guess) && Array.isArray(target)) {
    const overlap = guess.filter((g) => target.includes(g)).length;
    if (overlap === target.length && guess.length === target.length) return 'hit';
    return overlap > 0 ? 'near' : 'miss';
  }
  if (typeof guess === 'number' && typeof target === 'number' && guess !== target) {
    return Math.abs(guess - target) <= NEAR_YEARS ? 'near' : 'miss';
  }
  return guess === target ? 'hit' : 'miss';
}

/** Whether a clue would spell out the title ("Mario" for Super Mario Bros.). */
function namesWork(value: string, w: Work) {
  const v = compactText(value);
  return workNames(w).some((n) => {
    const t = n && compactText(n);
    // Very short titles ("It", "Up") only count as a whole word, not inside any clue.
    return !!t && (t.includes(v) || (t.length >= 4 ? v.includes(t) : normalizeText(value).split(' ').includes(t)));
  });
}

interface Clue {
  label: string;
  value: string;
  /** Misses needed to unlock it. */
  after: number;
}

/** Extra clues that unlock as the misses pile up, vaguest first. Skips any that would give the title away. */
function cluesFor(w: Work): Clue[] {
  const safe = (values: (string | undefined)[] = []) => values.filter((v): v is string => !!v && !namesWork(v, w));
  const themes = safe(w.themes);
  const credits = safe(w.credits);
  // A side character (the list starts with the lead), or for albums a track that isn't the title track.
  const people = safe(w.domain === 'music' ? w.tracks : w.characters);
  const person = w.domain === 'music' ? 'A track' : 'A character';
  const clues: (Clue | null)[] = [
    // No themes: a second side character or track instead.
    themes.length ? { label: 'Themes', value: themes.join(', '), after: 3 } : people.length > 1 ? { label: person, value: people[people.length - 2], after: 3 } : null,
    credits.length ? { label: 'Credit', value: credits[credits.length - 1], after: 5 } : null,
    people.length ? { label: person, value: people[people.length - 1], after: 7 } : null,
  ];
  return clues.filter((c): c is Clue => !!c);
}

/** List values (genres, platforms) are shown one by one, with the ones the target shares ticked. */
function Values({ guess, target }: { guess: string | string[] | number; target: string | string[] | number }) {
  if (!Array.isArray(guess)) return <span>{guess}</span>;
  const shared = Array.isArray(target) ? target : [];
  return (
    <span className="flex flex-wrap justify-center gap-1">
      {guess.map((g) => (
        <span key={g} className={shared.includes(g) ? 'underline decoration-2 underline-offset-2' : 'opacity-75'}>
          {shared.includes(g) && '✓ '}
          {g}
        </span>
      ))}
    </span>
  );
}

const VERDICT_CLASS: Record<Verdict, string> = {
  hit: 'bg-hit border-hit text-on-strong',
  near: 'bg-near border-near text-on-pastel',
  miss: 'bg-miss border-miss text-on-strong',
};

export default function ClassicGame({ spec, record, onChange }: GameProps) {
  const target = getWork(spec.targetId!);
  const domain = target.domain;
  const columns = COLUMNS[domain];
  const pool = useMemo(() => candidates('classic', domain), [domain]);
  const max = GAME_META.classic.maxAttempts;
  const done = record.status !== 'playing';
  const clues = useMemo(() => cluesFor(target), [target]);
  const misses = record.guesses.filter((id) => id !== target.id).length;
  const grid = { gridTemplateColumns: `1.4fr repeat(${columns.length}, 1fr)` };

  const guess = (id: string) => {
    const guesses = [...record.guesses, id];
    const won = id === target.id;
    const status = won ? 'won' : guesses.length >= max ? 'lost' : 'playing';
    onChange({ status, guesses, score: won ? scoreFor('classic', guesses.length) : 0 });
  };

  return (
    <div className="space-y-5">
      <p className="text-center text-ink-soft">
        Guess the mystery <span className="font-semibold text-ink">{domainInfo(domain).noun}</span>. Each guess shows
        how its attributes compare.
      </p>

      {!done && (
        <GuessInput pool={pool} exclude={record.guesses} onGuess={guess} placeholder={`Search ${domainInfo(domain).label}…`} />
      )}
      <p className="text-center text-xs text-ink-faint">
        {record.guesses.length} / {max} guesses
      </p>

      {clues.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-3">
          {clues.map((c) => {
            const open = done || misses >= c.after;
            return (
              <li
                key={c.after}
                className={`rounded-lg border px-3 py-2 text-sm ${open ? 'animate-pop border-accent/50 bg-accent-soft' : 'border-dashed border-rule-strong text-ink-faint'}`}
              >
                <span className="block font-display text-[11px] uppercase tracking-widest text-ink-faint">{open ? c.label : 'Clue'}</span>
                {open ? <span className="font-semibold">{c.value}</span> : <span>Unlocks after {c.after} misses</span>}
              </li>
            );
          })}
        </ul>
      )}

      {record.guesses.length > 0 && (
        <div className="overflow-x-auto pb-2">
          <div className="space-y-2" style={{ minWidth: 140 + columns.length * 100 }}>
            <div className="grid gap-2 px-1 text-xs uppercase tracking-wider text-ink-faint" style={grid}>
              <span>Title</span>
              {columns.map((c) => (
                <span key={c.label} className="text-center">
                  {c.label}
                </span>
              ))}
            </div>
            {[...record.guesses].reverse().map((id) => {
              const w = getWork(id);
              return (
                <div key={id} className="grid gap-2" style={grid}>
                  <div className="flex items-center rounded-lg border border-rule-strong bg-card px-3 py-2 text-sm font-semibold">
                    {shownName(w.name)}
                  </div>
                  {columns.map((c, i) => {
                    const g = c.get(w);
                    const t = c.get(target);
                    const verdict = compare(g, t);
                    return (
                      <div
                        key={c.label}
                        style={{ animationDelay: `${i * 90}ms` }}
                        className={`animate-flip flex min-h-14 flex-col items-center justify-center rounded-lg border px-2 py-2 text-center text-xs font-semibold ${VERDICT_CLASS[verdict]}`}
                      >
                        <Values guess={g} target={t} />
                        {typeof g === 'number' && typeof t === 'number' && g !== t && (
                          <span className="text-base leading-none">{t > g ? '▲' : '▼'}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-4 text-xs text-ink-soft">
        <span className="flex items-center gap-1.5"><i className="size-3 rounded bg-hit" /> Exact</span>
        <span className="flex items-center gap-1.5"><i className="size-3 rounded bg-near" /> Partial</span>
        <span className="flex items-center gap-1.5"><i className="size-3 rounded bg-miss" /> Wrong</span>
        <span>▲▼ Later / earlier (yellow: within {NEAR_YEARS} years)</span>
      </div>

      <Outcome record={record} answer={target} />
    </div>
  );
}
