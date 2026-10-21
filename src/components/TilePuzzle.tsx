import { useEffect, useMemo, useState } from 'react';
import { mulberry32, shuffle } from '../lib/rng';
import { sfx } from '../lib/sfx';

const N = 3;
const COUNT = N * N;

interface Props {
  src: string;
  seed: number;
  /** Tiles snapped into place for the player — one per wrong guess. */
  assists: number;
  revealed: boolean;
  onError?: () => void;
}

interface Board {
  /** order[slot] = the tile shown in that slot. */
  order: number[];
  /** turns[tile] = quarter turns clockwise (0 = upright). */
  turns: number[];
}

/** A scrambled start: no tile in its home slot, and most tiles turned so cover text is hard to read. */
function scramble(seed: number): Board {
  const rand = mulberry32(seed);
  let order: number[];
  do order = shuffle([...Array(COUNT).keys()], rand);
  while (!order.every((tile, slot) => tile !== slot));
  let turns: number[];
  do turns = Array.from({ length: COUNT }, () => Math.floor(rand() * 4));
  while (turns.filter((t) => t !== 0).length < 6);
  return { order, turns };
}

const isHome = (b: Board, slot: number) => b.order[slot] === slot && b.turns[slot] === 0;

/**
 * A 3×3 puzzle cut from a cover. Tap two tiles to swap them; tap the same tile twice to rotate it.
 * Tiles that are home and upright get a small mark.
 */
export function TilePuzzle({ src, seed, assists, revealed, onError }: Props) {
  const initial = useMemo(() => scramble(seed), [seed]);
  const [board, setBoard] = useState<Board>(initial);
  const [picked, setPicked] = useState<number | null>(null);
  const [placedByHint, setPlacedByHint] = useState(0);
  const solved = board.order.every((_, slot) => isHome(board, slot));

  // Each wrong guess snaps the first wrong tile home, upright.
  useEffect(() => {
    if (assists <= placedByHint) return;
    setBoard((b) => {
      const order = [...b.order];
      const turns = [...b.turns];
      for (let k = placedByHint; k < assists; k++) {
        const slot = order.findIndex((tile, s) => tile !== s || turns[tile] !== 0);
        if (slot < 0) break;
        const from = order.indexOf(slot);
        [order[slot], order[from]] = [order[from], order[slot]];
        turns[slot] = 0;
      }
      return { order, turns };
    });
    setPlacedByHint(assists);
  }, [assists, placedByHint]);

  const tap = (slot: number) => {
    if (revealed || solved) return;
    if (picked === null) {
      setPicked(slot);
      sfx.select();
      return;
    }
    if (picked === slot) {
      // Second tap on the same tile: rotate it a quarter turn.
      const tile = board.order[slot];
      setBoard((b) => ({ ...b, turns: b.turns.map((t, i) => (i === tile ? (t + 1) % 4 : t)) }));
      sfx.click();
    } else {
      setBoard((b) => {
        const order = [...b.order];
        [order[picked], order[slot]] = [order[slot], order[picked]];
        return { ...b, order };
      });
      sfx.click();
    }
    setPicked(null);
  };

  const done = revealed || solved;
  const shown: Board = revealed ? { order: [...Array(COUNT).keys()], turns: Array(COUNT).fill(0) } : board;
  const inPlace = shown.order.filter((_, slot) => isHome(shown, slot)).length;

  return (
    <div className="space-y-3">
      <div
        className={`mx-auto grid aspect-square w-full max-w-sm grid-cols-3 overflow-hidden rounded-md border border-rule bg-tile transition-all ${done ? 'gap-0' : 'gap-1 p-1'}`}
        role="grid"
        aria-label="Cover puzzle"
      >
        {shown.order.map((tile, slot) => {
          const row = Math.floor(tile / N);
          const col = tile % N;
          const turn = shown.turns[tile];
          return (
            <button
              key={slot}
              type="button"
              onClick={() => tap(slot)}
              aria-label={`Tile ${slot + 1}${picked === slot ? ', selected — tap again to rotate' : ''}`}
              className={`relative overflow-hidden transition-[transform,box-shadow] duration-200 ${done ? '' : 'rounded-sm'} ${
                picked === slot ? 'z-10 scale-[0.94] ring-4 ring-accent' : 'hover:brightness-110'
              }`}
            >
              {/* The tile's piece of the cover, rotated as a whole. */}
              <span className="absolute inset-0 transition-transform duration-200" style={{ transform: `rotate(${turn * 90}deg)` }}>
                <img
                  src={src}
                  alt=""
                  draggable={false}
                  onError={onError}
                  className="pointer-events-none absolute max-w-none select-none object-cover"
                  style={{ width: `${N * 100}%`, height: `${N * 100}%`, left: `${-col * 100}%`, top: `${-row * 100}%` }}
                />
              </span>
              {isHome(shown, slot) && !done && <span className="absolute right-1 top-1 size-2 rounded-full bg-hit shadow ring-1 ring-card" />}
            </button>
          );
        })}
      </div>
      <p className="text-center font-display text-[11px] tracking-wider text-ink-faint">
        {done ? 'COVER RESTORED' : `TAP TWO TILES TO SWAP · TAP ONE TWICE TO ROTATE · ${inPlace}/${COUNT} IN PLACE`}
      </p>
    </div>
  );
}
