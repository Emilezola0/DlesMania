import { useMemo, useState, type ComponentType } from 'react';
import { shownName } from '../../lib/french';
import type { RoundRecord } from '../../types';
import { SP_META, spScore, type SpRound, type UniverseId } from '../rounds';
import { timelineRound, timelineSource } from '../timeline';
import { SpOutcome } from './SpGuessRound';

interface Props {
  round: SpRound;
  record: RoundRecord;
  onChange: (record: RoundRecord) => void;
}

/**
 * Timeline: put five characters in the order they first appeared. Each locked-in order shows which
 * places are right; a guess is the order as comma-separated ids.
 */
function TimelineRound({ universe, round, record, onChange }: Props & { universe: UniverseId }) {
  const items = useMemo(() => timelineRound(universe, round.targetId, round.seed), [universe, round.targetId, round.seed]);
  const byId = new Map(items.map((x) => [x.id, x]));
  const correct = [...items].sort((a, b) => a.key - b.key).map((x) => x.id);
  const max = SP_META.timeline.maxAttempts;
  const done = record.status !== 'playing';
  const last = record.guesses.at(-1)?.split(',');
  const [order, setOrder] = useState<string[]>(() => last ?? items.map((x) => x.id));
  const [dragging, setDragging] = useState<number | null>(null);
  const shown = done ? correct : order;

  const move = (from: number, to: number) => {
    if (done || to < 0 || to >= order.length) return;
    const next = [...order];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    setOrder(next);
  };

  const submit = () => {
    const guesses = [...record.guesses, order.join(',')];
    const won = order.join() === correct.join();
    const status = won ? 'won' : guesses.length >= max ? 'lost' : 'playing';
    onChange({ status, guesses, score: won ? spScore('timeline', guesses.length) : 0 });
  };

  return (
    <div className="space-y-5">
      <p className="text-center text-ink-soft">
        Sort them {timelineSource(universe).order}. Drag or use the arrows.
      </p>

      <ol className="space-y-2">
        {shown.map((id, i) => {
          const x = byId.get(id)!;
          // Feedback only while the order still matches the last locked-in one.
          const judged = done || last?.[i] === id;
          const ok = judged && correct[i] === id;
          const tone = !judged ? 'border-rule-strong bg-card' : ok ? 'border-hit/70 bg-hit/15' : 'border-miss/60 bg-miss/10';
          return (
            <li
              key={id}
              draggable={!done}
              onDragStart={() => setDragging(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragging !== null) move(dragging, i);
                setDragging(null);
              }}
              className={`flex items-center gap-3 rounded-xl border p-2.5 transition ${tone} ${!done ? 'cursor-grab active:cursor-grabbing' : ''} ${dragging === i ? 'opacity-50' : ''}`}
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-tile text-sm font-bold text-ink-soft">{i + 1}</span>
              <img src={x.image} alt="" draggable={false} className="size-12 shrink-0 rounded-lg border border-rule object-cover object-top" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{shownName(x.name)}</p>
                {done && <p className="animate-pop truncate text-xs text-ink-soft">{x.label}</p>}
              </div>
              {!done && (
                <div className="flex flex-col">
                  <button type="button" aria-label="Move up" onClick={() => move(i, i - 1)} className="px-2 text-ink-soft hover:text-ink disabled:opacity-20" disabled={i === 0}>
                    ▲
                  </button>
                  <button type="button" aria-label="Move down" onClick={() => move(i, i + 1)} className="px-2 text-ink-soft hover:text-ink disabled:opacity-20" disabled={i === shown.length - 1}>
                    ▼
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {!done && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-ink-soft">
            Attempt {record.guesses.length + 1} / {max}
          </span>
          <button type="button" onClick={submit} disabled={last?.join() === order.join()} className="btn-accent rounded-md px-5 py-2.5 font-display font-semibold tracking-wider">
            Lock in order
          </button>
        </div>
      )}

      {done && <SpOutcome won={record.status === 'won'} name="The right order" detail="Shown above, with each debut" />}
    </div>
  );
}

/** The Timeline round of one universe. */
export const timelineRoundFor = (universe: UniverseId): ComponentType<Props> =>
  function UniverseTimeline(props: Props) {
    return <TimelineRound universe={universe} {...props} />;
  };
