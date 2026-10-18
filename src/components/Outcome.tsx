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
      className={`animate-pop rounded-2xl border p-5 text-center ${
        won ? 'border-green-500/40 bg-green-500/10' : 'border-red-500/40 bg-red-500/10'
      }`}
    >
      <p className="text-sm uppercase tracking-widest text-zinc-400">{won ? 'Nailed it' : 'Out of tries'}</p>
      {answer && (
        <p className="mt-1 text-2xl font-bold">
          {answer.name}
          {answer.subtitle && <span className="text-zinc-400"> — {answer.subtitle}</span>}
        </p>
      )}
      {answerLabel && <p className="mt-1 text-lg font-semibold">{answerLabel}</p>}
      {answer && (
        <p className="mt-1 text-sm text-zinc-400">
          {answer.year} · {answer.studio} · {answer.creator}
        </p>
      )}
      <p className={`mt-3 text-3xl font-black ${won ? 'text-green-400' : 'text-red-400'}`}>+{record.score}</p>
    </div>
  );
}
