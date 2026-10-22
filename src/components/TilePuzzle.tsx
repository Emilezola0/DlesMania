import { useMemo, useState } from 'react';
import { mulberry32, shuffle } from '../lib/rng';
import { sfx } from '../lib/sfx';

const N = 3;
const COUNT = N * N;
/** Pieces that get their true look back with each wrong guess. */
const CLEARED_PER_MISS = 2;

interface Props {
  src: string;
  seed: number;
  /** Wrong guesses so far: each one gives CLEARED_PER_MISS pieces their true look back. */
  misses: number;
  revealed: boolean;
  onError?: () => void;
}

/** How one tile is disguised until it's cleared. */
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

/** The CSS for a disguised tile, or none once it's cleared. */
function tileStyle(fx: TileFx, cleared: boolean) {
  if (cleared) return { filter: 'none', mirror: false };
  return {
    filter: `hue-rotate(${fx.hue}deg) saturate(2) contrast(1.3) blur(${fx.blur.toFixed(2)}px)${fx.invert ? ' invert(1)' : ''}`,
    mirror: fx.mirror,
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
 * A piece keeps its disguise wherever it's moved; each wrong guess clears a couple of pieces, in
 * an order fixed by the seed. Tap two tiles to swap them; tap the same tile twice to rotate it.
 * Rebuilding it doesn't win — naming the work does — and nothing marks a tile as in place.
 */
export function TilePuzzle({ src, seed, misses, revealed, onError }: Props) {
  const initial = useMemo(() => scramble(seed), [seed]);
  const fx = useMemo(() => drawFx(seed), [seed]);
  const clearOrder = useMemo(() => shuffle([...Array(COUNT).keys()], mulberry32(seed ^ 0xc1ea)), [seed]);
  const cleared = new Set(revealed ? clearOrder : clearOrder.slice(0, misses * CLEARED_PER_MISS));
  const [board, setBoard] = useState<Board>(initial);
  const [picked, setPicked] = useState<number | null>(null);

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
          const look = tileStyle(fx[tile], cleared.has(tile));
          return (
            // Keyed by piece, so a moved piece takes its own look along instead of fading into the slot's.
            <button
              key={tile}
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
        {done ? 'THE COVER' : `TAP TWO TILES TO SWAP · TAP ONE TWICE TO ROTATE · EACH MISS RESTORES ${CLEARED_PER_MISS} PIECES · ${cleared.size}/${COUNT} RESTORED`}
      </p>
    </div>
  );
}
