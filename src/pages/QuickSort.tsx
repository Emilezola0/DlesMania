import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { SORT_DECKS, SORT_LIVES, sortDeck, sortSeconds, type SortCard, type SortDeck } from '../arcade/quickSort';
import { HeartIcon } from '../boss/BossHeader';
import { celebrateBig, shake } from '../lib/fx';
import { useImagesReady } from '../lib/images';
import { shuffle } from '../lib/rng';
import { sfx } from '../lib/sfx';
import { useProgress } from '../store/progress';

function Game({ deck }: { deck: SortDeck }) {
  const key = `sort:${deck.id}`;
  const best = useProgress((s) => s.bests[key] ?? 0);
  const recordBest = useProgress((s) => s.recordBest);
  const queue = useRef<SortCard[]>([]);
  const draw = () => {
    if (!queue.current.length) queue.current = shuffle(deck.cards, Math.random);
    return queue.current.pop()!;
  };
  const [state, setState] = useState<'ready' | 'playing' | 'over'>('ready');
  const [card, setCard] = useState<SortCard>(() => draw());
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(SORT_LIVES);
  const [left, setLeft] = useState(1);
  const [flying, setFlying] = useState<'left' | 'right' | null>(null);
  const [last, setLast] = useState<{ card: SortCard; ok: boolean } | null>(null);
  const arena = useRef<HTMLDivElement>(null);
  const touch = useRef<number | null>(null);

  const finish = (s: number) => {
    setState('over');
    recordBest(key, s);
    if (s > best) window.setTimeout(() => (sfx.streak(), celebrateBig()), 300);
  };

  const sort = (side: 'left' | 'right' | null) => {
    if (state !== 'playing' || flying) return;
    const ok = side === card.side;
    setLast({ card, ok });
    if (ok) {
      sfx.correct();
      setScore((s) => s + 1);
    } else {
      sfx.wrong();
      shake(arena.current, 8, 300);
    }
    const lifeLeft = ok ? lives : lives - 1;
    setLives(lifeLeft);
    setFlying(side ?? card.side);
    window.setTimeout(() => {
      setFlying(null);
      if (lifeLeft <= 0) return finish(score + (ok ? 1 : 0));
      setCard(draw());
      setLeft(1);
    }, 220);
  };

  // The clock for the card on screen: when it runs out, it counts as a miss. It starts once the picture is there.
  const ready = useImagesReady([card?.image]);
  useEffect(() => {
    if (state !== 'playing' || flying || !ready) return;
    const total = sortSeconds(score) * 1000;
    const t0 = performance.now();
    const t = window.setInterval(() => {
      const f = 1 - (performance.now() - t0) / total;
      setLeft(Math.max(0, f));
      if (f <= 0) {
        window.clearInterval(t);
        sort(null);
      }
    }, 50);
    return () => window.clearInterval(t);
  }, [card, state, flying, ready]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') sort('left');
      if (e.key === 'ArrowRight') sort('right');
      if ((e.key === 'Enter' || e.key === ' ') && state !== 'playing') start();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const start = () => {
    sfx.click();
    queue.current = [];
    setCard(draw());
    setScore(0);
    setLives(SORT_LIVES);
    setLast(null);
    setLeft(1);
    setState('playing');
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {Array.from({ length: SORT_LIVES }, (_, i) => (
            <HeartIcon key={i} full={i < lives} className="size-6" />
          ))}
        </div>
        <p className="font-display text-sm text-ink-soft">
          Sorted <span className="font-serif text-2xl font-bold text-ink">{score}</span> · best {Math.max(best, state === 'over' ? score : 0)}
        </p>
      </div>

      <div
        ref={arena}
        className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-3"
        onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touch.current === null) return;
          const dx = e.changedTouches[0].clientX - touch.current;
          touch.current = null;
          if (Math.abs(dx) > 40) sort(dx < 0 ? 'left' : 'right');
        }}
      >
        <button type="button" onClick={() => sort('left')} className="btn-paper h-full min-h-40 rounded-lg px-2 font-display text-lg font-bold sm:text-xl">
          ← {deck.left}
        </button>
        <div className="w-40 sm:w-52">
          {state === 'playing' ? (
            <div
              key={card.id}
              className="page animate-round-in overflow-hidden rounded-lg transition-transform duration-200"
              style={{ transform: flying ? `translateX(${flying === 'left' ? '-140%' : '140%'}) rotate(${flying === 'left' ? -12 : 12}deg)` : undefined }}
            >
              <div className="aspect-square bg-tile">{card.image && <img src={card.image} alt="" draggable={false} className="size-full object-cover object-top" />}</div>
              <p className="truncate p-2 text-center font-display font-bold">{card.name}</p>
              <div className="h-1.5 bg-tile">
                <div className={`h-full ${left < 0.3 ? 'bg-coral' : 'bg-accent'}`} style={{ width: `${left * 100}%` }} />
              </div>
            </div>
          ) : (
            <div className="page space-y-3 rounded-lg p-4 text-center">
              {state === 'over' ? (
                <>
                  <p className="font-display text-sm uppercase tracking-widest text-ink-soft">Game over</p>
                  <p className="font-serif text-5xl font-bold">{score}</p>
                  <p className="text-xs text-ink-soft">{score > best ? '★ New best' : `Best ${best}`}</p>
                </>
              ) : (
                <p className="text-sm text-ink-soft">Send each card to its side before its bar runs out. ← → keys, the buttons, or swipe.</p>
              )}
              <button type="button" onClick={start} className="btn-ink rounded-md px-5 py-2.5 font-display font-bold tracking-wider">
                {state === 'over' ? 'Again' : 'Start'}
              </button>
            </div>
          )}
        </div>
        <button type="button" onClick={() => sort('right')} className="btn-paper h-full min-h-40 rounded-lg px-2 font-display text-lg font-bold sm:text-xl">
          {deck.right} →
        </button>
      </div>

      <p className="h-6 text-center text-sm font-semibold" aria-live="polite">
        {last && (
          <span key={last.card.id + score + lives} className={`animate-pop inline-block ${last.ok ? 'text-hit' : 'text-coral'}`}>
            {last.ok ? '✓' : '✗'} {last.card.name}: {last.card.fact}
          </span>
        )}
      </p>
    </div>
  );
}

