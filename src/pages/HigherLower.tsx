import { useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { FlameIcon } from '../components/Layout';
import { HL_DECKS, hlDeck, nextItem, type HlDeck, type HlItem } from '../arcade/higherLower';
import { celebrateBig, shake } from '../lib/fx';
import { sfx } from '../lib/sfx';
import { useProgress } from '../store/progress';

/** How long the revealed value stays before the next pair. */
const REVEAL_MS = 1100;
/** Items not drawn again within this many turns. */
const MEMORY = 30;

function ItemCard({ item, value, side }: { item: HlItem; value: 'shown' | 'hidden' | 'revealing'; side: 'left' | 'right' }) {
  return (
    <div key={item.id} className={`page flex flex-col items-center gap-3 rounded-md p-4 text-center sm:p-6 ${side === 'right' ? 'animate-round-in' : ''}`}>
      <div className="aspect-square w-full max-w-[12rem] overflow-hidden rounded-lg bg-tile">
        {/* Black and white: colours (a red coat, a flag) give too much away. The card being judged gets its colours back once revealed. */}
        {item.image && (
          <img
            src={item.image}
            alt=""
            draggable={false}
            className={`size-full object-cover object-top transition-[filter] duration-700 ${value === 'revealing' ? 'grayscale-0' : 'grayscale'}`}
          />
        )}
      </div>
      <div className="min-h-14">
        <p className="font-display text-lg font-bold leading-tight sm:text-xl">{item.name}</p>
        {item.detail && <p className="text-xs text-ink-faint">{item.detail}</p>}
      </div>
      <p className={`font-serif text-2xl font-bold tabular-nums sm:text-3xl ${value === 'revealing' ? 'animate-pop text-accent' : ''}`}>{value === 'hidden' ? '?' : item.shown}</p>
    </div>
  );
}

function Game({ deck }: { deck: HlDeck }) {
  const best = useProgress((s) => s.bests[`hl:${deck.id}`] ?? 0);
  const recordBest = useProgress((s) => s.recordBest);
  const recent = useRef<string[]>([]);
  const draw = (current?: HlItem) => {
    const x = nextItem(deck, current, new Set(recent.current));
    recent.current = [x.id, ...recent.current].slice(0, MEMORY);
    return x;
  };
  const [left, setLeft] = useState(() => draw());
  const [right, setRight] = useState(() => draw(left));
  const [score, setScore] = useState(0);
  const [state, setState] = useState<'guess' | 'right' | 'wrong'>('guess');
  const arena = useRef<HTMLDivElement>(null);

  const guess = (higher: boolean) => {
    if (state !== 'guess') return;
    // A tie is right either way.
    const ok = right.value === left.value || (right.value > left.value) === higher;
    if (ok) {
      sfx.correct();
      setState('right');
      const next = score + 1;
      setScore(next);
      window.setTimeout(() => {
        setLeft(right);
        setRight(draw(right));
        setState('guess');
      }, REVEAL_MS);
    } else {
      sfx.wrong();
      shake(arena.current, 10, 420);
      setState('wrong');
      if (score > best) window.setTimeout(() => (sfx.streak(), celebrateBig()), 500);
      recordBest(`hl:${deck.id}`, score);
    }
  };

  const restart = () => {
    sfx.click();
    const l = draw();
    setLeft(l);
    setRight(draw(l));
    setScore(0);
    setState('guess');
  };

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <p className="font-serif text-lg italic text-ink-soft">{deck.question}</p>
        <p className="font-display text-sm text-ink-soft">
          Streak <span className="font-serif text-2xl font-bold text-ink">{score}</span> · best {Math.max(best, state === 'wrong' ? score : 0)}
        </p>
      </div>
      <div ref={arena} className="relative grid grid-cols-2 gap-3 sm:gap-6">
        <ItemCard item={left} value="shown" side="left" />
        <ItemCard item={right} value={state === 'guess' ? 'hidden' : 'revealing'} side="right" />
        <span className="absolute left-1/2 top-[38%] grid size-11 -translate-x-1/2 place-items-center rounded-full border border-rule-strong bg-paper font-display text-sm font-bold shadow">
          VS
        </span>
      </div>
      {state === 'wrong' ? (
        <div className="animate-pop space-y-3 rounded-md border border-miss/50 bg-miss/10 p-5 text-center">
          <p className="font-display text-sm uppercase tracking-widest text-ink-soft">Streak over</p>
          <p className="font-serif text-5xl font-bold">{score}</p>
          {score > best ? <p className="font-display text-sm font-bold text-ochre">★ New best</p> : <p className="text-sm text-ink-soft">Best: {best}</p>}
          <button type="button" onClick={restart} className="btn-ink rounded-md px-6 py-3 font-display font-bold tracking-wider">
            Play again
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <button type="button" disabled={state !== 'guess'} onClick={() => guess(true)} className="btn-accent rounded-md py-3 font-display font-bold tracking-wider">
            ▲ {deck.higher}
          </button>
          <button type="button" disabled={state !== 'guess'} onClick={() => guess(false)} className="btn-paper rounded-md py-3 font-display font-bold tracking-wider">
            ▼ {deck.lower}
          </button>
        </div>
      )}
      <p className="text-center text-xs text-ink-faint">A tie counts as right.</p>
    </div>
  );
}

/** /higher-lower and /higher-lower/:deck */
export default function HigherLower() {
  const { deck: id } = useParams();
  const bests = useProgress((s) => s.bests);
  if (id) {
    const deck = hlDeck(id);
    if (!deck) return <Navigate to="/higher-lower" replace />;
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <Link to="/higher-lower" className="font-display text-sm font-semibold tracking-wider text-ink-soft hover:text-ink">
            ← Higher or Lower
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
        <h1 className="text-5xl font-bold">Higher or Lower</h1>
        <p className="max-w-xl text-ink-soft">Two at a time: is the second one higher or lower? Keep going until you miss. Pick a deck.</p>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {HL_DECKS.map((d) => (
          <li key={d.id}>
            <Link to={`/higher-lower/${d.id}`} className="page flex h-full flex-col gap-1 rounded-md p-5 ring-2 ring-accent/40 transition hover:-translate-y-0.5">
              <span className="text-3xl">{d.icon}</span>
              <span className="font-display text-xl font-bold">{d.label}</span>
              <span className="text-sm text-ink-soft">{d.question}</span>
              <span className="mt-auto flex items-center justify-between pt-3 text-xs text-ink-faint">
                {d.items.length} to compare
                {(bests[`hl:${d.id}`] ?? 0) > 0 && (
                  <span className="inline-flex items-center gap-1 font-bold text-coral">
                    <FlameIcon /> best {bests[`hl:${d.id}`]}
                  </span>
                )}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
