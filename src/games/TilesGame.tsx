import { Outcome } from '../components/Outcome';
import { TilePuzzle } from '../components/TilePuzzle';
import { getWork } from '../data';
import type { GameProps } from '../types';

/** Hints available, and what each costs. */
const MAX_HINTS = 4;
const HINT_COST = 12;
/** Moves that still score full marks (9 tiles: a few swaps plus turns). */
const PAR_MOVES = 14;

/**
 * Cover Puzzle: rebuild a scrambled cover. Assembling it is the whole goal — no title to type.
 * Hints snap a tile home (costing points); giving up reveals the cover and ends the round.
 * `record.guesses` holds "hint" entries, then "moves:<n>" once solved.
 */
export default function TilesGame({ spec, record, onChange }: GameProps) {
  const work = getWork(spec.targetId!);
  const hints = record.guesses.filter((g) => g === 'hint').length;
  const done = record.status !== 'playing';
  const moves = Number(record.guesses.find((g) => g.startsWith('moves:'))?.slice(6) ?? 0);

  const solved = (n: number) => {
    if (done) return;
    const score = Math.max(20, 100 - hints * HINT_COST - Math.max(0, n - PAR_MOVES) * 2);
    onChange({ status: 'won', guesses: [...record.guesses, `moves:${n}`], score });
  };

  return (
    <div className="space-y-6">
      <p className="text-center text-ink-soft">Put the pieces back together to restore the cover.</p>
      <div className="page rounded-md p-5 sm:p-8">
        <TilePuzzle src={work.cover!.image!} seed={spec.seed} assists={hints} revealed={record.status === 'lost'} onSolved={solved} />
      </div>
      {!done && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            disabled={hints >= MAX_HINTS}
            onClick={() => onChange({ ...record, guesses: [...record.guesses, 'hint'] })}
            className="btn-paper rounded-md px-4 py-2 font-display text-sm font-semibold tracking-wider"
          >
            Hint — snap a piece ({MAX_HINTS - hints} left, −{HINT_COST} pts)
          </button>
          <button
            type="button"
            onClick={() => onChange({ status: 'lost', guesses: [...record.guesses, 'gave-up'], score: 0 })}
            className="rounded-md px-3 py-2 font-display text-sm font-semibold tracking-wider text-ink-faint hover:text-ink"
          >
            Give up
          </button>
        </div>
      )}
      <Outcome
        record={record}
        answer={work}
        answerLabel={record.status === 'won' ? `Restored in ${moves} moves${hints ? ` with ${hints} hint${hints > 1 ? 's' : ''}` : ''}` : undefined}
      />
    </div>
  );
}