/** /quick-sort and /quick-sort/:deck */
export default function QuickSort() {
  const { deck: id } = useParams();
  const bests = useProgress((s) => s.bests);
  if (id) {
    const deck = sortDeck(id);
    if (!deck) return <Navigate to="/quick-sort" replace />;
    return (
      <div className="space-y-6">
        <div className="mx-auto max-w-2xl">
          <Link to="/quick-sort" className="font-display text-sm font-semibold tracking-wider text-ink-soft hover:text-ink">
            ← Quick Sort
          </Link>
          <h1 className="text-4xl font-bold">
            {deck.icon} {deck.label}
          </h1>
        </div>
        <Game key={deck.id} deck={deck} />
      </div>
    );
  }
  return (
    <div className="space-y-8">
      <div>
        <Link to="/games" className="font-display text-sm font-semibold tracking-wider text-ink-soft hover:text-ink">
          ← Games
        </Link>
        <h1 className="text-5xl font-bold">Quick Sort</h1>
        <p className="max-w-xl text-ink-soft">Cards come one by one, faster and faster: send each to its side before its time runs out. Three mistakes and it&apos;s over.</p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SORT_DECKS.map((d) => (
          <li key={d.id}>
            <Link to={`/quick-sort/${d.id}`} className="page flex h-full flex-col gap-1 rounded-md p-5 ring-2 ring-accent/40 transition hover:-translate-y-0.5">
              <span className="text-3xl">{d.icon}</span>
              <span className="font-display text-lg font-bold">{d.label}</span>
              <span className="text-xs text-ink-faint">
                {d.cards.length} cards{(bests[`sort:${d.id}`] ?? 0) > 0 ? ` · best ${bests[`sort:${d.id}`]}` : ''}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
