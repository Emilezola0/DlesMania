import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { MEMORY_DECKS, PAIRS_PER_GAME, dealBoard, memoryDeck, memoryScore, type MemoryCard, type MemoryDeck } from '../arcade/memory';
import { GlyphSeal } from '../components/Glyph';
import { celebrateBig } from '../lib/fx';
import { sfx } from '../lib/sfx';
import { useProgress } from '../store/progress';

/** How long two cards that don't match stay face up. */
const MISMATCH_MS = 900;

/** The card's number, top left on both sides ("the pair was 3 and 11"). */
function Num({ n, back }: { n: number; back?: boolean }) {
  return (
    <span
      className={`absolute left-1.5 top-1.5 z-10 grid min-w-6 place-items-center rounded px-1 font-display text-xs font-bold leading-6 shadow sm:text-sm ${back ? 'bg-paper text-ink' : 'bg-ink/80 text-paper'}`}
    >
      {n}
    </span>
  );
}

function Card({ card, n, up, found, onClick }: { card: MemoryCard; n: number; up: boolean; found: boolean; onClick: () => void }) {
  const f = card.face;
  return (
    <button type="button" onClick={onClick} disabled={up} className="aspect-[3/4] w-full [perspective:800px]" aria-label={up ? `${n}: ${f.caption}` : `Card ${n}`}>
      <div className={`relative size-full transition-transform duration-500 [transform-style:preserve-3d] ${up ? '[transform:rotateY(180deg)]' : ''}`}>
        {/* Back: the Omnidle seal. */}
        <div className="absolute inset-0 grid place-items-center rounded-lg border-2 border-rule-strong bg-ink/90 shadow-md [backface-visibility:hidden] hover:border-accent">
          <Num n={n} back />
          <GlyphSeal seed={card.key} size={40} tone="text-paper" />
        </div>
        {/* Face. */}
        <div
          className={`absolute inset-0 flex flex-col overflow-hidden rounded-lg border-2 bg-card shadow-md [backface-visibility:hidden] [transform:rotateY(180deg)] ${found ? 'border-hit' : 'border-accent'}`}
        >
          <Num n={n} />
          {f.image ? (
            <img src={f.image} alt="" draggable={false} className="min-h-0 flex-1 bg-tile object-cover object-top" />
          ) : (
            <p className="grid flex-1 place-items-center p-2 text-center font-serif text-sm font-bold leading-tight sm:text-base">{f.text}</p>
          )}
          {found && f.image && <p className="animate-pop truncate bg-hit/20 px-1 py-0.5 text-center text-[10px] font-semibold sm:text-xs">{f.caption}</p>}
        </div>
      </div>
    </button>
  );
}

function Board({ deck }: { deck: MemoryDeck }) {
  const key = `memory:${deck.id}`;
  const best = useProgress((s) => s.bests[key] ?? 0);
  const recordBest = useProgress((s) => s.recordBest);
  const [run, setRun] = useState(0);
  const cards = useMemo(() => dealBoard(deck), [deck, run]);
  const [open, setOpen] = useState<string[]>([]);
  const [found, setFound] = useState<string[]>([]);
  const [moves, setMoves] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const started = useRef(false);
  const done = found.length === PAIRS_PER_GAME;

  // The clock starts at the first flip and stops at the last pair.
  useEffect(() => {
    if (done) return;
    const t = window.setInterval(() => started.current && setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [done, run]);

  const flip = (c: MemoryCard) => {
    if (open.length === 2 || open.includes(c.key) || found.includes(c.pair)) return;
    started.current = true;
    sfx.click();
    const next = [...open, c.key];
    setOpen(next);
    if (next.length < 2) return;
    setMoves((m) => m + 1);
    const [a, b] = next.map((k) => cards.find((x) => x.key === k)!);
    if (a.pair === b.pair) {
      sfx.correct();
      const all = [...found, a.pair];
      setFound(all);
      setOpen([]);
      if (all.length === PAIRS_PER_GAME) {
        const points = memoryScore(moves + 1, seconds);
        recordBest(key, points, { won: true });
        window.setTimeout(() => (sfx.streak(), celebrateBig()), 400);
      }
    } else {
      window.setTimeout(() => setOpen([]), MISMATCH_MS);
    }
  };

  const again = () => {
    sfx.click();
    setRun((r) => r + 1);
    setOpen([]);
    setFound([]);
    setMoves(0);
    setSeconds(0);
    started.current = false;
  };

  const points = memoryScore(moves, seconds);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <p className="font-serif text-lg italic text-ink-soft">{deck.rule}</p>
        <p className="font-display text-sm text-ink-soft">
          Pairs <span className="font-serif text-xl font-bold text-ink">{found.length}/{PAIRS_PER_GAME}</span> · Flips <span className="font-serif text-xl font-bold text-ink">{moves}</span> ·{' '}
          <span className="font-serif text-xl font-bold tabular-nums text-ink">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</span>
        </p>
      </div>
      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        {cards.map((c, i) => (
          <Card key={`${run}-${c.key}`} card={c} n={i + 1} up={open.includes(c.key) || found.includes(c.pair)} found={found.includes(c.pair)} onClick={() => flip(c)} />
        ))}
      </div>
      {done && (
        <div className="animate-pop space-y-2 rounded-md border border-hit/50 bg-hit/10 p-5 text-center">
          <p className="font-display text-sm uppercase tracking-widest text-ink-soft">All pairs found</p>
          <p className="font-serif text-5xl font-bold">{points}</p>
          <p className="text-sm text-ink-soft">
            {moves} flips in {seconds} s · {points > best ? <span className="font-bold text-ochre">★ New best</span> : `best ${best}`}
          </p>
          <button type="button" onClick={again} className="btn-ink rounded-md px-6 py-3 font-display font-bold tracking-wider">
            New board
          </button>
        </div>
      )}
    </div>
  );
}

/** /memory and /memory/:deck */
export default function MemoryPairs() {
  const { deck: id } = useParams();
  const bests = useProgress((s) => s.bests);
  if (id) {
    const deck = memoryDeck(id);
    if (!deck) return <Navigate to="/memory" replace />;
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <Link to="/memory" className="font-display text-sm font-semibold tracking-wider text-ink-soft hover:text-ink">
            ← Memory Pairs
          </Link>
          <h1 className="text-4xl font-bold">
            {deck.icon} {deck.label}
          </h1>
        </div>
        <Board key={deck.id} deck={deck} />
      </div>
    );
  }
  return (
    <div className="space-y-8">
      <div>
        <Link to="/games" className="font-display text-sm font-semibold tracking-wider text-ink-soft hover:text-ink">
          ← Games
        </Link>
        <h1 className="text-5xl font-bold">Memory Pairs</h1>
        <p className="max-w-xl text-ink-soft">
          {PAIRS_PER_GAME} pairs face down: turn two cards at a time and find what goes together — a Devil Fruit and its user, a champion and their ultimate… Fewer flips, faster, more points.
        </p>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MEMORY_DECKS.map((d) => (
          <li key={d.id}>
            <Link to={`/memory/${d.id}`} className="page flex h-full flex-col gap-1 rounded-md p-5 ring-2 ring-accent/40 transition hover:-translate-y-0.5">
              <span className="text-3xl">{d.icon}</span>
              <span className="font-display text-xl font-bold">{d.label}</span>
              <span className="text-sm text-ink-soft">{d.rule}</span>
              <span className="mt-auto pt-3 text-xs text-ink-faint">
                {d.pairs.length} pairs{(bests[`memory:${d.id}`] ?? 0) > 0 ? ` · best ${bests[`memory:${d.id}`]}` : ''}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
