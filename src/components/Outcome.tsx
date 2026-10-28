import { shownName } from '../lib/french';
import type { RoundRecord, Work } from '../types';

interface Props {
  record: RoundRecord;
  answer?: Work;
  answerLabel?: string;
}

/** Banner shown once a round is over. */
export function Outcome({ record, answer, answerLabel }: Props) {
  if (record.status === 'playing') return null;
  const won = record.status === 'won';
  return (
    <div
      className={`animate-pop flex flex-col items-center gap-5 rounded-lg border p-5 text-center sm:flex-row sm:text-left ${
        won ? 'border-hit/50 bg-hit/10' : 'border-miss/50 bg-miss/10'
      }`}
    >
      {answer?.cover?.image && (
        <img src={answer.cover.image} alt={`${answer.name} cover`} className="h-28 w-auto max-w-32 rounded-lg object-cover shadow-xl shadow-ink/25" />
      )}
      <div className="flex-1">
        <p className="text-sm font-display uppercase tracking-widest text-ink-soft">{won ? 'Nailed it' : 'Out of tries'}</p>
        {answer && (
          <p className="mt-1 text-2xl font-bold">
            {shownName(answer.name)}
            {answer.subtitle && <span className="text-ink-soft"> — {answer.subtitle}</span>}
          </p>
        )}
        {answerLabel && <p className="mt-1 text-lg font-semibold">{answerLabel}</p>}
        {answer && (
          <p className="mt-1 text-sm text-ink-soft">
            {answer.year} · {answer.studio} · {answer.creator}
          </p>
        )}
      </div>
      <p className={`text-4xl font-black ${won ? 'text-hit' : 'text-miss'}`}>+{record.score}</p>
    </div>
  );
}
