import { useMemo } from 'react';
import { GuessInput } from '../components/GuessInput';
import { Outcome } from '../components/Outcome';
import { candidates, domainInfo, getWork } from '../data';
import { scoreFor } from '../lib/scoring';
import type { Domain, GameProps, Work } from '../types';
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
    { label: 'Studio', get: (w) => w.studio },
    { label: 'Year', get: (w) => w.year },
  ],
  cinema: [
    { label: 'Genre', get: (w) => w.genres },
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

function compare(guess: string | string[] | number, target: string | string[] | number): Verdict {
  if (Array.isArray(guess) && Array.isArray(target)) {
    const overlap = guess.filter((g) => target.includes(g)).length;
    if (overlap === target.length && guess.length === target.length) return 'hit';
    return overlap > 0 ? 'near' : 'miss';
  }
  return guess === target ? 'hit' : 'miss';
}

const VERDICT_CLASS: Record<Verdict, string> = {
  hit: 'bg-hit border-green-400/50',
  near: 'bg-near border-yellow-300/50',
  miss: 'bg-miss border-red-400/40',
};

export default function ClassicGame({ spec, record, onChange }: GameProps) {
  const target = getWork(spec.targetId!);
  const domain = target.domain;
  const columns = COLUMNS[domain];
  const pool = useMemo(() => candidates('classic', domain), [domain]);
  const max = GAME_META.classic.maxAttempts;
  const done = record.status !== 'playing';

  const guess = (id: string) => {
    const guesses = [...record.guesses, id];
    const won = id === target.id;
    const status = won ? 'won' : guesses.length >= max ? 'lost' : 'playing';
    onChange({ status, guesses, score: won ? scoreFor('classic', guesses.length) : 0 });
  };

  return (
    <div className="space-y-5">
      <p className="text-center text-zinc-300">
        Guess the mystery <span className="font-semibold text-white">{domainInfo(domain).noun}</span>. Each guess shows
        how its attributes compare.
      </p>

      {!done && (
        <GuessInput pool={pool} exclude={record.guesses} onGuess={guess} placeholder={`Search ${domainInfo(domain).label}…`} />
      )}
      <p className="text-center text-xs text-zinc-500">
        {record.guesses.length} / {max} guesses
      </p>

      {record.guesses.length > 0 && (
        <div className="overflow-x-auto pb-2">
          <div className="min-w-[640px] space-y-2">
            <div className="grid grid-cols-[1.4fr_repeat(5,1fr)] gap-2 px-1 text-xs uppercase tracking-wider text-zinc-500">
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
                <div key={id} className="grid grid-cols-[1.4fr_repeat(5,1fr)] gap-2">
                  <div className="flex items-center rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm font-semibold">
                    {w.name}
                  </div>
                  {columns.map((c, i) => {
                    const g = c.get(w);
                    const t = c.get(target);
                    const verdict = compare(g, t);
                    return (
                      <div
                        key={c.label}
                        style={{ animationDelay: `${i * 90}ms` }}
                        className={`animate-flip flex min-h-14 flex-col items-center justify-center rounded-lg border px-2 py-2 text-center text-xs font-semibold text-white ${VERDICT_CLASS[verdict]}`}
                      >
                        <span>{Array.isArray(g) ? g.join(', ') : g}</span>
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

      <div className="flex flex-wrap justify-center gap-4 text-xs text-zinc-400">
        <span className="flex items-center gap-1.5"><i className="size-3 rounded bg-hit" /> Exact</span>
        <span className="flex items-center gap-1.5"><i className="size-3 rounded bg-near" /> Partial</span>
        <span className="flex items-center gap-1.5"><i className="size-3 rounded bg-miss" /> Wrong</span>
        <span>▲▼ Later / earlier</span>
      </div>

      <Outcome record={record} answer={target} />
    </div>
  );
}
