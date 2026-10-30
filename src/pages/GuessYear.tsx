import { useMemo, useState } from 'react';
import { shownName } from '../lib/french';
import { Link } from 'react-router-dom';
import { Customise, useCustomPicks } from '../components/Customise';
import { DOMAINS, WORKS, domainInfo } from '../data';
import { celebrateBig } from '../lib/fx';
import { shuffle } from '../lib/rng';
import { sfx } from '../lib/sfx';
import { useProgress } from '../store/progress';
import type { Domain, Work } from '../types';

const ROUNDS = 5;
const MIN_YEAR = 1935;
const MAX_YEAR = new Date().getFullYear();
/** Exact is 100; every year off costs 10. */
const points = (guess: number, year: number) => Math.max(0, 100 - Math.abs(guess - year) * 10);

const pool = (domain: Domain | 'all') => WORKS.filter((w) => w.cover?.image && w.year && (domain === 'all' || w.domain === domain));

/** Customise: kinds of work and decades, mixed. */
const decade = (year: number) => `${Math.floor(year / 10) * 10}s`;
const DECADES = [...new Set(pool('all').map((w) => decade(w.year)))].sort();
const YEAR_OPTIONS = [
  ...DOMAINS.map((d) => ({ key: d.id, label: `${d.icon} ${d.label}`, group: 'Kinds of work' })),
  ...DECADES.map((x) => ({ key: x, label: x, group: 'Decades' })),
];
const mixPool = (picks: string[]) => pool('all').filter((w) => picks.includes(w.domain) && picks.includes(decade(w.year)));

