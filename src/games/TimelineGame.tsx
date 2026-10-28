import { useState } from 'react';
import { Outcome } from '../components/Outcome';
import { domainInfo, getWork } from '../data';
import { shownName } from '../lib/french';
import { mulberry32, shuffle } from '../lib/rng';
import { scoreFor } from '../lib/scoring';
import type { GameProps } from '../types';
import { GAME_META } from './meta';

export default function TimelineGame({ spec, record, onChange }: GameProps) {
  const ids = spec.workIds!;
  const correct = [...ids].sort((a, b) => getWork(a).year - getWork(b).year);
  const max = GAME_META.timeline.maxAttempts;
  const done = record.status !== 'playing';
  const last = record.guesses.at(-1)?.split(',');

  const [order, setOrder] = useState<string[]>(() => {
    if (last) return last;
    const rand = mulberry32(spec.seed);
    let o = shuffle(ids, rand);
    while (o.join() === correct.join()) o = shuffle(ids, rand);
    return o;
  });
  const [dragging, setDragging] = useState<number | null>(null);

  const shown = done ? correct : order;

  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length || done) return;
    const next = [...order];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    setOrder(next);
  };

  const submit = () => {
    const guesses = [...record.guesses, order.join(',')];
    const won = order.join() === correct.join();
    const status = won ? 'won' : guesses.length >= max ? 'lost' : 'playing';
    onChange({ status, guesses, score: won ? scoreFor('timeline', guesses.length) : 0 });
  };

  const domainLabel = spec.domain === 'mixed' ? 'works' : `${domainInfo(spec.domain).noun}s`;

  return (
    <div className="space-y-5">
      <p className="text-center text-ink-soft">
        Sort these {domainLabel} from <span className="font-semibold text-ink">oldest</span> to{' '}
        <span className="font-semibold text-ink">newest</span>. Drag or use the arrows.
      </p>

      <ol className="space-y-2">
        {shown.map((id, i) => {
          const w = getWork(id);
          // Feedback only applies while the order still matches the last submission.
          const judged = done || (last && last[i] === id);
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
              className={`flex items-center gap-3 rounded-xl border p-3 transition ${tone} ${!done ? 'cursor-grab active:cursor-grabbing' : ''} ${dragging === i ? 'opacity-50' : ''}`}
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-tile text-sm font-bold text-ink-soft">
                {i + 1}
              </span>
              <span className="text-2xl">{w.visual?.icon ?? '🎞️'}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{shownName(w.name)}</p>
                <p className="text-xs text-ink-soft">{w.subtitle ?? w.studio}</p>
              </div>
              {done ? (
                <span className="font-mono text-lg font-bold text-ink">{w.year}</span>
              ) : (
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
          <button
            type="button"
            onClick={submit}
            disabled={last?.join() === order.join()}
            className="btn-accent rounded-md px-5 py-2.5 font-display font-semibold tracking-wider"
          >
            Lock in order
          </button>
        </div>
      )}

      <Outcome record={record} answerLabel={done ? 'Correct order revealed above' : undefined} />
    </div>
  );
}
