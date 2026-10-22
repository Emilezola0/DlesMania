import { useMemo, useState } from 'react';
import { mulberry32, shuffle } from '../lib/rng';
import { sfx } from '../lib/sfx';

const N = 3;
const COUNT = N * N;

interface Props {
  src: string;
  seed: number;
  /** Wrong guesses so far: each one eases the tiles' effects. */
  misses: number;
  /** Guesses allowed; the effects are at their lightest on the last one. */
  maxMisses: number;
  revealed: boolean;
  onError?: () => void;
}

/** How one tile is disguised at full strength. */
interface TileFx {
  hue: number;
  invert: boolean;
  mirror: boolean;
  blur: number;
}

/** Each tile gets its own colour shift and blur; about half are inverted, about half mirrored (no rotation undoes that). */
function drawFx(seed: number): TileFx[] {
  const rand = mulberry32(seed ^ 0x5eed);
  return Array.from({ length: COUNT }, () => ({
    hue: 90 + Math.floor(rand() * 180),
    invert: rand() < 0.45,
    mirror: rand() < 0.5,
    blur: 1.5 + rand() * 2,
  }));
}

/** The CSS for a tile at a given strength (1 = start, 0 = clean). Mirroring goes after 3 misses, inversion after 2. */
function tileStyle(fx: TileFx, strength: number, misses: number) {
  const invert = fx.invert && misses < 2 ? ' invert(1)' : '';
  return {
    filter: `hue-rotate(${Math.round(fx.hue * strength)}deg) saturate(${1 + strength}) contrast(${1 + strength * 0.3}) blur(${(fx.blur * strength).toFixed(2)}px)${invert}`,
    mirror: fx.mirror && misses < 3,
  };
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

/**
 * A 3×3 puzzle cut from a cover, each tile colour-shifted, blurred and maybe inverted or mirrored.
 * Tap two tiles to swap them; tap the same tile twice to rotate it. Rebuilding it doesn't win —
 * naming the work does — and nothing marks a tile as in place.
 */
export function TilePuzzle({ src, seed, misses, maxMisses, revealed, onError }: Props) {
  const initial = useMemo(() => scramble(seed), [seed]);
  const fx = useMemo(() => drawFx(seed), [seed]);
  const [board, setBoard] = useState<Board>(initial);
  const [picked, setPicked] = useState<number | null>(null);
  const strength = revealed ? 0 : Math.max(0.15, 1 - misses / Math.max(1, maxMisses - 1));

  const tap = (slot: number) => {
    if (revealed) return;
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

  const done = revealed;
  const shown: Board = revealed ? { order: [...Array(COUNT).keys()], turns: Array(COUNT).fill(0) } : board;

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
          const look = tileStyle(fx[tile], strength, done ? Infinity : misses);
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
              <span
                className="absolute inset-0 transition-[transform,filter] duration-500"
                style={{ transform: `rotate(${turn * 90}deg)${look.mirror ? ' scaleX(-1)' : ''}`, filter: look.filter }}
              >
                <img
                  src={src}
                  alt=""
                  draggable={false}
                  onError={onError}
                  className="pointer-events-none absolute max-w-none select-none object-cover"
                  style={{ width: `${N * 100}%`, height: `${N * 100}%`, left: `${-col * 100}%`, top: `${-row * 100}%` }}
                />
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-center font-display text-[11px] tracking-wider text-ink-faint">
        {done ? 'THE COVER' : 'TAP TWO TILES TO SWAP · TAP ONE TWICE TO ROTATE · EACH MISS CLEARS THE PIECES A LITTLE'}
      </p>
    </div>
  );
}
