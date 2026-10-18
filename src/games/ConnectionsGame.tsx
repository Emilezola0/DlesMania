import { useMemo, useState } from 'react';
import { Outcome } from '../components/Outcome';
import { connectionsPuzzles } from '../data';
import { mulberry32, shuffle } from '../lib/rng';
import { scoreFor } from '../lib/scoring';
import { sfx } from '../lib/sfx';
import type { ConnectionsLevel, GameProps } from '../types';
import { GAME_META } from './meta';

/** NYT-style difficulty colours: yellow → green → blue → purple. */
export const LEVEL_STYLE: Record<ConnectionsLevel, { tile: string; emoji: string; name: string }> = {
  0: { tile: 'bg-yellow-300 text-yellow-950', emoji: '🟨', name: 'Straightforward' },
  1: { tile: 'bg-emerald-400 text-emerald-950', emoji: '🟩', name: 'Medium' },
  2: { tile: 'bg-sky-400 text-sky-950', emoji: '🟦', name: 'Hard' },
  3: { tile: 'bg-violet-400 text-violet-950', emoji: '🟪', name: 'Tricky' },
};

/** Tile ids are "<group>-<index>", so the group of a tile is its prefix. */
const groupOf = (tileId: string) => Number(tileId.split('-')[0]);

export default function ConnectionsGame({ spec, record, onChange }: GameProps) {
  const puzzle = connectionsPuzzles.find((p) => p.id === spec.puzzleId)!;
  const maxMistakes = GAME_META.connections.maxAttempts;
  const tile = (id: string) => puzzle.groups[groupOf(id)].items[Number(id.split('-')[1])];
  // Pictures only when every tile has one: a lone text tile would give its group away.
  const [brokenImage, setBrokenImage] = useState(false);
  const withImages = !brokenImage && puzzle.groups.every((grp) => grp.items.every((t) => t.image));

  const allTiles = useMemo(() => puzzle.groups.flatMap((grp, gi) => grp.items.map((_, i) => `${gi}-${i}`)), [puzzle]);
  const [order, setOrder] = useState(() => shuffle(allTiles, mulberry32(spec.seed)));
  const [selected, setSelected] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [hopping, setHopping] = useState(false);

  const attempts = record.guesses.map((guess) => guess.split('|'));
  const solved = attempts.filter((a) => new Set(a.map(groupOf)).size === 1).map((a) => groupOf(a[0]));
  const mistakes = attempts.length - solved.length;
  const done = record.status !== 'playing';
  // Solved groups in the order found; when the round is lost, reveal the rest from easiest to hardest.
  const unsolved = puzzle.groups.map((_, i) => i).filter((i) => !solved.includes(i)).sort((a, b) => puzzle.groups[a].level - puzzle.groups[b].level);
  const revealedGroups = done ? [...solved, ...unsolved] : solved;
  const remaining = order.filter((t) => !revealedGroups.includes(groupOf(t)));

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1600);
  };

  const toggle = (id: string) => {
    if (done || hopping) return;
    if (!selected.includes(id) && selected.length >= 4) return;
    sfx.select();
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  const submit = () => {
    const key = [...selected].sort().join('|');
    if (record.guesses.includes(key)) return flash('Already guessed!');
    // Selected tiles hop one after another before the verdict lands.
    setHopping(true);
    window.setTimeout(() => {
      setHopping(false);
      const guesses = [...record.guesses, key];
      const groups = selected.map(groupOf);
      const isCorrect = new Set(groups).size === 1;
      const newSolved = solved.length + (isCorrect ? 1 : 0);
      const newMistakes = mistakes + (isCorrect ? 0 : 1);
      const won = newSolved === 4;
      const lost = newMistakes >= maxMistakes;

      if (isCorrect) {
        if (!won) sfx.correct();
        setSelected([]);
      } else {
        const counts = groups.reduce<Record<number, number>>((m, x) => ({ ...m, [x]: (m[x] ?? 0) + 1 }), {});
        const oneAway = Object.values(counts).includes(3);
        flash(oneAway ? 'One away…' : 'Not quite');
        if (!lost) (oneAway ? sfx.near : sfx.wrong)();
        setShakeKey((k) => k + 1);
      }

      onChange({
        status: won ? 'won' : lost ? 'lost' : 'playing',
        guesses,
        score: won ? scoreFor('connections', guesses.length, newMistakes) : lost ? newSolved * 10 : 0,
      });
    }, 4 * 90 + 250);
  };

  return (
    <div className="space-y-5">
      {puzzle.theme ? (
        <p className="text-center text-zinc-300">
          Every tile comes from <span className="font-semibold text-white">{puzzle.theme}</span>. Find four groups of four.
        </p>
      ) : (
        <p className="text-center text-zinc-300">Create four groups of four.</p>
      )}

      <div className="relative space-y-2">
        {toast && (
          <div className="animate-pop absolute -top-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-zinc-900 shadow-lg">
            {toast}
          </div>
        )}

        {revealedGroups.map((gi) => {
          const grp = puzzle.groups[gi];
          return (
            <div key={gi} className={`animate-pop rounded-xl px-4 py-3 text-center shadow-lg ${LEVEL_STYLE[grp.level].tile}`}>
              {withImages && (
                <div className="mb-2 flex justify-center gap-2">
                  {grp.items.map((t) => (
                    <img key={t.label} src={t.image} alt="" className="size-10 rounded-lg bg-white/30 object-cover shadow sm:size-12" />
                  ))}
                </div>
              )}
              <p className="text-sm font-black uppercase tracking-wide">{grp.label}</p>
              <p className="text-sm">{grp.items.map((t) => t.label).join(', ')}</p>
            </div>
          );
        })}

        <div key={shakeKey} className={`mx-auto grid grid-cols-4 gap-2 ${withImages ? 'max-w-lg' : ''} ${shakeKey ? 'animate-shake' : ''}`}>
          {remaining.map((id) => {
            const on = selected.includes(id);
            const hopIndex = selected.indexOf(id);
            const t = tile(id);
            return (
              <button
                key={id}
                type="button"
                onClick={() => toggle(id)}
                style={hopping && on ? { animationDelay: `${hopIndex * 90}ms` } : undefined}
                className={`flex flex-col items-center justify-center gap-1.5 overflow-hidden rounded-xl text-center font-bold uppercase leading-tight transition-all duration-150 ${
                  withImages ? 'p-1.5 pb-2 text-[10px] sm:text-xs' : 'min-h-16 px-1.5 py-2 text-xs sm:min-h-20 sm:text-sm'
                } ${
                  on
                    ? '-translate-y-0.5 scale-[0.97] bg-zinc-100 text-zinc-900 shadow-lg shadow-indigo-500/20'
                    : 'bg-zinc-800 text-zinc-100 hover:-translate-y-0.5 hover:bg-zinc-700'
                } ${hopping && on ? 'animate-lift' : ''}`}
              >
                {withImages && (
                  <img
                    src={t.image}
                    alt=""
                    draggable={false}
                    onError={() => setBrokenImage(true)}
                    className={`aspect-square w-full rounded-lg object-cover transition ${on ? 'ring-2 ring-indigo-500' : ''}`}
                  />
                )}
                <span className="line-clamp-2">{t.label}</span>
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
              <span
                key={i}
                className={`size-3 rounded-full transition-all duration-300 ${i < maxMistakes - mistakes ? 'bg-zinc-300' : 'scale-50 bg-zinc-700'}`}
              />
            ))}
          </div>
          <div className="flex justify-center gap-2">
            <button
              type="button"
              onClick={() => {
                sfx.click();
                setOrder((o) => shuffle(o, Math.random));
              }}
              className="rounded-full border border-zinc-600 px-4 py-2 text-sm font-semibold hover:bg-zinc-800"
            >
              Shuffle
            </button>
            <button type="button" onClick={() => setSelected([])} disabled={!selected.length} className="rounded-full border border-zinc-600 px-4 py-2 text-sm font-semibold hover:bg-zinc-800 disabled:opacity-40">
              Deselect
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={selected.length !== 4 || hopping}
              className="rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold hover:bg-indigo-500 disabled:opacity-40"
            >
              Submit
            </button>
          </div>
          <div className="flex flex-wrap justify-center gap-3 text-[11px] text-zinc-500">
            {([0, 1, 2, 3] as const).map((lv) => (
              <span key={lv} className="flex items-center gap-1">
                <i className={`size-2.5 rounded-sm ${LEVEL_STYLE[lv].tile}`} /> {LEVEL_STYLE[lv].name}
              </span>
            ))}
          </div>
        </>
      )}

      <Outcome record={record} answerLabel={done ? `${solved.length} / 4 groups found` : undefined} />
    </div>
  );
}
