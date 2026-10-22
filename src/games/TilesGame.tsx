import { useMemo } from 'react';
import { GuessInput } from '../components/GuessInput';
import { Outcome } from '../components/Outcome';
import { TilePuzzle } from '../components/TilePuzzle';
import { candidates, domainInfo, getWork } from '../data';
import { scoreFor } from '../lib/scoring';
import type { GameProps } from '../types';
import { GAME_META } from './meta';

/**
 * Cover Puzzle: a scrambled, disguised cover. Swapping and turning the pieces helps read it, but
 * only typing the work's name wins. Each wrong guess gives a couple of pieces their true look back.
 */
export default function TilesGame({ spec, record, onChange }: GameProps) {
  const work = getWork(spec.targetId!);
  const max = GAME_META.tiles.maxAttempts;
  const pool = useMemo(() => candidates('classic', work.domain), [work.domain]);
  // Rounds saved before naming was required hold "hint" / "moves:n" entries instead of works.
  const named = record.guesses.filter((g) => g !== 'hint' && g !== 'gave-up' && !g.startsWith('moves:'));
  const misses = named.filter((g) => g !== work.id).length;
  const done = record.status !== 'playing';

  const guess = (id: string) => {
    const guesses = [...named, id];
    const won = id === work.id;
    const status = won ? 'won' : guesses.length >= max ? 'lost' : 'playing';
    onChange({ status, guesses, score: won ? scoreFor('tiles', guesses.length) : 0 });
  };

  return (
    <div className="space-y-6">
      <p className="text-center text-ink-soft">
        Which <span className="font-semibold text-ink">{domainInfo(work.domain).noun}</span> is behind this scrambled cover?
      </p>
      <div className="page rounded-md p-5 sm:p-8">
        <TilePuzzle src={work.cover!.image!} seed={spec.seed} misses={misses} revealed={done} />
      </div>
      {!done && <GuessInput pool={pool} exclude={named} onGuess={guess} placeholder={`Search ${domainInfo(work.domain).label}…`} />}
      <div className="flex justify-center gap-1.5" aria-label="Attempts">
        {Array.from({ length: max }, (_, i) => {
          const g = named[i];
          const cls = !g ? 'bg-tile' : g === work.id ? 'bg-hit' : 'bg-miss';
          return <span key={i} className={`h-2 w-8 rounded-full transition-colors duration-500 ${cls}`} />;
        })}
      </div>
      <Outcome record={record} answer={work} />
    </div>
  );
}