function Run({ domain, onExit, mix }: { domain: Domain | 'all' | 'custom'; onExit: () => void; mix?: string[] }) {
  const key = `year:${domain}`;
  const best = useProgress((s) => s.bests[key] ?? 0);
  const recordBest = useProgress((s) => s.recordBest);
  const [run, setRun] = useState(0);
  const works = useMemo(() => shuffle(mix ? mixPool(mix) : pool(domain as Domain | 'all'), Math.random).slice(0, ROUNDS), [domain, run, mix]);
  const [index, setIndex] = useState(0);
  const [guess, setGuess] = useState(2005);
  const [results, setResults] = useState<number[]>([]);
  const work: Work | undefined = works[index];
  const revealed = results.length > index;
  const total = results.reduce((a, b) => a + b, 0);
  const over = results.length === ROUNDS;

  const lock = () => {
    const p = points(guess, work!.year);
    p === 100 ? sfx.streak() : p ? sfx.correct() : sfx.wrong();
    const next = [...results, p];
    setResults(next);
    if (next.length === ROUNDS) {
      const sum = next.reduce((a, b) => a + b, 0);
      if (sum > best) window.setTimeout(() => celebrateBig(), 500);
      recordBest(key, sum, { ratio: sum / (ROUNDS * 100) });
    }
  };
  const next = () => {
    sfx.click();
    setIndex((i) => i + 1);
    setGuess(2005);
  };
  const again = () => {
    sfx.click();
    setRun((r) => r + 1);
    setIndex(0);
    setResults([]);
    setGuess(2005);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <button type="button" onClick={onExit} className="font-display text-sm font-semibold tracking-wider text-ink-soft hover:text-ink">
          ← {domain === 'custom' ? 'Your mix' : domain === 'all' ? 'All categories' : domainInfo(domain).label}
        </button>
        <p className="font-serif text-2xl font-bold tabular-nums">
          {total}
          <span className="text-base text-ink-faint"> / {ROUNDS * 100}</span>
        </p>
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {Array.from({ length: ROUNDS }, (_, i) => (
          <span key={i} className={`h-2 rounded-full ${i < results.length ? (results[i] === 100 ? 'bg-hit' : results[i] ? 'bg-near' : 'bg-miss') : i === index ? 'bg-ink' : 'bg-tile'}`} />
        ))}
      </div>

      {work && (
        <div key={work.id} className="page animate-round-in grid gap-5 rounded-md p-5 sm:grid-cols-[14rem_1fr] sm:p-6">
          <div className="mx-auto aspect-[3/4] w-full max-w-[14rem] overflow-hidden rounded-lg bg-tile">
            <img src={work.cover!.image} alt="" draggable={false} className="size-full object-cover" />
          </div>
          <div className="flex flex-col justify-center gap-5">
            <div>
              <p className="font-display text-xs uppercase tracking-[0.3em] text-ink-faint">
                {domainInfo(work.domain).noun} · {work.studio}
              </p>
              <h2 className="text-3xl font-bold">{shownName(work.name)}</h2>
              {work.subtitle && <p className="text-ink-soft">{work.subtitle}</p>}
            </div>
            <div className="space-y-2">
              <p className="text-center font-serif text-5xl font-bold tabular-nums">{guess}</p>
              <input
                type="range"
                min={MIN_YEAR}
                max={MAX_YEAR}
                value={guess}
                disabled={revealed}
                onChange={(e) => setGuess(Number(e.target.value))}
                aria-label="Release year"
                className="w-full accent-accent"
              />
              <div className="flex justify-between text-xs text-ink-faint">
                <span>{MIN_YEAR}</span>
                <div className="flex gap-1">
                  {[-5, -1, 1, 5].map((d) => (
                    <button
                      key={d}
                      type="button"
                      disabled={revealed}
                      onClick={() => setGuess((g) => Math.min(MAX_YEAR, Math.max(MIN_YEAR, g + d)))}
                      className="rounded border border-rule-strong px-2 py-0.5 font-display font-semibold text-ink-soft hover:text-ink"
                    >
                      {d > 0 ? `+${d}` : d}
                    </button>
                  ))}
                </div>
                <span>{MAX_YEAR}</span>
              </div>
            </div>
            {!revealed ? (
              <button type="button" onClick={lock} className="btn-ink rounded-md py-3 font-display font-bold tracking-wider">
                Lock in {guess}
              </button>
            ) : (
              <div className={`animate-pop rounded-md border p-4 text-center ${results[index] === 100 ? 'border-hit/50 bg-hit/10' : results[index] ? 'border-near/50 bg-near/10' : 'border-miss/50 bg-miss/10'}`}>
                <p className="font-display text-sm uppercase tracking-widest text-ink-soft">
                  {results[index] === 100 ? 'Spot on' : `${Math.abs(guess - work.year)} year${Math.abs(guess - work.year) === 1 ? '' : 's'} off`} · +{results[index]}
                </p>
                <p className="font-serif text-4xl font-bold">{work.year}</p>
                {!over ? (
                  <button type="button" onClick={next} className="btn-ink mt-3 rounded-md px-6 py-2.5 font-display font-bold tracking-wider">
                    Next →
                  </button>
                ) : (
                  <div className="mt-3 space-y-2">
                    <p className="font-display font-bold">
                      Final score: {total} / {ROUNDS * 100}
                      {total > best ? <span className="ml-2 text-ochre">★ New best</span> : <span className="ml-2 text-ink-soft">(best {best})</span>}
                    </p>
                    <button type="button" onClick={again} className="btn-ink rounded-md px-6 py-2.5 font-display font-bold tracking-wider">
                      Play again
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** /guess-the-year */
export default function GuessYear() {
  const bests = useProgress((s) => s.bests);
  const [domain, setDomain] = useState<Domain | 'all' | 'custom' | null>(null);
  const { picks, setPicks } = useCustomPicks('omnidle-custom-year', YEAR_OPTIONS);
  const mixed = mixPool(picks).length;
  if (domain) return <Run key={domain} domain={domain} onExit={() => setDomain(null)} mix={domain === 'custom' ? picks : undefined} />;
  const choices: { id: Domain | 'all'; label: string; icon: string }[] = [{ id: 'all', label: 'Everything', icon: '🌐' }, ...DOMAINS.map((d) => ({ id: d.id, label: d.label, icon: d.icon }))];
  return (
    <div className="space-y-8">
      <div>
        <Link to="/games" className="font-display text-sm font-semibold tracking-wider text-ink-soft hover:text-ink">
          ← Games
        </Link>
        <h1 className="text-5xl font-bold">Guess the Year</h1>
        <p className="max-w-xl text-ink-soft">
          {ROUNDS} games, anime, films or albums: when did each come out? The exact year scores 100, and every year off costs 10.
        </p>
      </div>
      <Customise options={YEAR_OPTIONS} picks={picks} onChange={setPicks} noun="filter" problem={mixed < ROUNDS ? `Your mix has ${mixed} works: pick more kinds of work or decades (${ROUNDS} needed).` : null} />
      <ul className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {mixed >= ROUNDS && (
          <li>
            <button type="button" onClick={() => (sfx.click(), setDomain('custom'))} className="page flex h-full w-full flex-col items-start gap-1 rounded-md p-5 text-left ring-2 ring-coral/60 transition hover:-translate-y-0.5">
              <span className="text-3xl">🎛</span>
              <span className="font-display text-xl font-bold">Your mix</span>
              <span className="text-xs text-ink-faint">
                {mixed} works{(bests['year:custom'] ?? 0) > 0 ? ` · best ${bests['year:custom']}` : ''}
              </span>
            </button>
          </li>
        )}
        {choices.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => (sfx.click(), setDomain(c.id))}
              className="page flex h-full w-full flex-col items-start gap-1 rounded-md p-5 text-left ring-2 ring-accent/40 transition hover:-translate-y-0.5"
            >
              <span className="text-3xl">{c.icon}</span>
              <span className="font-display text-xl font-bold">{c.label}</span>
              <span className="text-xs text-ink-faint">
                {pool(c.id).length} works{(bests[`year:${c.id}`] ?? 0) > 0 ? ` · best ${bests[`year:${c.id}`]}` : ''}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
