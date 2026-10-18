import { useMemo, useState } from 'react';
import { Outcome } from '../components/Outcome';
import { connectionsPuzzles } from '../data';
import { mulberry32, shuffle } from '../lib/rng';
import { scoreFor } from '../lib/scoring';
import type { GameProps } from '../types';
import { GAME_META } from './meta';

const GROUP_COLORS = [
  'bg-yellow-400 text-yellow-950',
  'bg-emerald-400 text-emerald-950',
  'bg-sky-400 text-sky-950',
  'bg-fuchsia-400 text-fuchsia-950',
];

/** Tile ids are "<group>-<index>", so the group of a tile is its prefix. */
const groupOf = (tileId: string) => Number(tileId.split('-')[0]);

export default function ConnectionsGame({ spec, record, onChange }: GameProps) {
  const puzzle = connectionsPuzzles.find((p) => p.id === spec.puzzleId)!;
  const maxMistakes = GAME_META.connections.maxAttempts;
  const label = (id: string) => puzzle.groups[groupOf(id)].items[Number(id.split('-')[1])];

  const allTiles = useMemo(() => puzzle.groups.flatMap((g, gi) => g.items.map((_, i) => `${gi}-${i}`)), [puzzle]);
  const [order, setOrder] = useState(() => shuffle(allTiles, mulberry32(spec.seed)));
  const [selected, setSelected] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);

  const attempts = record.guesses.map((g) => g.split('|'));
  const solved = attempts.filter((a) => new Set(a.map(groupOf)).size === 1).map((a) => groupOf(a[0]));
  const mistakes = attempts.length - solved.length;
  const done = record.status !== 'playing';
  const revealedGroups = done ? [...solved, ...puzzle.groups.map((_, i) => i).filter((i) => !solved.includes(i))] : solved;
  const remaining = order.filter((t) => !revealedGroups.includes(groupOf(t)));

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1600);
  };

  const toggle = (id: string) => {
    if (done) return;
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length < 4 ? [...s, id] : s));
  };

  const submit = () => {
    const key = [...selected].sort().join('|');
    if (record.guesses.includes(key)) return flash('Already guessed!');
    const guesses = [...record.guesses, key];
    const groups = selected.map(groupOf);
    const isCorrect = new Set(groups).size === 1;
    const newSolved = solved.length + (isCorrect ? 1 : 0);
    const newMistakes = mistakes + (isCorrect ? 0 : 1);

    if (!isCorrect) {
      const counts = groups.reduce<Record<number, number>>((m, g) => ({ ...m, [g]: (m[g] ?? 0) + 1 }), {});
      flash(Object.values(counts).includes(3) ? 'One away…' : 'Not quite');
      setShakeKey((k) => k + 1);
    }
    setSelected(isCorrect ? [] : selected);

    const won = newSolved === 4;
    const lost = newMistakes >= maxMistakes;
    onChange({
      status: won ? 'won' : lost ? 'lost' : 'playing',
      guesses,
      score: won ? scoreFor('connections', guesses.length, newMistakes) : lost ? newSolved * 10 : 0,
    });
  };

  return (
    <div className="space-y-5">
      <p className="text-center text-zinc-300">Create four groups of four. Categories span games, anime, film and music.</p>

      <div className="relative space-y-2">
        {toast && (
          <div className="animate-pop absolute -top-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-zinc-900 shadow-lg">
            {toast}
          </div>
        )}

        {revealedGroups.map((gi) => (
          <div key={gi} className={`animate-pop rounded-xl px-4 py-3 text-center ${GROUP_COLORS[gi]}`}>
            <p className="text-sm font-black uppercase tracking-wide">{puzzle.groups[gi].label}</p>
            <p className="text-sm">{puzzle.groups[gi].items.join(', ')}</p>
          </div>
        ))}

        <div key={shakeKey} className={`grid grid-cols-4 gap-2 ${shakeKey ? 'animate-shake' : ''}`}>
          {remaining.map((id) => {
            const on = selected.includes(id);
            return (
              <button
                key={id}
                type="button"
                onClick={() => toggle(id)}
                className={`flex min-h-16 items-center justify-center rounded-xl px-1.5 py-2 text-center text-xs font-bold uppercase leading-tight transition sm:min-h-20 sm:text-sm ${
                  on ? 'scale-[0.97] bg-zinc-200 text-zinc-900' : 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700'
                }`}
              >
                {label(id)}
              </button>
            );
          })}
        </div>
      </div>

      {!done && (
        <>
          <div className="flex items-center justify-center gap-2 text-sm text-zinc-400">
            Mistakes remaining:
            {Array.from({ length: maxMistakes }, (_, i) => (
              <span key={i} className={`size-3 rounded-full ${i < maxMistakes - mistakes ? 'bg-zinc-300' : 'bg-zinc-700'}`} />
            ))}
          </div>
          <div className="flex justify-center gap-2">
            <button type="button" onClick={() => setOrder((o) => shuffle(o, Math.random))} className="rounded-full border border-zinc-600 px-4 py-2 text-sm font-semibold hover:bg-zinc-800">
              Shuffle
            </button>
            <button type="button" onClick={() => setSelected([])} disabled={!selected.length} className="rounded-full border border-zinc-600 px-4 py-2 text-sm font-semibold hover:bg-zinc-800 disabled:opacity-40">
              Deselect
            </button>
            <button type="button" onClick={submit} disabled={selected.length !== 4} className="rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold hover:bg-indigo-500 disabled:opacity-40">
              Submit
            </button>
          </div>
        </>
      )}

      <Outcome record={record} answerLabel={done ? `${solved.length} / 4 groups found` : undefined} />
    </div>
  );
}
