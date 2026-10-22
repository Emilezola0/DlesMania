import type { ReactNode } from 'react';
import { GuessInput } from '../../components/GuessInput';
import type { RoundRecord } from '../../types';
import type { Guessable } from '../data';
import { SP_META, spScore, type SpType } from '../rounds';

interface Props {
  type: SpType;
  /** The clue itself: a picture, a laugh... `wrong` grows with each miss. */
  clue: (wrong: number, done: boolean) => ReactNode;
  question: string;
  pool: Guessable[];
  targetId: string;
  /** Unlocked one per wrong guess. */
  hints: string[];
  record: RoundRecord;
  onChange: (record: RoundRecord) => void;
  answer: { name: string; image?: string; detail?: string };
  /** The clue is the answer's own picture (a fruit, a portrait): keep pictures out of the suggestions. */
  noPictures?: boolean;
}

/** The frame shared by the Specialist rounds that are "name it from a clue": clue, guesses, hints, result. */
export function SpGuessRound({ type, clue, question, pool, targetId, hints, record, onChange, answer, noPictures = false }: Props) {
  const max = SP_META[type].maxAttempts;
  const done = record.status !== 'playing';
  const wrong = record.guesses.filter((g) => g !== targetId);
  const shown = done ? hints.length : Math.min(wrong.length, hints.length);
  const byId = new Map(pool.map((p) => [p.id, p]));

  const guess = (id: string) => {
    const guesses = [...record.guesses, id];
    const won = id === targetId;
    const status = won ? 'won' : guesses.length >= max ? 'lost' : 'playing';
    onChange({ status, guesses, score: won ? spScore(type, guesses.length) : 0 });
  };

  return (
    <div className="space-y-6">
      <p className="text-center text-ink-soft">{question}</p>
      <div className="page rounded-md p-5 sm:p-8">{clue(wrong.length, done)}</div>

      {!done && <GuessInput pool={pool} exclude={record.guesses} onGuess={guess} placeholder="Type a name…" showImages={!noPictures} />}

      <div className="flex justify-center gap-1.5" aria-label="Attempts">
        {Array.from({ length: max }, (_, i) => {
          const g = record.guesses[i];
          return <span key={i} className={`h-2 w-8 rounded-full transition-colors duration-500 ${!g ? 'bg-tile' : g === targetId ? 'bg-hit' : 'bg-miss'}`} />;
        })}
      </div>

      {wrong.length > 0 && (
        <ul className="flex flex-wrap justify-center gap-1.5">
          {wrong.map((id) => (
            <li key={id} className="rounded-md border border-miss/50 bg-miss/10 px-2 py-1 text-xs font-semibold line-through decoration-miss/70">
              {byId.get(id)?.name ?? id}
            </li>
          ))}
        </ul>
      )}

      {shown > 0 && (
        <ul className="space-y-2">
          {hints.slice(0, shown).map((h) => (
            <li key={h} className="animate-pop rounded-lg border border-near/50 bg-near/15 px-4 py-2 text-sm text-ink">
              💡 {h}
            </li>
          ))}
        </ul>
      )}

      {done && <SpOutcome won={record.status === 'won'} {...answer} />}
    </div>
  );
}

/** The banner at the end of a round: the answer, with its picture. */
export function SpOutcome({ won, name, image, detail }: { won: boolean; name: string; image?: string; detail?: string }) {
  return (
    <div className={`animate-pop flex items-center gap-5 rounded-lg border p-5 ${won ? 'border-hit/50 bg-hit/10' : 'border-miss/50 bg-miss/10'}`}>
      {image && <img src={image} alt="" className="h-24 w-24 shrink-0 rounded-lg bg-tile object-contain" />}
      <div>
        <p className="font-display text-sm uppercase tracking-widest text-ink-soft">{won ? 'Nailed it' : 'Out of tries'}</p>
        <p className="mt-1 text-2xl font-bold">{name}</p>
        {detail && <p className="text-sm text-ink-soft">{detail}</p>}
      </div>
    </div>
  );
}
