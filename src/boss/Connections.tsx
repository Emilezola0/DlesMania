import { useState } from 'react';
import { shownName } from '../lib/french';
import { sfx } from '../lib/sfx';
import type { DifficultySpec } from '../lib/boss';
import type { PhaseResult } from '../types';
import { pairRight, type ConnectionsBoard } from './connections';
import { TimerBar } from './TimerBar';

interface Props {
  board: ConnectionsBoard;
  difficulty: DifficultySpec;
  onEvent: (good: boolean) => void;
  /** A wrong board submitted: a heart lost, the board stays (false: no hearts left, the fight is over). */
  onMiss: () => boolean;
  onDone: (result: PhaseResult) => void;
}

/** Where a word sits: under a face (face, slot) or still in the bank. */
type Spot = { face: number; slot: 0 | 1 } | null;

/**
 * Phase V (Hell), Connections: five faces, two empty slots under each, and the ten words that fill them —
 * every word fits one face only. Tap a word, then a slot (or drag it there); tap a placed word to send it
 * back. Submit when every slot is full: right, the phase is won; wrong, a heart is lost and the board stays,
 * with how many words are right. The clock running out loses the round.
 */
export function Connections({ board, difficulty: d, onEvent, onMiss, onDone }: Props) {
  const [spots, setSpots] = useState<Map<string, Spot>>(() => new Map(board.bank.map((w) => [w, null])));
  const [held, setHeld] = useState<string | null>(null);
  const [misses, setMisses] = useState(0);
  const [note, setNote] = useState<{ text: string; key: number } | null>(null);
  const [over, setOver] = useState(false);
  const seconds = d.connections?.seconds ?? 100;

  const wordAt = (face: number, slot: 0 | 1) => [...spots].find(([, s]) => s?.face === face && s.slot === slot)?.[0] ?? null;
  const bank = board.bank.filter((w) => !spots.get(w));
  const full = bank.length === 0;

  const place = (word: string, face: number, slot: 0 | 1) => {
    if (over) return;
    sfx.click();
    const next = new Map(spots);
    // A word already in that slot goes back to the bank.
    const there = wordAt(face, slot);
    if (there) next.set(there, null);
    next.set(word, { face, slot });
    setSpots(next);
    setHeld(null);
  };
  const tapSlot = (face: number, slot: 0 | 1) => {
    const there = wordAt(face, slot);
    if (held) return place(held, face, slot);
    if (there) {
      // Back to the bank.
      sfx.select();
      setSpots(new Map(spots).set(there, null));
    }
  };

  const finish = (won: boolean) => {
    if (over) return;
    setOver(true);
    const right = board.pairs.filter((p, i) => pairRight(p, [wordAt(i, 0), wordAt(i, 1)])).length;
    onDone({
      won,
      correct: right * 2,
      wrong: misses,
      missed: won ? undefined : board.pairs.map((p) => `${shownName(p.card.label)}: ${p.words.join(' · ')}`),
    });
  };

  const submit = () => {
    if (!full || over) return;
    const right = board.pairs.reduce((n, p, i) => n + (pairRight(p, [wordAt(i, 0), wordAt(i, 1)]) ? 2 : [wordAt(i, 0), wordAt(i, 1)].filter((w) => w && p.words.includes(w)).length), 0);
    if (right === board.bank.length) {
      sfx.streak();
      onEvent(true);
      return finish(true);
    }
    // Wrong: a heart, and how many words are right (not which).
    setMisses((m) => m + 1);
    setNote({ text: `${right} of ${board.bank.length} words in the right place — not yet.`, key: Date.now() });
    if (!onMiss()) setOver(true);
  };

  return (
    <div className="space-y-4">
      <TimerBar total={seconds * 1000} running={!over} onExpire={() => finish(false)} intense />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {board.pairs.map((p, i) => (
          <div key={p.card.label} className="space-y-1.5 rounded-md border border-rule-strong bg-card p-2">
            <div className="aspect-square overflow-hidden rounded bg-tile">
              <img src={p.card.image} alt="" draggable={false} className="size-full object-contain" />
            </div>
            {([0, 1] as const).map((slot) => {
              const w = wordAt(i, slot);
              return (
                <button
                  key={slot}
                  type="button"
                  disabled={over}
                  onClick={() => tapSlot(i, slot)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const word = e.dataTransfer.getData('text/plain');
                    if (word) place(word, i, slot);
                  }}
                  className={`flex min-h-10 w-full items-center justify-center rounded border-2 px-1.5 py-1 text-center text-xs font-semibold leading-tight ${w ? 'border-ink bg-paper' : held ? 'border-dashed border-accent bg-accent/10' : 'border-dashed border-rule'}`}
                >
                  {w ? shownName(w) : <span className="text-ink-faint">—</span>}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex min-h-12 flex-wrap justify-center gap-2 rounded-md border border-rule bg-tile/40 p-2">
        {bank.map((w) => (
          <button
            key={w}
            type="button"
            draggable
            onDragStart={(e) => (e.dataTransfer.setData('text/plain', w), setHeld(w))}
            onClick={() => (sfx.select(), setHeld(held === w ? null : w))}
            className={`rounded-full border-2 px-3 py-1.5 text-sm font-semibold ${held === w ? 'border-ink bg-ink text-paper' : 'border-rule-strong bg-card hover:border-ink'}`}
          >
            {shownName(w)}
          </button>
        ))}
        {full && <span className="self-center text-sm text-ink-faint">Every word is placed.</span>}
      </div>
      <div className="flex flex-col items-center gap-2">
        <button type="button" onClick={submit} disabled={!full || over} className="btn-accent rounded-md px-8 py-3 font-display text-lg font-bold tracking-wider disabled:opacity-40">
          Submit
        </button>
        {note && (
          <p key={note.key} className="animate-pop text-sm font-semibold text-coral">
            {note.text} {misses > 0 && `(−${misses} ♥)`}
          </p>
        )}
        <p className="text-xs text-ink-faint">Tap a word, then a slot (or drag it) · tap a placed word to take it back · a wrong board costs a heart.</p>
      </div>
    </div>
  );
}
